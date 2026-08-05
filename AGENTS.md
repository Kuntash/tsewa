<!-- VITE PLUS START -->

# Vite+ workspace

This monorepo uses Vite+, a unified toolchain built on Vite, Rolldown,
Vitest, Oxlint, Oxfmt, and Vite Task. Use the `vp` command surface for
installation, validation, development, builds, tests, and workspace tasks.

- Install dependencies with `vp install`.
- Run the THF app with `vp run @tsewa/web#dev`.
- Validate the workspace with `vp check` and `vp run -r build`.
- Use package-qualified tasks such as `vp run @tsewa/web#deploy`.
- Keep shared lint, formatting, staged-file, and task settings in the root
  `vite.config.ts`.

<!-- VITE PLUS END -->

## Application architecture

- `apps/web` is a TanStack Start application deployed to Cloudflare Workers.
- D1 migrations live in `apps/web/migrations` and remain versioned.
- Domain tables must be scoped by `organization_id`.
- Keep Cloudflare bindings and the custom domain in `apps/web/wrangler.jsonc`.
- Never commit `.dev.vars`, `.env`, or production secrets.
