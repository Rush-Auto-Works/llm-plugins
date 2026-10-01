#!/usr/bin/env python3
"""Convert an AiM .xrk log to a RaceStudio-style CSV that engine.mjs can analyze.

usage: python3 convert.py <in.xrk> <out.csv>

Needs libxrk (MIT, https://pypi.org/project/libxrk/) and numpy. Reads the input file, writes the output
file, and does nothing else: no network, no other files.

Exit codes: 0 done, 1 bad arguments or unreadable file, 2 session cannot be analyzed, 3 libxrk missing.
"""
import datetime
import sys

import numpy as np

LIBXRK_VERSION = "0.13.0"
INSTALL_HINT = f"pip install libxrk=={LIBXRK_VERSION} --break-system-packages"
STEP_MS = 50
SAMPLE_RATE = 20


class ConvertError(Exception):
    def __init__(self, code, message):
        super().__init__(message)
        self.code = code


def load_libxrk():
    try:
        import libxrk
        from libxrk.base import ChannelMetadata
    except ImportError:
        raise ConvertError(3, f"libxrk is not installed. Run: {INSTALL_HINT}")
    return libxrk, ChannelMetadata


def read_log(path):
    libxrk, metadata_type = load_libxrk()
    try:
        with open(path, "rb"):
            pass
    except OSError as error:
        raise ConvertError(1, f"cannot read {path}: {error.strerror or error}")
    try:
        return libxrk.aim_xrk(path), metadata_type
    except Exception as error:
        raise ConvertError(1, f"cannot read {path} as an AiM .xrk file: {error}")


def trim(seconds):
    return f"{seconds:.3f}".rstrip("0").rstrip(".")


def lap_clock(seconds):
    minutes = int(seconds // 60)
    return f"{minutes}:{seconds - 60 * minutes:06.3f}"


def quote(value):
    return '"' + str(value).replace('"', '""').replace("\r", " ").replace("\n", " ") + '"'


def date_fields(metadata):
    try:
        stamp = datetime.datetime.strptime(f"{metadata.get('Log Date', '')} {metadata.get('Log Time', '')}", "%m/%d/%Y %H:%M:%S")
    except ValueError:
        return "", ""
    hour = stamp.hour % 12 or 12
    return stamp.strftime("%A, %B %d, %Y"), f"{hour}:{stamp.minute:02d} {'AM' if stamp.hour < 12 else 'PM'}"


def laps_of(log):
    rows = log.laps.to_pylist()
    if not rows:
        raise ConvertError(2, "no timed laps in this file")
    return rows


def sampled_channels(log, metadata_type):
    """Channels that have samples, as (name, units, interpolate, timecodes ms, values), GPS Speed first."""
    found = []
    for name, table in log.channels.items():
        if table.num_rows == 0:
            continue
        meta = metadata_type.from_channel_table(table)
        found.append((
            name,
            meta.units or "#",
            bool(meta.interpolate),
            np.asarray(table.column("timecodes").to_numpy(zero_copy_only=False), dtype=np.float64),
            np.asarray(table.column(name).to_numpy(zero_copy_only=False), dtype=np.float64),
        ))
    if not any(item[0] == "GPS Speed" for item in found):
        raise ConvertError(2, "no GPS Speed channel, the session cannot be analyzed")
    return sorted(found, key=lambda item: item[0] != "GPS Speed")


def resample(timecodes, values, interpolate, grid):
    """Linear for interpolated channels, sample-and-hold for the rest, empty before the first sample."""
    if interpolate:
        column = np.interp(grid, timecodes, values)
    else:
        column = values[np.clip(np.searchsorted(timecodes, grid, side="right") - 1, 0, len(values) - 1)]
    return np.where(grid < timecodes[0], np.nan, column)


def format_column(values, decimals):
    return ["" if np.isnan(value) else f"{value:.{decimals}f}" for value in values]


def header_lines(log, laps):
    meta = log.metadata
    date, clock = date_fields(meta)
    ends = [row["end_time"] / 1000 for row in laps]
    times = [lap_clock((row["end_time"] - row["start_time"]) / 1000) for row in laps]
    pairs = [
        ("Format", "AiM CSV File"), ("Session", meta.get("Venue", "")), ("Vehicle", meta.get("Vehicle", "")),
        ("Racer", meta.get("Driver", "")), ("Championship", meta.get("Series", "")), ("Comment", ""),
        ("Date", date), ("Time", clock), ("Sample Rate", SAMPLE_RATE), ("Duration", trim(ends[-1])), ("Segment", "Session"),
    ]
    lines = [",".join(quote(item) for item in pair) for pair in pairs]
    lines.append(",".join(quote(item) for item in ["Beacon Markers", *[trim(end) for end in ends]]))
    lines.append(",".join(quote(item) for item in ["Segment Times", *times]))
    return lines


def convert(source, target):
    log, metadata_type = read_log(source)
    laps = laps_of(log)
    channels = sampled_channels(log, metadata_type)
    last_ms = int(np.ceil(laps[-1]["end_time"] / STEP_MS) * STEP_MS)
    grid = np.arange(0, last_ms + 1, STEP_MS, dtype=np.float64)
    columns = [format_column(grid / 1000, 3)]
    columns += [format_column(resample(t, v, interp, grid), 4) for _, _, interp, t, v in channels]
    names = ["Time", *[item[0] for item in channels]]
    units = ["s", *[item[1] for item in channels]]
    with open(target, "w", newline="") as out:
        out.write("\n".join(header_lines(log, laps)) + "\n\n")
        out.write(",".join(quote(name) for name in names) + "\n")
        out.write(",".join(quote(unit) for unit in units) + "\n\n")
        out.write("\n".join(",".join(quote(cell) for cell in row) for row in zip(*columns)) + "\n")
    return len(grid), len(channels), len(laps)


def main(argv):
    if len(argv) != 3:
        print("usage: convert.py <in.xrk> <out.csv>", file=sys.stderr)
        return 1
    try:
        rows, channels, laps = convert(argv[1], argv[2])
    except ConvertError as error:
        print(str(error), file=sys.stderr)
        return error.code
    except OSError as error:
        print(f"cannot write {argv[2]}: {error.strerror or error}", file=sys.stderr)
        return 1
    print(f"Wrote {argv[2]}: {rows} rows, {channels} channels, {laps} laps")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
