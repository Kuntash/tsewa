# Self-hosting Tsewa on Cloudflare

The supported self-hosted shape is a private installation in the organization's own Cloudflare
account. Cloudflare owns the infrastructure runtime; the school owns the account, Worker, D1
database, R2 bucket, domain, secrets, backups, and operational access.

## One-click deployment

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/Kuntash/tsewa/tree/main/apps/web)

Cloudflare's deployment flow clones Tsewa into the deployer's Git account, provisions the declared
D1 and R2 resources, binds them to the Worker, and configures Workers Builds. Its setup form exposes
the organization name, slug, locale, timezone, Worker name, database name, bucket name, sender, and
authentication secret; replace every default with installation-owned values.

The first deployment uses a `workers.dev` address and can bootstrap its first owner without email.
Finish these steps immediately afterward:

1. Add a domain owned by the organization and set the same HTTPS origin as `PUBLIC_APP_URL`.
2. Onboard the sending domain, add an `EMAIL` send binding to the fork's Wrangler configuration,
   and restrict it to the verified sender. The generic template deliberately omits this binding
   because Cloudflare cannot provision an organization's sending domain from a deploy button.
3. Test invitation, verification, and password-recovery delivery.
4. Upload the organization logo under **Settings → General**.
5. Configure independent D1 and R2 backups.

The deploy button automates the supported Cloudflare resources, but Cloudflare cannot prove domain
ownership or onboard an email-sending domain on the school's behalf. Those remain deliberate
account-owner steps.

## Manual and downstream deployment

For an audited installation repository, copy the generic configuration, replace every example, and
add the verified `EMAIL` binding before running the configuration check:

```sh
cp apps/web/wrangler.jsonc apps/web/wrangler.self-hosted.jsonc
pnpm install --frozen-lockfile
pnpm self-host:check
pnpm db:migrate:self-hosted
pnpm deploy:self-hosted
```

Set `BETTER_AUTH_SECRET` interactively. Never commit it or reuse it across installations:

```sh
pnpm --dir apps/web exec wrangler secret put BETTER_AUTH_SECRET \
  --config wrangler.self-hosted.jsonc
```

The installation repository should contain only its Wrangler overlay and private operational
notes. Generic product changes must land upstream in Tsewa and arrive through reviewed releases.

## Backups and upgrades

Before every upgrade, record the deployed Tsewa commit and Worker version, export D1, and copy the
private R2 bucket to separately controlled storage:

```sh
mkdir -p backups
pnpm --dir apps/web exec wrangler d1 export DB --remote \
  --config wrangler.self-hosted.jsonc \
  --output ../../backups/tsewa-before-upgrade.sql
pnpm --dir apps/web exec wrangler versions list \
  --config wrangler.self-hosted.jsonc
```

D1 export does not include R2. Use an S3-compatible sync tool for `FILES`, retain at least one copy
outside the production account, and rehearse restoring both resources into disposable targets.
Cloudflare D1 Time Travel is useful for short recovery windows, but it is not a substitute for a
portable, independently held backup.

Apply releases in this order: backup, validate the configuration, migrate D1, deploy the Worker,
then smoke-test authentication, files, email, and the main directories. Worker rollback does not
reverse a database migration.
