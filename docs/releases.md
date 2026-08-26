# Tsewa releases

`Kuntash/tsewa` is the canonical product repository. Hosted Tsewa and private self-hosted
installations consume the same immutable releases so product fixes are not stranded in customer
forks.

## Release contract

- Release tags use semantic versions such as `v0.2.0`.
- A tag is created only from validated `main`.
- D1 migrations are forward-only and remain in `apps/web/migrations`.
- Release notes call out migrations, configuration changes, and required smoke tests.
- Installation-specific configuration never lands in the public repository.

Push a release tag after updating the package version and release notes:

```sh
pnpm ready
git tag -s v0.2.0 -m "Tsewa v0.2.0"
git push origin v0.2.0
```

The release workflow validates the tag and publishes generated GitHub release notes. If validation
fails, delete the local tag, fix `main`, and create a new version; never move a published tag.

## Downstream installations

A private installation repository contains the full product source plus only its deployment
overlay, `DEPLOYMENT.md`, and `UPSTREAM_VERSION`. It has two remotes:

```text
origin    private installation repository
upstream  canonical Kuntash/tsewa repository
```

Upgrade only to a reviewed release tag. Back up D1 and R2 first, merge the tag, update
`UPSTREAM_VERSION`, validate, apply migrations, deploy, and smoke-test. Product code changes must be
made in canonical Tsewa and released before the installation consumes them.
