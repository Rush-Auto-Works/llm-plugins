# Data

## us-road-courses.csv

US road-racing venues with street address, coordinates and whether each is still running. One row per venue, 93 rows: 59 `active`, 9 `unverified`, 25 `excluded` (closed tracks, temporary street circuits, big ovals). Built 2026-10-01 by [Rush Auto Works](https://rushautoworks.com) for its dealer CRM's "Nearest tracks" widget.

| Column | Meaning |
|---|---|
| `name` | The name the venue uses today |
| `street`, `city`, `state`, `zip` | Physical address, from the venue's own site where it was reachable |
| `lat`, `lng` | The track itself, not the town. `coord_source` says where they came from |
| `region` | Northeast, Southeast, Midwest, South or West |
| `type` | `road_course`, or `oval` for the one short oval a dealer asked for |
| `status` | `active`, `unverified` or `excluded`; `status_note` says why |
| `last_seen_event_year` | Newest year the venue appeared on a GridLife, SCCA, NASA, IMSA or FARA schedule that was read |
| `sources` | Which of those bodies ran an event there; `requested` means a dealer asked for it |
| `website` | Official site, when one was found |

`active` means the venue was seen at a sanctioned event in 2022 or later, was requested by name, or was already in the CRM. A venue that opened or closed after the build date is not reflected, so check the venue's site before sending anyone there. Canadian venues are not included. A few addresses came from search summaries or MotorsportReg because the venue's own page was blocked.
