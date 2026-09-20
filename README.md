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
The workflow uses the runner’s Chrome under Xvfb for `satorinet.io` JSON requests;
ordinary HTTP requests from hosted runners receive Cloudflare challenges. Audit
requests to `network.satorinet.io` continue using the existing HTTP transport.
Chrome is only used by the warmer, never by the deployed Next.js app.

Select `diagnostics_only` for a read-only comparison of curl, native fetch, Impit,
and Chrome from the GitHub runner. This skips warming and does not use Redis credentials;
a successful diagnostic run means the probes completed, not that access succeeded.
Inspect each probe's HTTP status and `validPrice` result. Run the same probes locally
with `pnpm exec tsx scripts/diagnose-satori.ts`. To enable browser-backed warming
locally, set `SATORI_BROWSER_EXECUTABLE_PATH` to your installed Chrome executable;
on Linux, run under a display or `xvfb-run -a`. Without that setting, local runs
keep using the direct HTTP transport.

## Tooling compatibility

ESLint 9 and TypeScript 6 are intentional: the current Next.js lint stack's
`eslint-plugin-react` does not support ESLint 10, and `typescript-eslint` requires
TypeScript below 6.1. Upgrade those two when their peer ranges support it.
Project skills are installed from upstream using `npx skills add`, with sources
tracked in `skills-lock.json`.
