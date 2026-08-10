# Tsewa

Open-source operations software for schools and care communities. This repository contains the first self-hosted installation and is the foundation for the future hosted service.

## Workspace

- Vite+ provides the shared package manager, formatter, linter, type checker,
  build commands, and cached workspace tasks.
- `apps/web` — TanStack Start application deployed to Cloudflare Workers.
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

## THF deployment

The first self-hosted instance is deployed to `https://ths.kunga.dev` as the
`tsewa-self-hosted` Cloudflare Worker. Its custom domain, D1 database, R2
bucket, and required `BETTER_AUTH_SECRET` are declared or managed through
`apps/web/wrangler.jsonc` and Wrangler.

## Cloudflare resources

The first self-hosted instance uses:

- D1: `tsewa-self-hosted-db`
- R2: `tsewa-self-hosted-files`

Apply remote migrations only after reviewing them:

```bash
vp run db:migrate:remote
```

`BETTER_AUTH_SECRET` is never committed. Add it locally in `.dev.vars`, and set it for a deployed Worker with `wrangler secret put BETTER_AUTH_SECRET`.

## License

Tsewa is open-source software licensed under the [MIT License](./LICENSE).
