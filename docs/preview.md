# Preview test environment

This blog deploys via **Vercel Git integration**. GitHub Actions only gates
merges (lint / typecheck / build) — it does not redeploy the site.

```
feature branch ──▶ PR
                   ├─ GitHub Actions CI (required)
                   └─ Vercel Preview URL (*.vercel.app)
                         │  smoke UI / public pages
                         ▼
              merge / push → preview branch
                   └─ https://preview.chenguo.dev
                         │  full auth + write flows
                         ▼
              merge → main
                   └─ https://www.chenguo.dev  (production)
```

| Env | Git | URL | Auth | Data |
| --- | --- | --- | --- | --- |
| **Production** | `main` | `www.chenguo.dev` | Prod OAuth + `AUTH_URL` | Prod Neon |
| **Fixed Preview** | `preview` | `preview.chenguo.dev` | Redirect proxy (or second OAuth App) | Neon **branch** (not prod) |
| **PR Preview** | PR branches | `*.vercel.app` | Same Preview env; prefer UI-only tests | Shares Preview `DATABASE_URL` on Hobby |

> Naming: Vercel still calls ephemeral PR URLs “Preview Deployments”. Our fixed
> site is the long-lived **`preview` git branch** + `preview.chenguo.dev`.

---

## Already done in this setup

- [x] Long-lived git branch `preview` (tracks near `main`)
- [x] Vercel domain `preview.chenguo.dev` → git branch `preview`
- [x] Preview env `AUTH_REDIRECT_PROXY_URL=https://www.chenguo.dev/api/auth`
- [x] CI workflow on `main` / `preview` (see `.github/workflows/ci.yml`)

---

## You still need to finish (dashboard)

### 1. DNS (if not green yet)

At your DNS host for `chenguo.dev`, add:

| Type | Name | Value |
| --- | --- | --- |
| CNAME | `preview` | `cname.vercel-dns.com` |

(Use the target Vercel shows under Domains if different.)

### 2. Copy Auth secrets onto **Preview**

Production already has `AUTH_SECRET` / `AUTH_GITHUB_ID` / `AUTH_GITHUB_SECRET`.
Redirect proxy needs the **same** values on Preview.

Vercel → Project → Settings → Environment Variables:

| Key | Action |
| --- | --- |
| `AUTH_SECRET` | Edit → also enable **Preview** (same value as Production) |
| `AUTH_GITHUB_ID` | same |
| `AUTH_GITHUB_SECRET` | same |
| `AUTH_URL` | **Production only** — do **not** set on Preview |
| `AUTH_REDIRECT_PROXY_URL` | already set for Preview |
| `ADMIN_GITHUB_USERNAME` | already on Preview |

Redeploy the `preview` branch after saving.

### 3. Neon database branch (avoid writing prod)

1. Neon Console → create branch `preview` from production
2. Copy that branch connection string
3. Vercel → `DATABASE_URL` → for **Preview**, paste the Neon `preview` URL  
   (Production keeps the prod URL)
4. Push schema once:

```bash
DATABASE_URL='postgresql://…preview…' npm run db:push
```

### 4. GitHub branch protection (optional but recommended)

Protect `main`: require PR + status check **Lint · typecheck · build**.

---

## Day-to-day

1. Open a PR → CI + Vercel `*.vercel.app` for layout/public smoke
2. Merge or push to `preview` → test login / editor on https://preview.chenguo.dev
3. Merge to `main` → production

```bash
SMOKE_BASE_URL=https://preview.chenguo.dev npm run smoke
```

### Keep `preview` close to `main`

```bash
git checkout preview
git merge main
git push origin preview
```

---

## Auth note

GitHub OAuth Apps allow one callback URL. Production keeps:

`https://www.chenguo.dev/api/auth/callback/github`

Preview uses Auth.js **redirect proxy** so `preview.chenguo.dev` (and PR
`*.vercel.app`) can sign in without a second OAuth App. Requires matching
`AUTH_SECRET` + GitHub credentials on Preview, and **no** production `AUTH_URL`
on Preview (`trustHost` is already enabled in `src/lib/auth.ts`).
