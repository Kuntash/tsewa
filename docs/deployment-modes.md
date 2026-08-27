# Tsewa deployment modes

Tsewa ships one application with two deployment policies. Organization identity belongs in
runtime configuration and organization records, never in product branches or conditional UI.

## Self-hosted

`DEPLOYMENT_MODE=self-hosted` is one private installation owned by one school or care
organization. It uses a dedicated Worker, D1 database, R2 bucket, authentication secret, email
sender, and domain. The first account may bootstrap the configured organization; after that,
additional accounts join only through invitations. Billing and public signup are disabled.
The billing settings entry is omitted, direct billing settings links redirect to General, billing
API and webhook routes return `404`, and billing entitlements are not evaluated. These behaviors
are derived from deployment policy; installation repositories do not remove or fork the feature.

The installation is private and sends `noindex` and private-cache response headers. Its anonymous
sign-in screen reads the configured organization name and title, then uses the organization logo
stored in its own R2 bucket once one has been uploaded.

## Hosted

`DEPLOYMENT_MODE=hosted` powers the multi-tenant service at `app.gettsewa.com`. It requires
`PUBLIC_APP_URL=https://app.gettsewa.com`, rejects default
organization settings, and exposes hosted capabilities to the application. A new account must
verify its email before it can create an organization, academic session, first school, class
structure, and owner membership. Billing enforcement remains a separate commercial-control slice.

Hosted verification, invitations, and password recovery require an Email Sending domain onboarded
in Cloudflare and an `EMAIL` binding restricted to the configured transactional sender.

The public product and pricing site belongs at `gettsewa.com`, separate from authenticated
application traffic.

## Runtime contract

Application code consumes semantic policy from `src/lib/deployment.ts`. The raw environment
variable must not be checked throughout components and handlers.

| Capability                           | Hosted                    | Self-hosted                     |
| ------------------------------------ | ------------------------- | ------------------------------- |
| First-owner bootstrap                | no                        | yes                             |
| Public signup                        | verified-email onboarding | no                              |
| Billing policy                       | required                  | none                            |
| Multiple organizations               | yes                       | no                              |
| Email verification for direct signup | yes                       | no first-owner email dependency |

Self-hosted owner bootstrap does not require transactional email, so a fresh one-click deployment
can be opened before the deployer finishes domain and sender verification. Invitations, password
recovery, and later verification still require a working `EMAIL` binding and verified sender.
