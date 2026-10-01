# 1B: AiM lap data analyzer MCP server

A new Worker in `servers/laps`: three read-only tools that take an AiM RaceStudio CSV export and return lap
analysis. Same stack as 1A (`createMcpHandler`, Streamable HTTP at `/mcp`, no Durable Objects, no auth). No LLM
calls: the host model reads the numbers.

## Evidence on the CSV layout (read this first)

AiM publishes no description of the CSV layout. The only
open-source reader found is Zenardi/racestudio-macos (`core/racestudio-io/src/csv_import.rs`, `csv_export.rs`,
`laps_from_beacons.rs`, `quoting.rs`). It is SINGLE-SOURCE and its test fixture is synthetic. What it assumes:

| Item | Assumption (single-source) |
|---|---|
| Marker row | `"Format","AiM CSV File"` |
| Header keys | Session or Venue, Vehicle, Racer, Championship, Comment, Date, Time, Sample Rate, Duration, Segment, Beacon Markers, Segment Times |
| Beacon Markers | cumulative lap END times in seconds. First lap is `[0, b0]`, so the first marker is not 0 |
| Segment Times | `M:SS.mmm` |
| After the header | blank row, channel names row (first column `Time`), units row, blank row, data. Blank cells are NaN |
| Quoting, line ends | all fields quoted, CRLF in the writer. The reader tolerates unquoted fields |
| Decimals | dot. AiM's FAQ says RS2 Analysis can export a decimal comma, so real files may use `,` |
| GPS Speed unit | km/h on disk |

So the parser is defensive about everything above, every fixture in `e2e/` is synthesized from this table, and the
tool output says so in `notes` whenever it had to assume something (no units row, integrated distance, etc.).
Replace the fixtures with a real export as soon as one exists. Rush SR channel names come from
`RAW-AiM-Toolbox/docs/rush-sr-channels.md`: `GPS Speed` is often empty on Rush SR logs, so the speed fallback is
`ECEF velocity_X/_Y/_Z` (m/s); brake pressure is `Front_Brake_p` (bar), longitudinal accel `InlineAcc`.

## Input

Every tool takes exactly one of:

- `file`: `{download_url, file_id, mime_type?, file_name?}`. The tool declares `_meta["openai/fileParams"] = ["file"]`
  so ChatGPT passes uploads this way. The Worker fetches `download_url` (https only, no IP literals or localhost,
  5 s timeout, `MAX_CSV_BYTES` cap, redirects not followed).
- `csv_text`: the CSV pasted as text. Fallback for clients with no file mechanism (Claude connectors document none).

## Engine

1. Parse: sniff delimiter (`,` `;` tab) and decimal separator, strip BOM, handle quoting and CRLF.
2. Header block to session info. Beacon Markers to lap intervals. No markers: use a `Lap Number` channel if present,
   else fail with export instructions.
3. Speed channel: first of `GPS Speed`, `GPS_Speed`, `Speed`, `VehicleSpeed`, `Ground Speed` with real data;
   else magnitude of `ECEF velocity_X/_Y/_Z`; else fail and list the channels found. Units row converts to m/s;
   no units row assumes km/h and says so.
4. Distance: a `Distance` channel (made lap-relative by subtracting the lap start), else integrate speed over time.
5. Valid laps: all laps within 107% of the best lap. Slower first and last laps are reported as out/in laps and
   excluded from best, consistency and theoretical best. Other slow laps are excluded too, with the reason.
6. Alignment: every lap is mapped onto 20 equal-distance sectors (fraction of that lap's own distance, which
   absorbs GPS drift). Sector times give the theoretical best (sum of the per-sector best) and the loss ranking.
7. Braking zones: brake channel (`Front_Brake_p`, `Brake Pressure`, `Brake`) above 10% of its max; fallback
   longitudinal accel below -0.3 g; fallback speed derivative. Corner minimum speeds: local minima of smoothed
   speed with at least 10 km/h of prominence.

## Tools (all `readOnlyHint: true`, `destructiveHint: false`, `openWorldHint: true` because they fetch a client URL)

