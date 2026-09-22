# Hang Đôi Academy deployment contract

This repository is `hangdoivn/hangdoi_academy` and owns only the Hang Đôi Academy website and its Academy-specific services.

## Canonical deployment

- Source branch: `main`
- Published branch: `gh-pages`
- Canonical public host: `academy.hangdoiproduction.com`
- Media Career Program: `https://academy.hangdoiproduction.com/media-career-program/`
- GitHub Pages `CNAME` must be exactly `academy.hangdoiproduction.com`.

## Hard isolation boundary

Academy work must never deploy to, change DNS for, redirect, proxy, or write files into:

- `hangdoistudio.vn`
- `www.hangdoistudio.vn`
- the Production VPS or its Nginx configuration
- the former Hostinger `public_html` used by the root Production domain

`hangdoistudio.vn` and `www.hangdoistudio.vn` are Production-owned and resolve to `72.60.108.22`. They are not aliases of Academy.

Do not add Hostinger DNS/API credentials, FTP/SFTP/rsync/SCP deployment, `public_html` deployment, or Production VPS deployment to this repository. A task that explicitly requires changes to the Production domain must be handled separately in the Production/infra repositories, with an isolated preflight and verification.

## Required checks for every Academy deploy

1. Confirm the intended repository is `hangdoivn/hangdoi_academy`.
2. Confirm `_site/CNAME` is exactly `academy.hangdoiproduction.com`.
3. Confirm generated canonical, Open Graph, sitemap, form, admin, and selection URLs use `academy.hangdoiproduction.com`.
4. Publish only the `_site` artifact to `gh-pages`.
5. Verify `https://academy.hangdoiproduction.com/` returns Hang Đôi Academy.
6. Verify `https://hangdoistudio.vn/` still returns Hang Đôi Production.

Read `docs/deployment-safety.md` before changing deployment, domains, DNS, hosting, CNAME, or GitHub Actions.
