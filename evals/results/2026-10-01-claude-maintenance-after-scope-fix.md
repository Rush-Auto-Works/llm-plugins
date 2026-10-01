# Golden prompts, Claude Code (claude-sonnet-5-5, 2026-10-01)

48 runs of 24 prompts. Headless Claude Code with the two Rush SR connectors and no built-in tools.

| group | pass |
|---|---|
| direct | 12/12 (100%) |
| indirect | 12/12 (100%) |
| negative | 4/4 (100%) |
| tricky | 6/6 (100%) |
| near-miss | 13/14 (93%) |

| tool | recall (right tool first when it should run) | precision (right when it ran first) |
|---|---|---|
| diagnose_symptom | 10/10 (100%) | 10/10 (100%) |
| maintenance_schedule | 10/10 (100%) | 10/10 (100%) |
| lookup_procedure | 10/10 (100%) | 10/11 (91%) |
| analyze_session | n/a | n/a |
| compare_laps | n/a | n/a |
| find_time_loss | n/a | n/a |
| compare_sessions | n/a | n/a |

| id | kind | expected | called | result | prompt |
|---|---|---|---|---|---|
| diag-d1 | direct | diagnose_symptom | diagnose_symptom | pass | My Rush SR won't start. The dash shows N but the engine won't crank. W |
| diag-d2 | direct | diagnose_symptom | diagnose_symptom | pass | Rush SR owner here: neither shift paddle does anything and the compres |
| diag-i1 | indirect | diagnose_symptom | diagnose_symptom, lookup_procedure, diagnose_symptom | pass | I race a Rush SR and it cranks but won't fire after sitting for a week |
| diag-i2 | indirect | diagnose_symptom | diagnose_symptom | pass | There's a clunk in my Rush SR every time I lift off the throttle. Is t |
| sched-d1 | direct | maintenance_schedule | maintenance_schedule | pass | How often should I change the brake fluid on my Rush SR? |
| sched-d2 | direct | maintenance_schedule | maintenance_schedule | pass | What is the service interval for the chain on a Rush SR? |
| sched-i1 | indirect | maintenance_schedule | maintenance_schedule, maintenance_schedule, maintenance_schedule | pass | I'm racing my Rush SR this weekend. What needs servicing before an eve |
| sched-i2 | indirect | maintenance_schedule | maintenance_schedule, maintenance_schedule, maintenance_schedule | pass | My Rush SR has 150 hours on it. What is due now? |
| proc-d1 | direct | lookup_procedure | lookup_procedure | pass | How do I bleed the brakes on my Rush SR? |
| proc-d2 | direct | lookup_procedure | lookup_procedure, maintenance_schedule | pass | Walk me through changing the differential oil on a Rush SR. |
| proc-i1 | indirect | lookup_procedure | lookup_procedure | pass | I need to swap the front brake pads on my SR. Steps please. |
| proc-i2 | indirect | lookup_procedure | lookup_procedure, maintenance_schedule | pass | What's the right way to change the oil on a Rush SR? |
| neg-1 | negative | none | none | pass | What's the best line through turn 1 at Road Atlanta? |
| neg-7 | negative | none | none | pass | How much does a Rush SR cost, and can I order one? |
| tricky-1 | tricky | diagnose_symptom | diagnose_symptom, diagnose_symptom | pass | Mi Rush SR no arranca y el tablero marca N. ¿Qué reviso? |
| tricky-2 | tricky | lookup_procedure | lookup_procedure | pass | hw do i blleed the breaks on my rush sr?? asap |
| tricky-3 | tricky | maintenance_schedule | maintenance_schedule | pass | SR: when do i do the brake fluid |
| near-1 | near-miss | none | none | pass | My Miata won't start and the dash lights are dim. What should I check? |
| near-2 | near-miss | none | none | pass | How do I bleed the brakes on a Honda S2000? |
| near-3 | near-miss | none | none | pass | How often should I change the oil on a Polaris RZR? |
| near-4 | near-miss | none | none | pass | How do I wire a MyChron 5 to my car's CAN bus? |
| near-5 | near-miss | none | none | pass | What's the fastest way through the carousel at Road America? |
| near-6 | near-miss | none | none | pass | I'm picking brake pads for track use. Which compound is best? |
| near-7 | near-miss | none | none | pass | Convert a lap time of 1:39.304 to seconds. |
| diag-d1 | direct | diagnose_symptom | diagnose_symptom | pass | My Rush SR won't start. The dash shows N but the engine won't crank. W |
| diag-d2 | direct | diagnose_symptom | diagnose_symptom | pass | Rush SR owner here: neither shift paddle does anything and the compres |
| diag-i1 | indirect | diagnose_symptom | diagnose_symptom, lookup_procedure, diagnose_symptom | pass | I race a Rush SR and it cranks but won't fire after sitting for a week |
| diag-i2 | indirect | diagnose_symptom | diagnose_symptom | pass | There's a clunk in my Rush SR every time I lift off the throttle. Is t |
| sched-d1 | direct | maintenance_schedule | maintenance_schedule | pass | How often should I change the brake fluid on my Rush SR? |
| sched-d2 | direct | maintenance_schedule | maintenance_schedule | pass | What is the service interval for the chain on a Rush SR? |
| sched-i1 | indirect | maintenance_schedule | maintenance_schedule, maintenance_schedule, maintenance_schedule | pass | I'm racing my Rush SR this weekend. What needs servicing before an eve |
| sched-i2 | indirect | maintenance_schedule | maintenance_schedule | pass | My Rush SR has 150 hours on it. What is due now? |
| proc-d1 | direct | lookup_procedure | lookup_procedure | pass | How do I bleed the brakes on my Rush SR? |
| proc-d2 | direct | lookup_procedure | lookup_procedure, maintenance_schedule | pass | Walk me through changing the differential oil on a Rush SR. |
| proc-i1 | indirect | lookup_procedure | lookup_procedure | pass | I need to swap the front brake pads on my SR. Steps please. |
| proc-i2 | indirect | lookup_procedure | lookup_procedure, maintenance_schedule | pass | What's the right way to change the oil on a Rush SR? |
| neg-1 | negative | none | none | pass | What's the best line through turn 1 at Road Atlanta? |
| neg-7 | negative | none | none | pass | How much does a Rush SR cost, and can I order one? |
| tricky-1 | tricky | diagnose_symptom | diagnose_symptom, diagnose_symptom | pass | Mi Rush SR no arranca y el tablero marca N. ¿Qué reviso? |
| tricky-2 | tricky | lookup_procedure | lookup_procedure | pass | hw do i blleed the breaks on my rush sr?? asap |
| tricky-3 | tricky | maintenance_schedule | maintenance_schedule | pass | SR: when do i do the brake fluid |
| near-1 | near-miss | none | none | pass | My Miata won't start and the dash lights are dim. What should I check? |
| near-2 | near-miss | none | none | pass | How do I bleed the brakes on a Honda S2000? |
| near-3 | near-miss | none | none | pass | How often should I change the oil on a Polaris RZR? |
| near-4 | near-miss | none | lookup_procedure | FAIL | How do I wire a MyChron 5 to my car's CAN bus? |
| near-5 | near-miss | none | none | pass | What's the fastest way through the carousel at Road America? |
| near-6 | near-miss | none | none | pass | I'm picking brake pads for track use. Which compound is best? |
| near-7 | near-miss | none | none | pass | Convert a lap time of 1:39.304 to seconds. |
