# SlotNest

SlotNest is the Next.js app in this workspace. Executor work here is verified
with static checks only.

## Workflow

Use `pnpm` and keep changes scoped to the task.

- `pnpm typecheck` runs the repo TypeScript check without emitting files.
- `pnpm test` runs the existing focused `tsx` assertion tests.
- `pnpm verify` runs `typecheck` followed by `test`.

For targeted checks while developing, you can also run an individual test file
directly, for example:

```bash
node --import tsx lib/admin.test.ts
```

`pnpm dev` and `pnpm build` are not part of the supported agent workflow for
this repo.

## Repo Notes

- App code lives in the Next.js app/router structure under the workspace root.
- Static verification is the expected gate before handing work back.
