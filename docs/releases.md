# Tsewa releases

`Kuntash/tsewa` is the canonical product repository. Hosted Tsewa and private self-hosted
installations consume the same immutable releases so product fixes are not stranded in customer
forks.

## Automated release contract

- Release tags use semantic versions such as `v0.2.0`.
- A tag is created only from validated `main`.
- D1 migrations are forward-only and remain in `apps/web/migrations`.
- Release notes call out migrations, configuration changes, and required smoke tests.
- Installation-specific configuration never lands in the public repository.

Every push to `main` runs `.github/workflows/release.yml`. The workflow validates the exact commit,
creates the next patch tag when the commit is not already tagged, and publishes an idempotent
GitHub release. Re-running the workflow reuses the existing tag and release rather than failing
with a duplicate release error. It does not deploy either installation and requires no deployment
credentials.

Do not create a GitHub release manually for a commit that the workflow is processing. Published
tags remain immutable and must never be moved.

## Downstream installations

A private installation repository contains the full product source plus only its deployment
overlay, `DEPLOYMENT.md`, and `UPSTREAM_VERSION`. It has two remotes:

```text
origin    private installation repository
upstream  canonical Kuntash/tsewa repository
```

The THS repository polls canonical `main` every five minutes and can also be synced manually. When
the canonical commit changes, it merges that exact commit through `scripts/upgrade-upstream.sh`,
runs `pnpm ready` and `pnpm self-host:check`, and pushes the validated merge to private `main`.
This source-sync workflow does not access Cloudflare, migrate data, or deploy either installation,
so it requires no repository secrets. Product code changes must still be made in canonical Tsewa;
THS-only deployment configuration remains in the private overlay.
