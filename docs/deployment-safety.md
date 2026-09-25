# Academy deployment safety

## Ownership map

| Surface | Owner | Deployment target |
| --- | --- | --- |
| `academy.hangdoiproduction.com` | Hang Đôi Academy | `hangdoivn/hangdoi_academy` → `gh-pages` |
| `hangdoistudio.vn` | Hang Đôi Production | Production VPS `72.60.108.22` |
| `www.hangdoistudio.vn` | Hang Đôi Production | Production VPS `72.60.108.22` |

The Academy repository does not own the Production root domains.

## Safe Academy release flow

```text
Academy main
  → build _site
  → assert CNAME = academy.hangdoiproduction.com
  → publish _site to gh-pages
  → verify Academy live
  → verify Production root remains live
```

The repository must not contain a second deployment path that copies `gh-pages` or `_site` into Hostinger `public_html`, the Production VPS, or any document root serving `hangdoistudio.vn`.

## Pre-deploy commands

```bash
git remote -v
git status --short --branch
rg -n "academy\.hangdoistudio\.vn" .
rg -n "HOSTINGER_API_TOKEN|public_html|72\.60\.108\.22" .github/workflows
```

The first two commands must identify the Academy repository and an expected branch. The two searches must return no active legacy-domain or cross-host deployment configuration.

## Post-deploy verification

```bash
curl -fsSL https://academy.hangdoiproduction.com/ | grep -F "Hang Đôi Academy"
curl -fsSL https://hangdoistudio.vn/ | grep -F "Hang Đôi Production"
```

If the Academy deploy succeeds but the Production verification fails, stop all further deploys and treat it as an infrastructure incident. Do not change Production DNS from this repository.

## Historical failure mode

The Academy `gh-pages` artifact was previously served from the same Hostinger webroot as `hangdoistudio.vn`. Any Academy publish therefore replaced the Production homepage. The Production root domains now resolve to the isolated Production VPS, and the CI boundary check below prevents legacy deployment settings from returning unnoticed.


## Build trigger scope

The static Pages pipeline intentionally does **not** rebuild for backend-only or documentation-only changes.

Ignored push paths include:

- `api/**`
- `docs/**`
- `AGENTS.md`
- API/ops-only workflow files

This avoids unnecessary Google Drive image downloads, duplicate `gh-pages` publishes, and deployment-boundary churn when only the Candidate API or runbooks change.

A commit that changes any static-site source outside those ignored paths still triggers the normal Pages build and post-publish boundary verification.
