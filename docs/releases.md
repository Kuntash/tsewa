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

Every push to `main` now runs `.github/workflows/release.yml`. The workflow validates the exact
commit, deploys hosted Tsewa, creates the next patch tag when the commit is not already tagged,
publishes an idempotent GitHub release, and dispatches that immutable tag to `Kuntash/tsewa-ths`.
Re-running the workflow reuses the existing tag and release rather than failing with a duplicate
release error.

The `hosted-production` GitHub environment requires:

- repository variable `CLOUDFLARE_ACCOUNT_ID`;
- repository secret `CLOUDFLARE_API_TOKEN`, scoped to deploy the hosted Worker and migrate its D1
  database; and
- repository secret `THS_REPO_TOKEN`, a fine-grained token allowed to send repository dispatches
  to `Kuntash/tsewa-ths`.

Do not create a GitHub release manually for a commit that the workflow is processing. Published
tags remain immutable and must never be moved.

## Downstream installations

A private installation repository contains the full product source plus only its deployment
overlay, `DEPLOYMENT.md`, and `UPSTREAM_VERSION`. It has two remotes:

```text
origin    private installation repository
upstream  canonical Kuntash/tsewa repository
```

The THS repository listens for the canonical `upstream-release` dispatch. It verifies that the tag
resolves to the dispatched canonical commit, merges it through `scripts/upgrade-upstream.sh`,
validates the private overlay, exports D1 as a workflow artifact, applies migrations, deploys, and
smoke-tests `ths.kunga.dev`. It pushes the resulting upgrade commit to private `main` only after the
deployment succeeds. The workflow can also be run manually with a specific release tag.

The `ths-production` GitHub environment requires its own `CLOUDFLARE_ACCOUNT_ID` variable and
`CLOUDFLARE_API_TOKEN` secret. Product code changes must still be made in canonical Tsewa and
released before an installation consumes them. R2 objects are not rewritten by this release path;
take a separate R2 copy before any release that includes an explicit object migration.
