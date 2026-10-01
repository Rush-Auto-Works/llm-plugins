"""convert.py against a stub libxrk.

The stub mimics only the surface convert.py uses from the real library (libxrk 0.13.0):
aim_xrk(path) -> LogFile with .channels (name -> table with column("timecodes") and column(name)),
.laps.to_pylist(), .metadata, and libxrk.base.ChannelMetadata.from_channel_table(table).
Real files are exercised by hand; CI has no libxrk.
"""
import os
import subprocess
import sys
import tempfile
import textwrap
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
CONVERT = os.path.join(HERE, "..", "plugin", "skills", "rush-sr-laps", "scripts", "convert.py")

STUB = textwrap.dedent('''
    import os
    import numpy as np

    class _Col:
        def __init__(self, values):
            self.values = np.asarray(values)

        def to_numpy(self, zero_copy_only=False):
            return self.values

    class Table:
        def __init__(self, name, timecodes, values, units, interpolate):
            self.name, self.timecodes, self.values = name, timecodes, values
            self.units, self.interpolate = units, interpolate
            self.num_rows = len(timecodes)

        def column(self, name):
            return _Col(self.timecodes if name == "timecodes" else self.values)

    class _Laps:
        def __init__(self, rows):
            self.rows = rows
            self.num_rows = len(rows)

        def to_pylist(self):
            return self.rows

    class LogFile:
        def __init__(self, channels, laps, metadata):
            self.channels, self.laps, self.metadata = channels, laps, metadata
            self.file_name = "stub"

    def aim_xrk(path):
        variant = os.environ.get("STUB_VARIANT", "")
        t100 = list(range(0, 29201, 100))
        t10 = list(range(0, 29201, 10))
        channels = {
            "Gear": Table("Gear", t100, [1 + t // 10000 for t in t100], "gear", False),
            "GPS Speed": Table("GPS Speed", t10, [10 + t / 1000 for t in t10], "m/s", True),
            "Front_Brake_p": Table("Front_Brake_p", t100, [t / 1000 * 2 for t in t100], "bar", True),
            "Empty": Table("Empty", [], [], "", False),
        }
        if variant == "nogps":
            del channels["GPS Speed"]
        laps = [
            {"num": 0, "start_time": 0, "end_time": 10000, "lap_type": "out"},
            {"num": 1, "start_time": 10000, "end_time": 19500, "lap_type": "full"},
            {"num": 2, "start_time": 19500, "end_time": 29200, "lap_type": "in"},
        ]
        if variant == "nolaps":
            laps = []
        metadata = {
            "Driver": "Test Driver", "Vehicle": "Rush SR", "Log Date": "04/18/2026", "Log Time": "13:48:09",
            "Session": "Generic testing", "Series": "Rush SR", "Venue": "Test Track",
        }
        if variant == "quotes":
            metadata["Driver"] = 'Say "hi" Driver'
        return LogFile(channels, _Laps(laps), metadata)
''')

STUB_BASE = textwrap.dedent('''
    class ChannelMetadata:
        def __init__(self, units, interpolate):
            self.units, self.interpolate = units, interpolate

        @classmethod
        def from_channel_table(cls, table):
            return cls(table.units, table.interpolate)
''')

ABSENT = 'raise ImportError("No module named libxrk")\n'

EXPECTED_HEAD = "\n".join([
    '"Format","AiM CSV File"',
    '"Session","Test Track"',
    '"Vehicle","Rush SR"',
    '"Racer","Test Driver"',
    '"Championship","Rush SR"',
    '"Comment",""',
    '"Date","Saturday, April 18, 2026"',
    '"Time","1:48 PM"',
    '"Sample Rate","20"',
    '"Duration","29.2"',
    '"Segment","Session"',
    '"Beacon Markers","10","19.5","29.2"',
    '"Segment Times","0:10.000","0:09.500","0:09.700"',
    '',
    '"Time","GPS Speed","Gear","Front_Brake_p"',
    '"s","m/s","gear","bar"',
    '',
    '"0.000","10.0000","1.0000","0.0000"',
    '"0.050","10.0500","1.0000","0.1000"',
    '"0.100","10.1000","1.0000","0.2000"',
])


