# satorinet-viz

- [Join Satori](https://satorinet.io/download/EexETc7BJgVqRyCm6VXgLN1aEhWZsRx16m)

## Development

Use Node.js 24 LTS and the pnpm version pinned in `package.json`.

```sh
pnpm install --frozen-lockfile
pnpm dev
```

Set `DATABASE_URL`, `REDIS_URL`, and `LIVECOINWATCH_API_KEY` in `.env.local`.
Never commit credentials. PostgreSQL and Redis must be reachable by the app.

## Checks

```sh
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

## Scheduled cache warming

The **Warm Satori cache** workflow needs a repository Actions secret named
`REDIS_URL`, pointing to the same Redis instance used by the deployment. A local
`.env.local` or a Vercel environment variable does not configure GitHub Actions.
Use a Redis endpoint reachable from GitHub-hosted runners, with TLS when required.

The workflow runs every two hours and can also be dispatched manually. Its optional
`backfill_since` input accepts `YYYY-MM-DD` (earliest `2025-12-25`). A successful
warm run supplies cached data when Satorinet blocks requests from the deployment.
Browser headers do not guarantee passage through a Cloudflare challenge.

## Tooling compatibility

ESLint 9 and TypeScript 6 are intentional: the current Next.js lint stack's
`eslint-plugin-react` does not support ESLint 10, and `typescript-eslint` requires
TypeScript below 6.1. Upgrade those two when their peer ranges support it.
Project skills are installed from upstream using `npx skills add`, with sources
tracked in `skills-lock.json`.
