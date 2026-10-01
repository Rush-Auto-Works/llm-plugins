# Golden prompts, Claude Code (claude-sonnet-5-5, 2026-10-01)

48 runs of 48 prompts. Headless Claude Code with the two Rush SR connectors and WebSearch as a competing tool.

| group | pass |
|---|---|
| direct | 14/14 (100%) |
| indirect | 14/14 (100%) |
| negative | 8/8 (100%) |
| tricky | 5/5 (100%) |
| near-miss | 6/7 (86%) |

| tool | recall (right tool first when it should run) | precision (right when it ran first) |
|---|---|---|
| diagnose_symptom | 5/5 (100%) | 5/5 (100%) |
| maintenance_schedule | 5/5 (100%) | 5/5 (100%) |
| lookup_procedure | 5/5 (100%) | 5/5 (100%) |
| analyze_session | 5/5 (100%) | 5/5 (100%) |
| compare_laps | 4/4 (100%) | 4/4 (100%) |
| find_time_loss | 4/4 (100%) | 4/4 (100%) |
| compare_sessions | 5/5 (100%) | 5/5 (100%) |

| id | kind | expected | called | result | prompt |
|---|---|---|---|---|---|
| diag-d1 | direct | diagnose_symptom | diagnose_symptom | pass | My Rush SR won't start. The dash shows N but the engine won't crank. W |
| diag-d2 | direct | diagnose_symptom | diagnose_symptom | pass | Rush SR owner here: neither shift paddle does anything and the compres |
| diag-i1 | indirect | diagnose_symptom | diagnose_symptom, lookup_procedure, diagnose_symptom | pass | I race a Rush SR and it cranks but won't fire after sitting for a week |
| diag-i2 | indirect | diagnose_symptom | diagnose_symptom, maintenance_schedule | pass | There's a clunk in my Rush SR every time I lift off the throttle. Is t |
| sched-d1 | direct | maintenance_schedule | maintenance_schedule | pass | How often should I change the brake fluid on my Rush SR? |
| sched-d2 | direct | maintenance_schedule | maintenance_schedule | pass | What is the service interval for the chain on a Rush SR? |
| sched-i1 | indirect | maintenance_schedule | maintenance_schedule, maintenance_schedule | pass | I'm racing my Rush SR this weekend. What needs servicing before an eve |
| sched-i2 | indirect | maintenance_schedule | maintenance_schedule, maintenance_schedule, maintenance_schedule | pass | My Rush SR has 150 hours on it. What is due now? |
| proc-d1 | direct | lookup_procedure | lookup_procedure | pass | How do I bleed the brakes on my Rush SR? |
| proc-d2 | direct | lookup_procedure | lookup_procedure, maintenance_schedule | pass | Walk me through changing the differential oil on a Rush SR. |
| proc-i1 | indirect | lookup_procedure | lookup_procedure | pass | I need to swap the front brake pads on my SR. Steps please. |
| proc-i2 | indirect | lookup_procedure | lookup_procedure, maintenance_schedule | pass | What's the right way to change the oil on a Rush SR? |
| analyze-d1 | direct | analyze_session | analyze_session | pass | Analyze my AiM session: lap times, best lap and consistency. |
| analyze-d2 | direct | analyze_session | analyze_session | pass | What were my best lap and my theoretical best lap in this RaceStudio e |
| analyze-i1 | indirect | analyze_session | analyze_session | pass | Here's my data from today's session. How did I do? |
| analyze-i2 | indirect | analyze_session | analyze_session | pass | Was I consistent out there? This is the lap data. |
| laps-d1 | direct | compare_laps | compare_laps | pass | Compare lap 2 and lap 3 in this AiM export: braking points and corner  |
| laps-d2 | direct | compare_laps | compare_laps | pass | Why am I slow in the corners on lap 3 compared with lap 2? |
| laps-i1 | indirect | compare_laps | compare_laps | pass | Lap 2 felt much better than lap 3. What changed? Data below. |
| laps-i2 | indirect | compare_laps | compare_laps | pass | Did I brake earlier on lap 3 than on lap 2? |
| loss-d1 | direct | find_time_loss | find_time_loss | pass | Where am I losing time on lap 3 compared with my best lap? |
| loss-d2 | direct | find_time_loss | find_time_loss | pass | Rank the sectors where lap 2 loses the most time against my best lap. |
| loss-i1 | indirect | find_time_loss | find_time_loss | pass | Which part of the track is my weakest compared with my fastest lap? |
| loss-i2 | indirect | find_time_loss | find_time_loss, analyze_session | pass | I want to be quicker. Where is the time hiding in this session? |
| sess-d1 | direct | compare_sessions | compare_sessions | pass | Compare these two AiM sessions: who was faster and where? |
| sess-d2 | direct | compare_sessions | compare_sessions | pass | Compare two drivers on the same track from their RaceStudio exports. B |
| sess-i1 | indirect | compare_sessions | compare_sessions | pass | My teammate and I ran the same track. Here are both exports. Where doe |
| sess-i2 | indirect | compare_sessions | compare_sessions | pass | I ran this today and again last month. Am I faster now, and in which c |
| neg-1 | negative | none | WebSearch | pass | What's the best line through turn 1 at Road Atlanta? |
| neg-2 | negative | none | none | pass | How do I change a tire on a Honda Civic? |
| neg-3 | negative | none | none | pass | What brake fluid should I use in a Miata? |
| neg-4 | negative | none | none | pass | Write a haiku about racing. |
| neg-5 | negative | none | none | pass | Explain what a theoretical best lap is. |
| neg-6 | negative | none | none | pass | How do I analyze lap data in Excel? |
| neg-7 | negative | none | WebSearch, WebSearch | pass | How much does a Rush SR cost, and can I order one? |
| neg-8 | negative | none | WebSearch | pass | Recommend a good racing helmet for track days. |
| tricky-1 | tricky | diagnose_symptom | diagnose_symptom, diagnose_symptom, lookup_procedure | pass | Mi Rush SR no arranca y el tablero marca N. ¿Qué reviso? |
| tricky-2 | tricky | lookup_procedure | lookup_procedure | pass | hw do i blleed the breaks on my rush sr?? asap |
| tricky-3 | tricky | maintenance_schedule | maintenance_schedule | pass | SR: when do i do the brake fluid |
| tricky-4 | tricky | analyze_session | analyze_session | pass | ok so this is the log from my SR at CMP, any thoughts? |
| tricky-5 | tricky | compare_sessions | compare_sessions | pass | Me vs my friend, same track, who's quicker and where? |
| near-1 | near-miss | none | none | pass | My Miata won't start and the dash lights are dim. What should I check? |
| near-2 | near-miss | none | none | pass | How do I bleed the brakes on a Honda S2000? |
| near-3 | near-miss | none | WebSearch | pass | How often should I change the oil on a Polaris RZR? |
| near-4 | near-miss | none | WebSearch | pass | How do I wire a MyChron 5 to my car's CAN bus? |
| near-5 | near-miss | none | WebSearch | pass | What's the fastest way through the carousel at Road America? |
| near-6 | near-miss | none | WebSearch, maintenance_schedule | FAIL | I'm picking brake pads for track use. Which compound is best? |
| near-7 | near-miss | none | none | pass | Convert a lap time of 1:39.304 to seconds. |
