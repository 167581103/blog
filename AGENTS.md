# AGENTS.md

Guidance for Cursor agents (and humans) working on this personal blog.

## Stack

- Next.js App Router on Vercel (`chenguo2/blog`)
- Auth.js (GitHub OAuth) — any GitHub user may sign in; `ADMIN_GITHUB_USERNAME` can write
- Neon Postgres + Drizzle — articles / home / categories / users / comments
- AWS S3 Access Point — editor media + resume PDF
- Vercel Blob — optional legacy fallback only

## Commands

```bash
npm install
npm run lint          # advisory; known pre-existing hook/display-name debt
npm run typecheck
npm run build
npm run db:push       # needs DATABASE_URL
npm run smoke         # needs SMOKE_BASE_URL
```

Prefer `vercel env pull .env.local` after `vercel link` over hand-copying secrets. Never commit `.env*`.

## Environments

| | Production | Staging |
| --- | --- | --- |
| Git | `main` | `staging` |
| URL | https://www.chenguo.dev | https://staging.chenguo.dev |
| Vercel env target | Production | Preview |
| OAuth | Prod GitHub OAuth App | **Second** OAuth App |
| `AUTH_URL` | `https://www.chenguo.dev` | `https://staging.chenguo.dev` |
| DB | Prod Neon | Neon branch (recommended) |

Flow: feature PR → CI + optional `*.vercel.app` UI smoke → merge/push `staging` → test auth/writes on staging → merge `main`.

Details: [docs/staging.md](docs/staging.md).

## Auth rules (do not break)

1. `AUTH_URL` must be the **origin only** (e.g. `https://staging.chenguo.dev`). Never paste the callback path into `AUTH_URL` — Auth.js will 400/500 on `/api/auth/*`.
2. Staging and production use **separate** GitHub OAuth Apps (one callback URL per App).
3. Do not set `AUTH_REDIRECT_PROXY_URL` for the staging model.
4. Do not put production `AUTH_URL` on Preview.
5. `src/lib/auth.ts` already has `trustHost: true` and URL normalization — keep that.

Staging callback:

`https://staging.chenguo.dev/api/auth/callback/github`

## Storage

| Layer | Holds |
| --- | --- |
| Neon `documents` | Article / home / category / trash JSON |
| Neon users/comments | Auth users + first-party comments |
| S3 | `uploads/…`, `site/resume.pdf` |
| Blob | Legacy / import only |

Without `DATABASE_URL`, public pages may still boot with empty content; writes need Neon. Without S3, uploads fail (Blob only if configured).

## Deploy / CI

- Vercel Git integration owns deploys — do **not** add Actions that `vercel deploy` unless explicitly asked.
- `.github/workflows/ci.yml` gates with typecheck + build (lint is advisory).
- Staging branch deployments use Vercel **Preview** env vars (Hobby has no Custom Environments).

## UI / editor gotchas

- Admin write routes redirect to `/login` without `requireAdmin()`.
- Mobile editor CSS uses `max-width: 640px` against the **browser** viewport, not a nested phone-width div.
- Prefer existing design patterns; do not invent a new visual language on branded surfaces.

## Docs map

| Path | Purpose |
| --- | --- |
| `README.md` | Human overview |
| `docs/staging.md` | Staging + OAuth + DNS checklist |
| `.env.example` | Env var template |
| `.cursor/rules/` | Always-on agent rules |
| `AGENTS.md` | This file |
