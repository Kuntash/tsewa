# Tsewa launch, billing, analytics, and growth plan

Last reviewed: 25 August 2026

This document records the current launch hypothesis. Pricing and packaging should
be treated as an experiment until real organisations complete onboarding and pay.

## Recommended commercial model

Keep the public choice simple:

### Hosted Tsewa

- **India launch price:** ₹4,900 per organisation per month, or ₹49,000 per year.
- **Global reference price:** US$79 per month, or US$790 per year.
- Up to 500 active person records.
- All current work areas and reasonable team access included.
- Product updates, hosted infrastructure, standard support, and ordinary exports included.
- 30-day no-card trial beginning when the first organisation is created.
- Assisted historical migration quoted separately after a free data assessment.

For organisations above 500 active people, sell additional 500-person capacity
blocks at ₹2,500 / US$40 per month until usage and support evidence justify a more
formal second tier. Avoid per-seat pricing: Tsewa becomes more valuable when
education, care, programme, and administration teams share the same record.

### Enterprise

Custom price for complex migration, procurement, data controls, contractual
requirements, institution-owned infrastructure, or unusually large deployments.

### Founding-customer offer

Offer the first three suitable organisations:

- ₹2,500 per month for the first 12 months;
- a free record-structure and migration assessment;
- a guided pilot for one programme, school, or residential home;
- direct founder support;
- in return, permission to produce a factual case study and product feedback.

Do not advertise a permanent free plan. The implementation and support burden for
organisational record systems is real, and free tenants would create security and
support obligations without validating willingness to pay.

## Dodo Payments billing architecture

Dodo Payments is a sensible fit because it is a Merchant of Record and provides a
Better Auth adapter, hosted Checkout Sessions, subscription lifecycle webhooks,
and a customer portal.

### Intended customer journey

1. A person creates an account at `app.gettsewa.com`.
2. Better Auth verifies the email address.
3. Guided onboarding creates the organisation and starts a 30-day internal trial.
4. The application shows trial status and a persistent **Activate Hosted Tsewa** action.
5. An authenticated Dodo Checkout Session is created from an allowlisted plan slug.
6. Dodo hosts payment collection and returns the browser to a billing status page.
7. Access changes only after a verified `subscription.active` webhook, never from
   the browser return URL.
8. Renewals, failed payments, cancellation, and expiry update an organisation-level
   subscription record idempotently.
9. Organisation owners use Dodo's customer portal for invoices, payment methods,
   cancellation, and supported plan changes.

### Data model to add

Create organisation-scoped billing tables rather than placing subscription state
on the Better Auth user:

- `organization_subscription`: provider customer and subscription IDs, plan,
  status, trial/period dates, cancellation state, active-person allowance.
- `billing_webhook_event`: unique provider webhook ID, type, received/processed
  timestamps, and safe failure information for idempotency.
- `billing_entitlement`: optional explicit allowances if packaging becomes more
  complex later.

The organisation—not the individual owner—is the customer entitlement boundary.
Ownership can transfer without changing the subscription.

### Integration phases

1. Create test products in Dodo for monthly and annual Hosted Tsewa.
2. Install `dodopayments` and `@dodopayments/better-auth` in the hosted app.
3. Add the Dodo server plugin to existing Better Auth with authenticated checkout,
   portal, and verified webhook features.
4. Add test-only Cloudflare secrets for API and webhook keys.
5. Add billing schema and an organisation billing page.
6. Process lifecycle events: `subscription.active`, `subscription.renewed`,
   `subscription.on_hold`, `subscription.cancelled`, `subscription.failed`, and
   `subscription.expired`.
7. Test duplicate delivery, out-of-order events, failed payment recovery,
   cancellation at period end, and owner transfer.
8. Complete Dodo live-account approval, create live products, configure the live
   webhook endpoint, and run a real low-value end-to-end purchase before launch.

Use Dodo fixed `by_country` pricing for India and a USD base price elsewhere.
Localized prices remain fixed until explicitly changed; they are not live currency
conversion. Add other target-country prices only after demand appears.

## Analytics recommendation

Use **PostHog** for both marketing and product analytics.

Why:

- mature browser and server SDKs;
- funnels, retention, paths, cohorts, experiments, and SQL;
- an official MCP server that can query and create analytics resources from Codex
  and other MCP clients;
- enough free usage for an early-stage product;
- one event model can connect acquisition, onboarding, activation, and billing.

### Privacy rules

Tsewa handles sensitive organisational records, so analytics must be deliberately
narrow:

- disable autocapture in the hosted application;
- do not enable session replay in the hosted application;
- never send person-record IDs, names, emails, health details, document names,
  search strings, form values, or imported source data;
- identify product analytics with internal user and organisation IDs only;
- allow only reviewed properties such as deployment mode, plan, broad organisation
  size band, role group, route name, and success/failure category;
- use consent controls where required and document the provider in the privacy and
  subprocessor materials before enabling collection.

Session replay may be considered on the public marketing site only after masking
and consent review, but it is not needed for launch.

### Initial event dictionary

Marketing:

- `marketing_page_viewed`
- `demo_person_selected`
- `demo_dimension_selected`
- `signup_cta_clicked`
- `enterprise_contact_clicked`
- `trust_page_viewed`

Hosted activation funnel:

