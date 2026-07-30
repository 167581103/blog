# AGENTS.md

## Cursor Cloud specific instructions

Personal blog (Next.js App Router). Public read works without secrets; author write/edit needs GitHub OAuth + `DATABASE_URL` (Neon). Media uploads need S3 (or legacy Blob).

### Commands

- Install: `npm install` (lockfile: `package-lock.json`)
- Dev: `npm run dev` (see `README.md` / `package.json`)
- Lint: `npm run lint` — currently reports pre-existing hook/display-name issues unrelated to the editor bar
- DB schema: after `vercel env pull .env.local`, `npx dotenv -e .env.local -- npm run db:push` (no SQL in update script)
- Env template: `.env.example` → `.env.local`

### Gotchas

- Editor routes (`/articles/new`, `/articles/[slug]/edit`, `/home/edit`) call `requireAdmin()` and redirect to `/login` without an admin session. Style work on the article editor bar needs either a real admin login or a local HTML/CSS fixture under a mobile viewport (`max-width: 640px` media queries bind to the **browser** viewport, not a nested phone-width div).
- Without `DATABASE_URL`, home/articles fall back to empty/default content (app still boots). Writes and comments need Neon.
- Prefer `vercel env pull .env.local --yes` after linking project `blog` (`team_PVtXXoTByw7zywLb9ZGJccku` / `prj_1aYbcb3hA16g2NptetjoFma3rumU`) over hand-copying secrets.
- Giscus was removed in favor of first-party comments; ignore older README fragments that mention Giscus if they reappear in stale docs.