def stub_dir(absent=False):
    root = tempfile.mkdtemp(prefix="stub-libxrk-")
    if absent:
        with open(os.path.join(root, "libxrk.py"), "w") as handle:
            handle.write(ABSENT)
        return root
    package = os.path.join(root, "libxrk")
    os.makedirs(package)
    with open(os.path.join(package, "__init__.py"), "w") as handle:
        handle.write(STUB + "\nfrom . import base\n")
    with open(os.path.join(package, "base.py"), "w") as handle:
        handle.write(STUB_BASE)
    return root


def read(path):
    with open(path) as handle:
        return handle.read()


def convert(args, variant="", absent=False):
    env = dict(os.environ, PYTHONPATH=stub_dir(absent), STUB_VARIANT=variant)
    return subprocess.run([sys.executable, CONVERT, *args], env=env, capture_output=True, text=True)


class ConvertTest(unittest.TestCase):
    def setUp(self):
        self.dir = tempfile.mkdtemp(prefix="convert-test-")
        self.xrk = os.path.join(self.dir, "session.xrk")
        self.csv = os.path.join(self.dir, "session.csv")
        with open(self.xrk, "wb") as handle:
            handle.write(b"\x00stub")

    def test_header_units_and_first_rows(self):
        run = convert([self.xrk, self.csv])
        self.assertEqual(run.returncode, 0, run.stderr)
        lines = read(self.csv).split("\n")
        self.assertEqual("\n".join(lines[:len(EXPECTED_HEAD.split("\n"))]), EXPECTED_HEAD)

    def test_row_count_and_summary_line(self):
        run = convert([self.xrk, self.csv])
        self.assertEqual(run.stdout.strip(), f"Wrote {self.csv}: 585 rows, 3 channels, 3 laps")
        data = [line for line in read(self.csv).split("\n")[17:] if line]
        self.assertEqual(len(data), 585)
        self.assertEqual(data[-1].split(",")[0], '"29.200"')

    def test_empty_channel_is_dropped_and_gps_speed_is_first(self):
        convert([self.xrk, self.csv])
        names = read(self.csv).split("\n")[14]
        self.assertNotIn("Empty", names)
        self.assertTrue(names.startswith('"Time","GPS Speed"'))

    def test_sample_and_hold_for_a_stepped_channel(self):
        convert([self.xrk, self.csv])
        rows = [line for line in read(self.csv).split("\n")[17:] if line]
        at = {row.split(",")[0].strip('"'): row.split(",") for row in rows}
        self.assertEqual(at["9.950"][2], '"1.0000"')
        self.assertEqual(at["10.000"][2], '"2.0000"')
        self.assertEqual(at["10.050"][2], '"2.0000"')

    def test_no_gps_speed_exits_2(self):
        run = convert([self.xrk, self.csv], variant="nogps")
        self.assertEqual(run.returncode, 2)
        self.assertIn("no GPS Speed channel", run.stderr)
        self.assertFalse(os.path.exists(self.csv))

    def test_no_laps_exits_2(self):
        run = convert([self.xrk, self.csv], variant="nolaps")
        self.assertEqual(run.returncode, 2)
        self.assertIn("no timed laps", run.stderr)
        self.assertFalse(os.path.exists(self.csv))

    def test_libxrk_absent_exits_3_with_the_pinned_install_line(self):
        run = convert([self.xrk, self.csv], absent=True)
        self.assertEqual(run.returncode, 3)
        self.assertIn("pip install libxrk==0.13.0", run.stderr)
        self.assertNotIn("Traceback", run.stderr)

    def test_missing_input_exits_1(self):
        run = convert([os.path.join(self.dir, "nope.xrk"), self.csv])
        self.assertEqual(run.returncode, 1)
        self.assertIn("cannot read", run.stderr)
        self.assertNotIn("Traceback", run.stderr)

    def test_wrong_arguments_exit_1_with_usage(self):
        run = convert([self.xrk])
        self.assertEqual(run.returncode, 1)
        self.assertIn("usage:", run.stderr)

    def test_quotes_in_metadata_are_escaped(self):
        run = convert([self.xrk, self.csv], variant="quotes")
        self.assertEqual(run.returncode, 0, run.stderr)
        self.assertIn('"Racer","Say ""hi"" Driver"', read(self.csv))


if __name__ == "__main__":
    unittest.main()