- `account_signed_up`
- `email_verified`
- `onboarding_started`
- `organization_created`
- `onboarding_completed`
- `first_person_created`
- `first_team_member_invited`
- `checkout_started`
- `subscription_activated`
- `subscription_on_hold`
- `subscription_cancelled`

The north-star activation signal for the first cohort should be: an organisation
has completed onboarding, added or imported its first real person, and invited a
second team member.

## Search and AI discovery plan

Technical discovery files are necessary but do not create ranking by themselves.
Google's current guidance prioritises original, reliable, people-first content,
including for generative AI results.

### Immediate operational steps

1. Create Google Search Console and Bing Webmaster Tools properties.
2. Verify `gettsewa.com` through DNS and submit `/sitemap.xml`.
3. Inspect the homepage and each trust URL, request indexing, and monitor coverage.
4. Validate JSON-LD with Google's Rich Results Test and Schema.org validator.
5. Monitor Core Web Vitals and crawl errors after every material site release.
6. Keep `llms.txt` concise and factual; update `llms-full.txt` when packaging or
   product scope changes. The format is a community proposal, not a guaranteed
   ranking signal.

### Content that can earn rankings

Publish one strong page at a time, based on first-hand implementation knowledge:

- person-centred records across education and residential care;
- how to preserve historical school and care records during migration;
- a practical data model for one person with several time-bound roles;
- moving from spreadsheets to an organisation-wide people registry;
- managing sponsorship, education, and family relationships without duplicate identities;
- a transparent case study showing reconciled record and document counts, with
  customer permission and all sensitive information removed.

Each page should answer a real procurement or operational question, include
original diagrams or anonymised evidence, link to the relevant product capability,
and be updated only when the substance changes.

### Authority and distribution

- Ask pilot customers and implementation partners to link to the case study.
- Contribute useful migration and record-design material to relevant education,
  care, nonprofit, and open-source communities.
- Create a public product changelog and implementation notes that demonstrate
  sustained expertise.
- Seek listings and partnerships in the actual geographic and sector communities
  Tsewa serves instead of buying generic backlinks.

## First hosted-customer plan

THS is Tsewa's founding pilot and proves the migration and operational model in a
real organisation. With THS's permission, turn that work into an anonymised case
study, a testimonial, and peer introductions. The next commercial milestone is
the first independent organisation paying for hosted SaaS, which is more likely
to come from founder-led outreach than Google.

### Ideal first customer

A mission-driven organisation with 200–2,000 people that combines at least two of:
schooling, residential care, health support, sponsorship, scholarships, or staff
operations—and currently relies on spreadsheets or a fragmented legacy database.

### Four-week motion

Week 1:

- Build a longlist of 60 organisations: 20 reachable through THS, board, donor,
  implementation, or founder relationships; 20 multi-service nonprofits from
  [NGO Darpan](https://www.ngodarpan.gov.in/) and the
  [FCRA public dashboard](https://www.fcraonline.gov.in/public-dashboard); and 20
  residential or multi-campus schools from the
  [CBSE SARAS directory](https://saras.cbse.gov.in/SARAS/AffiliatedList/ListOfSchdirReport).
- Score each organisation out of ten: multi-role service model (2), 200–2,000
  people (2), fragmented or historical records (2), visible change trigger (1),
  reachable operational leader (1), plausible budget (1), and warm path (1).
- Keep the 20 accounts scoring at least seven. Aim for eight warm referrals,
  eight close THS lookalikes, and four adjacent organisations to test the market.
- For each account, identify one operational owner and one executive sponsor;
  do not count an account as a lead until both the fit evidence and a contact path
  are recorded.
- Ask for a 30-minute **record map**, not a software sales call.

Week 2:

- Run five record-map conversations.
- Document current systems, duplicate identities, reporting pain, migration risk,
  decision maker, procurement process, and budget range.
- Show the interactive demo only after understanding their workflow.

Week 3:

- Select one high-fit design partner.
- Import a safe sample or synthetic slice, configure one work area, and agree in
  writing on pilot success criteria.

Week 4:

- Demonstrate the pilot to the actual operational team.
- Ask for a paid founding subscription, implementation permission, testimonial,
  and one peer introduction.

The core offer is not “try another school ERP.” It is: **we will map one person's
real journey across your departments and show where the record currently breaks.**

## Brand and domain recommendation

Keep **Tsewa** and `gettsewa.com` for the current launch. “Tsewa” has a meaningful
association with love, tenderness, and compassion, which fits the person-centred
positioning. The `get` prefix is slightly informal, but it is unlikely to create a
serious misunderstanding once the homepage immediately explains the product.

Do not rename before speaking with customers. Ask every discovery participant:
“What did you think Tsewa was when you first heard the name?” Revisit the domain
only if several target buyers independently find it confusing or unprofessional.

If a future domain change is justified, keep `Tsewa` as the product name and prefer
a neutral modifier such as `usetsewa`, `tsewahq`, or a suitable product TLD. Check
trademark and domain availability before committing.

## Primary references

- Google Search: <https://developers.google.com/search/docs/fundamentals/creating-helpful-content>
- Google AI search guidance: <https://developers.google.com/search/docs/fundamentals/ai-optimization-guide>
- Sitemap guidance: <https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap>
- llms.txt proposal: <https://llmstxt.org/>
- PostHog MCP: <https://posthog.com/docs/product-analytics/surfaces/mcp>
- Dodo Better Auth adapter: <https://docs.dodopayments.com/developer-resources/better-auth-adaptor>
