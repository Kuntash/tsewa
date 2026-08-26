# Tsewa

Open-source operations software for schools and care communities. This is the canonical product
repository for the hosted service at `gettsewa.com` and for versioned self-hosted releases.

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

## Releases and private installations

Canonical releases are Git tags beginning with `v`. Organisation-specific domains, Cloudflare
resource IDs, operational notes, and tracked deployment overlays belong in private downstream
repositories, not here. Product fixes land in this repository first and are then consumed by each
installation from a reviewed release tag.

See [`docs/releases.md`](docs/releases.md) for the release contract and
[`docs/self-hosting.md`](docs/self-hosting.md) for the downstream upgrade runbook.

Hosted organisation subscriptions and the Dodo test/live boundary are documented in
[`docs/hosted-billing.md`](docs/hosted-billing.md).

## License

Tsewa is open-source software licensed under the [MIT License](./LICENSE).
