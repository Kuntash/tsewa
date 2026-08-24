# Tsewa web application

This directory is both the TanStack Start application and the standalone Cloudflare deployment
template. It intentionally contains no dependencies on files outside this directory.

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/Kuntash/tsewa/tree/main/apps/web)

```bash
pnpm install
cp .dev.vars.example .dev.vars
pnpm db:migrate:local
pnpm dev
```

The default `wrangler.jsonc` is a generic self-hosted template. THS production uses the explicit
`wrangler.ths.jsonc` overlay so organization-owned configuration does not leak into product code.

Build the production app with:

```bash
pnpm build
```

## Deploy to Cloudflare Workers

This project uses the Cloudflare Vite plugin (configured in `vite.config.ts`) and `wrangler.jsonc`:

1. Install Wrangler: `npm install -g wrangler`
2. Authenticate: `wrangler login`
3. Deploy: `npx wrangler deploy`

For production env vars, run `wrangler secret put MY_VAR` for each secret listed in `.env.example`. Public (non-secret) vars go in `wrangler.jsonc` under `vars`.

KV, D1, R2, and Durable Object bindings are configured in `wrangler.jsonc` — see https://developers.cloudflare.com/workers/wrangler/configuration/.
