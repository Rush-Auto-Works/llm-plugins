# Golden prompts: ChatGPT sheet

Run in ChatGPT developer mode with both Rush SR plugins enabled. One new chat per row. For rows with an attachment, attach the named file from `evals/` instead of pasting it.

Write the first Rush SR tool ChatGPT called (or "none") in the "called" column, and mark "ok" when it equals the expected tool or the call was acceptable. For "none" rows any Rush SR tool call is a miss.

| id | kind | expected | prompt | called | ok |
|---|---|---|---|---|---|
| diag-d1 | direct | diagnose_symptom | My Rush SR won't start. The dash shows N but the engine won't crank. What could be wrong? |  |  |
| diag-d2 | direct | diagnose_symptom | Rush SR owner here: neither shift paddle does anything and the compressor isn't running. What should I check first? |  |  |
| diag-i1 | indirect | diagnose_symptom | I race a Rush SR and it cranks but won't fire after sitting for a week. Track day is tomorrow, help. |  |  |
| diag-i2 | indirect | diagnose_symptom | There's a clunk in my Rush SR every time I lift off the throttle. Is that normal? |  |  |
| sched-d1 | direct | maintenance_schedule | How often should I change the brake fluid on my Rush SR? |  |  |
| sched-d2 | direct | maintenance_schedule | What is the service interval for the chain on a Rush SR? |  |  |
| sched-i1 | indirect | maintenance_schedule | I'm racing my Rush SR this weekend. What needs servicing before an event? |  |  |
| sched-i2 | indirect | maintenance_schedule | My Rush SR has 150 hours on it. What is due now? |  |  |
| proc-d1 | direct | lookup_procedure | How do I bleed the brakes on my Rush SR? |  |  |
| proc-d2 | direct | lookup_procedure | Walk me through changing the differential oil on a Rush SR. |  |  |
| proc-i1 | indirect | lookup_procedure | I need to swap the front brake pads on my SR. Steps please. |  |  |
| proc-i2 | indirect | lookup_procedure | What's the right way to change the oil on a Rush SR? |  |  |
| analyze-d1 | direct | analyze_session | Analyze my AiM session: lap times, best lap and consistency.  [attach sample-session.csv] |  |  |
| analyze-d2 | direct | analyze_session | What were my best lap and my theoretical best lap in this RaceStudio export?  [attach sample-session.csv] |  |  |
| analyze-i1 | indirect | analyze_session | Here's my data from today's session. How did I do?  [attach sample-session.csv] |  |  |
| analyze-i2 | indirect | analyze_session | Was I consistent out there? This is the lap data.  [attach sample-session.csv] |  |  |
| laps-d1 | direct | compare_laps | Compare lap 2 and lap 3 in this AiM export: braking points and corner minimum speeds.  [attach sample-session.csv] |  |  |
| laps-d2 | direct | compare_laps | Why am I slow in the corners on lap 3 compared with lap 2?  [attach sample-session.csv] |  |  |
| laps-i1 | indirect | compare_laps | Lap 2 felt much better than lap 3. What changed? Data below.  [attach sample-session.csv] |  |  |
| laps-i2 | indirect | compare_laps | Did I brake earlier on lap 3 than on lap 2?  [attach sample-session.csv] |  |  |
| loss-d1 | direct | find_time_loss | Where am I losing time on lap 3 compared with my best lap?  [attach sample-session.csv] |  |  |
| loss-d2 | direct | find_time_loss | Rank the sectors where lap 2 loses the most time against my best lap.  [attach sample-session.csv] |  |  |
| loss-i1 | indirect | find_time_loss | Which part of the track is my weakest compared with my fastest lap?  [attach sample-session.csv] |  |  |
| loss-i2 | indirect | find_time_loss | I want to be quicker. Where is the time hiding in this session?  [attach sample-session.csv] |  |  |
| sess-d1 | direct | compare_sessions | Compare these two AiM sessions: who was faster and where?  Session A: [attach sample-session.csv]  Session B: [attach sample-session-b.csv] |  |  |
| sess-d2 | direct | compare_sessions | Compare two drivers on the same track from their RaceStudio exports. Best lap against best lap.  Driver A: [attach sample-session.csv]  Driver B: [attach sample-session-b.csv] |  |  |
| sess-i1 | indirect | compare_sessions | My teammate and I ran the same track. Here are both exports. Where does he gain on me?  Mine: [attach sample-session.csv]  His: [attach sample-session-b.csv] |  |  |
| sess-i2 | indirect | compare_sessions | I ran this today and again last month. Am I faster now, and in which corners?  Today: [attach sample-session.csv]  Last month: [attach sample-session-b.csv] |  |  |
| neg-1 | negative | none | What's the best line through turn 1 at Road Atlanta? |  |  |
| neg-2 | negative | none | How do I change a tire on a Honda Civic? |  |  |
| neg-3 | negative | none | What brake fluid should I use in a Miata? |  |  |
| neg-4 | negative | none | Write a haiku about racing. |  |  |
| neg-5 | negative | none | Explain what a theoretical best lap is. |  |  |
| neg-6 | negative | none | How do I analyze lap data in Excel? |  |  |
| neg-7 | negative | none | How much does a Rush SR cost, and can I order one? |  |  |
| neg-8 | negative | none | Recommend a good racing helmet for track days. |  |  |
| tricky-1 | tricky | diagnose_symptom | Mi Rush SR no arranca y el tablero marca N. ¿Qué reviso? |  |  |
| tricky-2 | tricky | lookup_procedure | hw do i blleed the breaks on my rush sr?? asap |  |  |
| tricky-3 | tricky | maintenance_schedule | SR: when do i do the brake fluid |  |  |
| tricky-4 | tricky | analyze_session | ok so this is the log from my SR at CMP, any thoughts?  [attach sample-session.csv] |  |  |
| tricky-5 | tricky | compare_sessions | Me vs my friend, same track, who's quicker and where?  Me: [attach sample-session.csv]  Friend: [attach sample-session-b.csv] |  |  |
| near-1 | near-miss | none | My Miata won't start and the dash lights are dim. What should I check? |  |  |
| near-2 | near-miss | none | How do I bleed the brakes on a Honda S2000? |  |  |
| near-3 | near-miss | none | How often should I change the oil on a Polaris RZR? |  |  |
| near-4 | near-miss | none | How do I wire a MyChron 5 to my car's CAN bus? |  |  |
| near-5 | near-miss | none | What's the fastest way through the carousel at Road America? |  |  |
| near-6 | near-miss | none | I'm picking brake pads for track use. Which compound is best? |  |  |
| near-7 | near-miss | none | Convert a lap time of 1:39.304 to seconds. |  |  |

Score: direct and indirect rows measure recall (did the right tool run?). Negative rows measure precision (did a tool stay out of the way?).

