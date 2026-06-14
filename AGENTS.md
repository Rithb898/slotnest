<!-- intent-skills:start -->
## Skill Loading

Before substantial work:
- Skill check: run `pnpm dlx @tanstack/intent@latest list`, or use skills already listed in context.
- Skill guidance: if one local skill clearly matches the task, run `pnpm dlx @tanstack/intent@latest load <package>#<skill>` and follow the returned `SKILL.md`.
- Monorepos: when working across packages, run the skill check from the workspace root and prefer the local skill for the package being changed.
- Multiple matches: prefer the most specific local skill for the package or concern you are changing; load additional skills only when the task spans multiple packages or concerns.
<!-- intent-skills:end -->

<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Corsair

For anything Corsair-related (integrations, OAuth, plugins, Gmail, Google Calendar, webhooks, MCP, the `corsair` SDK), read the relevant file in `docs/corsair/` BEFORE writing code — do not rely on training data. Map:
- `docs/corsair/concepts/` — oauth, multi-tenancy, auth, database, webhooks, hooks, api, permissions, error-handling, typescript, api-key, integrations
- `docs/corsair/plugins/gmail/` and `docs/corsair/plugins/googlecalendar/` — overview, api, database, webhooks, get-credentials
- `docs/corsair/` — introduction, installation, quick-start, openai-agents

If the docs folder does not cover what you need, STOP and tell the user to add the relevant doc file rather than guessing the API.

Don't run `build` and `dev` commands.
