# Blog

Personal blog — read publicly, write when signed in with the owner GitHub account, comment via GitHub Discussions (Giscus).

## Stack

- Next.js (App Router) on Vercel
- Auth.js (GitHub OAuth) for the author
- Vercel Blob for articles and media
- TipTap markdown editor with paste/drop image upload
- Giscus for visitor comments

## Pages

| Route | Purpose |
| --- | --- |
| `/` | Home (editable when signed in) |
| `/articles/[slug]` | Read — back, title, share |
| `/articles/new` · `/articles/[slug]/edit` | Write — title + editor |
| `/login` | Author GitHub sign-in |
| `/home/edit` | Edit home content |

## Deploy on Vercel

1. Import this repo in Vercel.
2. Add a **public** Blob store (Storage → Blob) and connect it to this project.
   - Store access must be **Public** (not Private).
   - Most reliable: Blob store → **Settings → Tokens** → create a read-write token → set env `BLOB_READ_WRITE_TOKEN` for Production + Preview → Redeploy.
   - Or use OIDC (`BLOB_STORE_ID` / `blog_STORE_ID`). Remove any old token from a disconnected/private store first.
3. Create a GitHub OAuth App:
   - Homepage: your Vercel URL
   - Callback: `https://<your-domain>/api/auth/callback/github`
4. Set environment variables (see `.env.example`):
   - `AUTH_SECRET` — `openssl rand -base64 32`
   - `AUTH_GITHUB_ID` / `AUTH_GITHUB_SECRET`
   - `ADMIN_GITHUB_USERNAME` — `167581103`
   - `AUTH_URL` — production URL
   - Blob token (auto if linked)
   - Giscus public vars
5. Deploy.

### Giscus comments

1. Enable **Discussions** on the GitHub repo.
2. Open [giscus.app](https://giscus.app), select the repo/category, copy the IDs into:
   - `NEXT_PUBLIC_GISCUS_REPO`
   - `NEXT_PUBLIC_GISCUS_REPO_ID`
   - `NEXT_PUBLIC_GISCUS_CATEGORY`
   - `NEXT_PUBLIC_GISCUS_CATEGORY_ID`

Visitors sign in with GitHub through Giscus to comment.

## Local development

```bash
cp .env.example .env.local
# fill values, then:
npm install
npm run dev
```

## Author tips

- Home: pencil / plus icons appear only when signed in.
- Editor: paste or drop images/videos to upload.
- `⌘/Ctrl + S` saves a draft; the check icon releases (publishes).
- On a published article, click the title (while signed in) to edit.
