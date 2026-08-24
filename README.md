# Tsewa

Open-source operations software for schools and care communities. This repository contains the first self-hosted installation and is the foundation for the future hosted service.

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/Kuntash/tsewa/tree/main/apps/web)

## Workspace

- Vite+ provides the shared package manager, formatter, linter, type checker,
  build commands, and cached workspace tasks.
- `apps/web` — TanStack Start application deployed to Cloudflare Workers.
- `apps/marketing` — public hosted-product site for `gettsewa.com`, deployed as
  a separate static Cloudflare Worker with no SaaS data or service bindings.
- `apps/web/migrations` — versioned D1 schema migrations.
- `packages` — shared packages will be introduced as domain boundaries stabilize.

## Local development

```bash
vp install
cp apps/web/.dev.vars.example apps/web/.dev.vars
vp run setup:hooks
vp run db:migrate:local
vp run dev
```

The tracked pre-commit hook refreshes and stages the Tsewa-only knowledge graph
in `graphify-out/` so each commit carries the graph for the code it contains.

The local app runs at `http://localhost:3000`.

Run the public marketing site separately at `http://localhost:3100`:

```bash
vp run marketing:dev
```

Build or deploy only the marketing Worker with `vp run marketing:build` or
`vp run marketing:deploy`. The deployment targets `gettsewa.com` and
`www.gettsewa.com`; the hosted application remains at `app.gettsewa.com`.

The public site's trust pages, machine-readable discovery files, and brand assets
live with `apps/marketing`. The current pricing, billing, analytics, SEO, and
first-customer hypothesis is documented in
[`docs/marketing-billing-growth-plan.md`](docs/marketing-billing-growth-plan.md).

## Deployment modes

The same codebase supports private, organization-owned installations and the future hosted service.
`gettsewa.com` is the product and pricing site; `app.gettsewa.com` is reserved for hosted SaaS.
See [`docs/deployment-modes.md`](docs/deployment-modes.md) and
[`docs/self-hosting.md`](docs/self-hosting.md).

## THF deployment

The first self-hosted instance is deployed to `https://ths.kunga.dev` as the
`tsewa-self-hosted` Cloudflare Worker. Its custom domain, D1 database, R2
bucket, and required `BETTER_AUTH_SECRET` are declared or managed through
`apps/web/wrangler.ths.jsonc` and Wrangler.

## Cloudflare resources

The first self-hosted instance uses:

- D1: `tsewa-self-hosted-db`
- R2: `tsewa-self-hosted-files`

Apply remote migrations only after reviewing them:

```bash
pnpm db:migrate:ths
```

`BETTER_AUTH_SECRET` is never committed. Add it locally in `.dev.vars`, and set it for a deployed Worker with `wrangler secret put BETTER_AUTH_SECRET`.

Deploy the current THS overlay explicitly:

```sh
pnpm deploy:ths
```

The handover into a THS-owned Cloudflare account is documented in
[`docs/ths-cloudflare-handover.md`](docs/ths-cloudflare-handover.md).

## License

Tsewa is open-source software licensed under the [MIT License](./LICENSE).