| Tool | Input | structuredContent |
|---|---|---|
| `analyze_session` | file or csv_text | `session`, `laps[{lap,time_s,excluded,reason?}]`, `best_lap{lap,time_s}`, `theoretical_best_s`, `consistency{valid_laps,mean_s,stdev_s,spread_s}`, `channels{speed,distance,brake?}`, `notes[]`, `rush` |
| `compare_laps` | file or csv_text, `lap_a`, `lap_b` (1-based) | `lap_a`, `lap_b`, `time_a_s`, `time_b_s`, `delta_s` (a minus b), `delta_by_distance[{distance_m,delta_s}]` (20 points, last equals `delta_s`), `braking[{zone,lap_a{onset_m,entry_speed_kmh},lap_b{...},onset_diff_m}]`, `min_speeds[{corner,distance_m,lap_a_kmh,lap_b_kmh,diff_kmh}]`, `notes[]`, `rush` |
| `find_time_loss` | file or csv_text, `lap?` | `lap`, `reference_lap` (the best valid lap), `lap_time_s`, `reference_time_s`, `total_loss_s`, `segments[{start_m,end_m,loss_s}]` (top 5, largest loss first), `notes[]`, `rush`. Default `lap` is the median valid lap other than the reference, stated in `notes` |

Every text result ends with `Built by Rush Auto Works: <link>` where the link carries
`utm_source=mcp&utm_medium=plugin&utm_campaign=rush-sr-laps&utm_content=<tool name>`.

## Failure matrix

| # | State or input | What the operation does | How it fails | Caller is told |
|---|---|---|---|---|
| 1 | well-formed export with markers | full analysis | none | summary with best lap, theoretical best, consistency |
| 2 | quoted or unquoted, CRLF, BOM | normalizes | mis-split first column | same result as the plain file |
| 3 | `;` delimiter with decimal comma | sniffs both | numbers read as text | same result |
| 4 | no units row | assumes km/h | wrong unit | result plus a note that km/h was assumed |
| 5 | speed channel named `GPS_Speed`, `Speed`, and so on | alias lookup | channel missed | same result |
| 6 | `GPS Speed` blank, ECEF velocity present | magnitude of ECEF | all-NaN speed | result plus a note naming ECEF |
| 7 | no usable speed at all | stops | no data | error listing the channels found |
| 8 | no Beacon Markers and no Lap Number | stops | cannot split laps | error explaining how to export with laps |
| 9 | a marker is NaN or out of order | skips it | phantom laps | result plus a note naming the skipped markers |
| 10 | out-lap or in-lap slower than 107% | excludes from stats | skewed best and mean | laps listed with `excluded` and a reason |
| 11 | no `Distance` channel | integrates speed per lap | drift | result plus a note |
| 12 | blank cells (mixed sample rates) | NaN-aware interpolation | NaN in output | finite numbers only |
| 13 | file over `MAX_CSV_BYTES` | rejects before parsing | memory blowup | error naming the limit |
| 14 | `download_url` not https, an IP literal, or localhost | refuses to fetch | SSRF | error saying the URL is not allowed |
| 15 | download 404, 5xx, or hang | 5 s timeout | stalled call | error saying the file could not be downloaded; ask to re-upload or paste |
| 16 | both or neither of file and csv_text | schema check | none | validation error |
| 17 | `compare_laps` with an unknown lap or the same lap twice | validates | none | error listing valid lap numbers |
| 18 | single-lap session | analyzes; compare cannot run | none | analysis OK, `compare_laps` explains it needs two laps |
| 19 | NUL bytes or binary content (an `.xrk` upload) | detects | garbage parse | error telling the user to export CSV from RaceStudio |
| 20 | tool metadata | listing | weak discovery | annotations, `openai/fileParams`, "Use this when / Do not use for", `outputSchema` |

## Tests (E2E, `e2e/laps.e2e.test.mjs`)

`e2e/fixtures.mjs` synthesizes a 6-lap session on a 2000 m track with three corners and known per-lap times (ground
truth comes from the generator, not from the code under test), and writes it in the layouts from the table above.
The E2E boots `wrangler dev`, serves fixtures from a local HTTP server, and speaks raw JSON-RPC to `/mcp`. Each
run writes `e2e/out/results.json`. One test per matrix row.

## Out of scope for v1

XRK input, GPS-based lap detection with no markers, track maps, corner naming, tire or fuel modeling.
