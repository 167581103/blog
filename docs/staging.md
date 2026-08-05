# Staging & preview test environment

This blog already deploys via **Vercel Git integration**. We do **not** re-implement
deploy in GitHub Actions. Actions only gate merges (lint / typecheck / build).

```
feature branch ──▶ PR
                   ├─ GitHub Actions CI (required)
                   └─ Vercel Preview URL (auto)
                         │  smoke UI / public pages
                         ▼
              merge → staging branch
                   └─ https://staging.<your-domain>
                         │  full auth + write flows
                         ▼
              merge → main
                   └─ https://www.<your-domain>  (production)
```

## Why not “Actions deploys everything”?

Vercel already builds Preview + Production from Git. Duplicating `vercel deploy`
in Actions adds tokens and drift for little gain on a solo blog.

Use Actions for **quality gates**; use Vercel for **runtime environments**.

## Environments

| Env | Git | URL | Auth | Data |
| --- | --- | --- | --- | --- |
| **Production** | `main` | `www.chenguo.dev` | Prod GitHub OAuth App + `AUTH_URL` | Prod Neon + S3 |
| **Staging** | `staging` | `staging.chenguo.dev` | Staging OAuth App **or** redirect proxy | Neon **branch** (not prod) |
| **Preview** | PR branches | `*.vercel.app` | Prefer redirect proxy; skip write tests | Same Preview DB as Staging (Hobby) or Custom Env |

Hobby-plan note: Vercel Preview env vars are shared by all non-production
deployments (PR previews **and** the `staging` branch) unless you add a
[Custom Environment](https://vercel.com/docs/deployments/environments). That is
fine for a personal blog if Staging uses a non-prod Neon branch and you treat
PR write-tests as optional.

---

## One-time setup checklist

### 1. Long-lived `staging` branch

```bash
git checkout main
git pull
git checkout -b staging
git push -u origin staging
```

In GitHub → Settings → Branches:

- Protect `main`: require PR + require CI status check `Lint · typecheck · build`
  (typecheck + build must pass; lint is currently advisory)
- Optionally protect `staging` the same way

### 2. Domain on Vercel

Project → **Domains**:

- `www.chenguo.dev` → Production (`main`)
- `staging.chenguo.dev` → Git branch `staging`

DNS: CNAME `staging` → `cname.vercel-dns.com` (or follow Vercel’s prompt).

### 3. Neon database for Staging / Preview

Do **not** point Preview/Staging at production `DATABASE_URL`.

1. Neon console → create a **branch** from production (e.g. `staging`)
2. Copy that branch connection string
3. In Vercel → Environment Variables → set `DATABASE_URL` for **Preview** only
   to the staging branch URL (Production keeps the prod URL)
4. Push schema once:

```bash
DATABASE_URL='postgresql://…staging…' npm run db:push
```

### 4. Auth (pick one)

GitHub OAuth Apps allow **one** callback URL. Ephemeral `*.vercel.app` URLs
cannot all be registered.

#### Option A — Staging OAuth App (stable URL)

Create a second GitHub OAuth App:

- Homepage: `https://staging.chenguo.dev`
- Callback: `https://staging.chenguo.dev/api/auth/callback/github`

Vercel env (Preview / Staging):

| Var | Value |
| --- | --- |
| `AUTH_GITHUB_ID` / `AUTH_GITHUB_SECRET` | Staging OAuth App |
| `AUTH_SECRET` | New secret (or shared with prod if you also use Option B) |
| `AUTH_URL` | `https://staging.chenguo.dev` **only if** Custom Environment scopes it to `staging`; otherwise **leave unset** on Preview and rely on `trustHost` |

PR Previews still will not share that exact callback — use them for UI smoke;
run login/write tests on `staging.chenguo.dev`.

#### Option B — Auth.js redirect proxy (every Preview can sign in)

Keep the **production** OAuth App callback as:

`https://www.chenguo.dev/api/auth/callback/github`

On **Preview** (and Staging if it uses Preview env):

```bash
# Do NOT set AUTH_URL to production on Preview
AUTH_REDIRECT_PROXY_URL=https://www.chenguo.dev/api/auth
```

Use the **same** `AUTH_SECRET` and GitHub OAuth credentials as Production.
Auth.js completes OAuth on production, then hands the session back to the
Preview host. The app already sets `trustHost: true`.

### 5. S3 / Blob

Reuse the same Access Point for Staging is OK for a personal site. Prefer a
key prefix convention mentally (`uploads/` stays shared) and avoid deleting
prod media from Staging. A separate bucket is optional later.

### 6. CI required check

After the first green run of `.github/workflows/ci.yml`:

GitHub → Settings → Branches → `main` → Require status checks → select
**Lint · typecheck · build**.

---

## Day-to-day workflow

1. Open a PR → wait for **CI** + Vercel Preview
2. Click the Preview link → check public pages / layout
3. If you changed login, editor, or DB writes → merge (or push) to `staging`
   and test on `https://staging.chenguo.dev`
4. Merge `staging` → `main` (or PR `staging` into `main`) for production

Optional smoke against a live URL:

```bash
SMOKE_BASE_URL=https://staging.chenguo.dev npm run smoke
```

---

## What this repo ships

| Path | Role |
| --- | --- |
| `.github/workflows/ci.yml` | Typecheck + build gate on PR / push to `main` & `staging` (lint runs advisory until debt is cleared) |
| `scripts/smoke.mjs` | Cheap HTTP smoke for Staging or a Preview URL |
| `.env.example` | Documents Preview / Staging auth vars |

Manual pieces (Vercel domain, Neon branch, OAuth App, branch protection) stay
in your dashboards — they cannot be fully automated from the app repo alone.
