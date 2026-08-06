# Staging environment (`staging.chenguo.dev`)

Fixed pre-production site with **its own GitHub OAuth callback** — not a
redirect proxy through production.

```
feature PR ──▶ CI + optional *.vercel.app (UI smoke only)
                 │
                 ▼
        merge / push → staging
                 └─ https://staging.chenguo.dev
                    own AUTH_URL + own OAuth App + Neon branch
                 │
                 ▼
              merge → main
                 └─ https://www.chenguo.dev
```

| | Production | Staging |
| --- | --- | --- |
| Git | `main` | `staging` |
| URL | `www.chenguo.dev` | `staging.chenguo.dev` |
| OAuth App | Prod callback | **Second** App → staging callback |
| `AUTH_URL` | `https://www.chenguo.dev` | `https://staging.chenguo.dev` |
| DB | Prod Neon | Neon **branch** `staging` |

Hobby note: Vercel **Preview** env vars are shared by the `staging` branch and
PR `*.vercel.app` deployments (Custom Environments need a higher plan). Put
staging Auth on **Preview**, and treat PR URLs as UI-only — do login tests on
`staging.chenguo.dev`.

---

## Already wired

- [x] Git branch `staging`
- [x] Vercel domain `staging.chenguo.dev` → branch `staging`
- [x] CI runs on `main` / `staging`

---

## Finish setup (you)

### 1. DNS (Cloudflare)

| Type | Name | Target | Proxy |
| --- | --- | --- | --- |
| CNAME | `staging` | `9e6efb97d0c2c468.vercel-dns-017.com` | DNS only |

(Alternate target Vercel accepts: `cname.vercel-dns.com`.)

### 2. Second GitHub OAuth App

GitHub → Settings → Developer settings → **OAuth Apps → New**:

| Field | Value |
| --- | --- |
| Application name | `blog staging` |
| Homepage URL | `https://staging.chenguo.dev` |
| Authorization callback URL | `https://staging.chenguo.dev/api/auth/callback/github` |

Copy Client ID + generate Client Secret.

### 3. Vercel env vars for **Preview** (staging branch uses these)

Project → Settings → Environment Variables.

| Key | Preview value | Notes |
| --- | --- | --- |
| `AUTH_URL` | `https://staging.chenguo.dev` | Preview only — **not** Production |
| `AUTH_GITHUB_ID` | staging OAuth Client ID | Preview only |
| `AUTH_GITHUB_SECRET` | staging OAuth secret | Preview only |
| `AUTH_SECRET` | `openssl rand -base64 32` | New secret OK; Preview only |
| `ADMIN_GITHUB_USERNAME` | `167581103` | already ok if shared |
| `DATABASE_URL` | Neon **staging** branch URL | Preview only; Production keeps prod |
| `S3_*` / `AWS_*` | can share prod for now | optional later split |

Production keeps the original OAuth App + `AUTH_URL=https://www.chenguo.dev`.

After saving: **Redeploy** the `staging` deployment.

### 4. Neon staging database

1. Neon → Branch → create `staging` from production  
2. Copy connection string into Preview `DATABASE_URL`  
3. `DATABASE_URL='…staging…' npm run db:push`

---

## Daily flow

```bash
# land work on staging first
git checkout staging
git merge your-feature   # or merge the PR into staging
git push origin staging
# test https://staging.chenguo.dev (sign-in, write, upload)
# then PR staging → main (or merge feature to main after staging OK)
```

```bash
SMOKE_BASE_URL=https://staging.chenguo.dev npm run smoke
```

Why a second OAuth App? GitHub allows **one** callback URL per App. Staging’s
callback is `staging.chenguo.dev/...`, production’s is `www.chenguo.dev/...` —
they cannot share one App cleanly.
