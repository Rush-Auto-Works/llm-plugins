# Privacy policy: plugins section (draft)

Paste as a new section of https://rushautoworks.com/privacy-policy/ and set a "Last updated" date at the top of the page. The policy has neither today, and it names no retention period. Written for the code as deployed; paste it after the servers carrying the logging setting (`observability.enabled: false`) are deployed.

---

## Rush SR plugins and connectors (Claude and ChatGPT)

RUSH Auto Works Inc offers two connectors and a plugin that work inside AI assistants such as Claude and ChatGPT. The maintenance connector (`maintenance.mcp.rush.sr`) answers questions about the Rush SR from the public owner's manual. The lap connector (`laps.mcp.rush.sr`) analyzes AiM RaceStudio lap data. The Rush SR plugin for Claude adds a skill that reads AiM `.xrk` logs.

**What we receive.** The maintenance connector receives the text of your question. The lap connector receives the lap data you provide: either the CSV text, or a link to a file you attached, which our server downloads once. It also receives any lap numbers you ask about. Your AI assistant decides what to send, so it may send more of your conversation than you expect; we cannot see the rest of your conversation.

**What we do with it.** We process it in memory to produce the answer and then discard it. We do not store it, we do not keep logs of it, we do not use it to train anything, and we do not sell or share it. Our connectors do not call a language model. There is no account and no sign-in.

**Infrastructure providers.** Requests reach our servers through Amazon Web Services (CloudFront) and Cloudflare (Workers), which process them on our behalf. We have not turned on CloudFront access logs, and we have turned off request logging in Cloudflare Workers. These providers may keep standard network and billing metadata under their own terms.

**The skill in Claude.** The skill runs in your Claude sandbox, not on our servers. It installs the open source package libxrk from PyPI, converts your `.xrk` file to a CSV there, and analyzes it there. Your session file is not uploaded to us.

**Links.** Every result ends with a link to rushautoworks.com. The link carries tags (`utm_source`, `utm_medium`, `utm_campaign`, `utm_content`) that tell us which tool the visit came from. If you follow it, the rest of this policy applies to your visit, including the Google Analytics section.

**Retention.** We keep no content from the connectors, so there is nothing to delete or return. **Children.** The connectors are not directed at children. **Questions.** info@rushautoworks.com.
