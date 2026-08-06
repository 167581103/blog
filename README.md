# Blog

Personal blog — read publicly; sign in with GitHub to comment; the owner account can write.

## Stack

- Next.js (App Router) on Vercel
- Auth.js (GitHub OAuth) — any GitHub user can sign in; admin-only write gates
- Neon Postgres + Drizzle for article/home/category documents, users, comments
- AWS S3 (Access Point) for editor media uploads and the resume PDF
- Vercel Blob kept as an optional legacy fallback / one-shot JSON import
- TipTap markdown editor with paste/drop image upload

## Storage model

| Layer | Holds |
| --- | --- |
| Neon Postgres | `documents` (home / article / category / trash JSON, keyed by logical path), `users`, `comments`, plus reserved `tags` / `article_tags` / `annotations` |
| AWS S3 | Editor uploads (`uploads/…`) and resume PDF (`site/resume.pdf`) via an Access Point |
| Vercel Blob | Optional legacy fallback for media; one-shot `POST /api/admin/import-blob` to pull old JSON into Postgres |

Set `S3_ACCESS_POINT_ARN`, `AWS_REGION`, and IAM credentials on Vercel. Without
`S3_PUBLIC_BASE_URL`, uploaded files are served through `/api/media/...` so the
Access Point can stay private. Point `S3_PUBLIC_BASE_URL` at CloudFront (or any
public origin) when you want CDN URLs in article HTML.

## Pages

| Route | Purpose |
| --- | --- |
| `/` | Home (editable when signed in as admin) |
| `/articles/[slug]` | Read + comments |
| `/articles/new` · `/articles/[slug]/edit` | Write (admin) |
| `/login` | GitHub sign-in (comment or write) |
| `/home/edit` | Edit home content (admin) |

## Deploy on Vercel

1. Import this repo in Vercel.
2. Add a **public** Blob store and connect it (see previous Blob notes / `BLOB_READ_WRITE_TOKEN`).
3. Add **Neon** from the Vercel Marketplace and connect it to this project (injects `DATABASE_URL`).
4. Create a GitHub OAuth App:
   - Homepage: your site URL
   - Callback: `https://<your-domain>/api/auth/callback/github`
5. Set environment variables (see `.env.example`):
   - `AUTH_SECRET`, `AUTH_GITHUB_ID`, `AUTH_GITHUB_SECRET`
   - `ADMIN_GITHUB_USERNAME`
   - `AUTH_URL` — full `https://…` URL
   - Blob + `DATABASE_URL` (from integrations)
6. **Push schema** (required once after connecting Neon — otherwise article
   pages error with `relation "comments" does not exist`):

```bash
npm install
vercel env pull .env.local
npx dotenv -e .env.local -- npm run db:push
```

Or open the Neon SQL Editor and run `drizzle/init.sql`.

### Comments

Published articles show a **Comments** block under the body. Visitors use the same `/login` GitHub session — no second Giscus login.

## Local development

```bash
cp .env.example .env.local
# fill Auth + Blob + DATABASE_URL, then:
npm install
npm run db:push
npm run dev
```

## Preview & CI

Merge flow: **PR → Vercel `*.vercel.app` + GitHub Actions CI → `preview` → `main`**.

- GitHub Actions (`.github/workflows/ci.yml`) runs lint, typecheck, and build. Prefer requiring that check on `main`.
- Vercel owns deploys. Fixed test site: **`https://preview.chenguo.dev`** (git branch `preview`).
- Login on the fixed preview uses `AUTH_REDIRECT_PROXY_URL` (see guide). Do not set production `AUTH_URL` on Preview.

Full checklist: [docs/preview.md](docs/preview.md).

```bash
SMOKE_BASE_URL=https://preview.chenguo.dev npm run smoke
```

## Author tips

- Home: pencil / plus icons appear only for the admin account.
- Editor: paste or drop images/videos to upload.
- `⌘/Ctrl + S` saves a draft; the check icon releases (publishes).
- On a published article, click the title (while admin) to edit.
