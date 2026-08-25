import { ArrowLeft, ArrowRight, Check, CircleAlert, Mail, ShieldCheck } from "lucide-react";
import { useEffect } from "react";

import { TsewaMonogram } from "./TsewaMonogram";

type TrustPageKey = "privacy" | "terms" | "security" | "data-processing";

type TrustSection = {
  title: string;
  paragraphs?: string[];
  bullets?: string[];
};

type TrustPage = {
  description: string;
  eyebrow: string;
  intro: string;
  sections: TrustSection[];
  title: string;
};

const contactEmail = "kunga@gettsewa.com";
const updated = "25 August 2026";

const trustPages: Record<TrustPageKey, TrustPage> = {
  privacy: {
    eyebrow: "Privacy",
    title: "Privacy, explained plainly.",
    description:
      "How Tsewa handles information on its public website and hosted person-centred management service.",
    intro:
      "This notice describes the information Tsewa receives, why it is used, and the choices available to visitors, account holders, and organisations using the hosted service.",
    sections: [
      {
        title: "Who controls the information",
        paragraphs: [
          "For the public website, account administration, service communications, and billing, Tsewa determines why and how relevant personal information is used.",
          "For records an organisation enters into the hosted platform about students, residents, patients, staff, families, sponsors, or other people, that organisation is normally the data controller and Tsewa acts as its service provider or processor.",
        ],
      },
      {
        title: "Information we receive",
        bullets: [
          "Website enquiry details, such as an email address and message, only when you choose to contact us.",
          "Cookieless public-site analytics from Cloudflare and, when enabled, PostHog: page-performance measurements and reviewed event counts such as demo dimension and call-to-action interactions, plus coarse browser and referral information with URL queries removed.",
          "Account information, including name, work email, authentication records, organisation membership, and account preferences.",
          "Service data entered or imported by a customer organisation, according to its configuration and instructions.",
          "Operational records needed to secure and maintain the service, including access, audit, delivery, and diagnostic events.",
          "Subscription and invoice references from our payment provider. Tsewa does not need to store complete card details.",
        ],
      },
      {
        title: "How information is used",
        bullets: [
          "Provide, secure, maintain, and improve the hosted service.",
          "Create accounts, verify email addresses, support onboarding, and respond to requests.",
          "Process subscriptions, prevent fraud, and maintain financial records.",
          "Diagnose failures, monitor reliability, and keep an auditable history of important actions.",
          "Meet legal obligations and protect the rights, safety, and integrity of customers and the service.",
        ],
      },
      {
        title: "Service providers and international processing",
        paragraphs: [
          "Tsewa uses specialist providers for cloud infrastructure, email delivery, and—when billing is enabled—payment processing. They receive only the information needed to perform their service and are subject to their own security and contractual commitments.",
          "Providers may process information in more than one country. Customer-specific residency or institution-owned infrastructure requirements are considered through the Enterprise tier.",
        ],
      },
      {
        title: "Retention and deletion",
        paragraphs: [
          "Account, security, and billing records are kept for as long as needed to provide the service, maintain legitimate operational records, and meet legal obligations. Customer service data is retained according to the customer agreement and the organisation’s instructions.",
          "Requests about a record held by a customer organisation should normally be directed to that organisation first. We support customers in responding where required.",
        ],
      },
      {
        title: "Your choices",
        paragraphs: [
          "Public-site analytics use no cookies or persistent browser storage. Cloudflare measures aggregate traffic and performance; the optional PostHog integration is limited to named events. PostHog autocapture, session replay, heatmaps, form capture, and person profiles are disabled, and supported Do Not Track signals are respected.",
          `To ask about access, correction, deletion, portability, objection, or another privacy matter, contact ${contactEmail}. Identity and authority may need to be verified before a request is completed.`,
        ],
      },
    ],
  },
  terms: {
    eyebrow: "Terms",
    title: "Terms for using Tsewa.",
    description: "The basic terms governing access to the Tsewa website and hosted service.",
    intro:
      "These terms govern use of the public website and hosted Tsewa service. A signed order form, enterprise agreement, or data-processing agreement may add to or replace parts of these terms for a customer organisation.",
    sections: [
      {
        title: "Accounts and authority",
        paragraphs: [
          "You must provide accurate information, keep account credentials secure, and promptly report suspected misuse. If you create or administer an organisation, you confirm that you are authorised to act for it and to invite its users.",
        ],
      },
      {
        title: "Acceptable use",
        bullets: [
          "Use Tsewa only for lawful organisational purposes and in accordance with applicable safeguarding and privacy duties.",
          "Do not probe, disrupt, overload, bypass, or attempt unauthorised access to the service or another organisation’s records.",
          "Do not upload malicious code, infringing content, or information you are not authorised to process.",
          "Do not resell or misrepresent the service unless a written agreement permits it.",
        ],
      },
      {
        title: "Customer data",
        paragraphs: [
          "The customer organisation retains its rights in data it supplies to Tsewa. It is responsible for the accuracy, lawful collection, permissions, notices, and instructions associated with that data.",
          "The customer authorises Tsewa to process customer data only as needed to provide, protect, support, and improve the contracted service, or as otherwise required by law.",
        ],
      },
      {
        title: "Subscriptions and changes",
        paragraphs: [
          "Hosted plans renew according to the interval and price shown at checkout or in an order form. Taxes, cancellation timing, trials, refunds, and plan changes are presented before purchase or governed by the applicable agreement.",
          "We may improve or change the service over time. We will avoid materially reducing paid core functionality during a current subscription without reasonable notice, except where a change is necessary for security or legal compliance.",
        ],
      },
      {
        title: "Availability and responsibility",
        paragraphs: [
          "We work to keep Tsewa secure and available, but no online service can be guaranteed uninterrupted or error-free. Preview, trial, and free features may change or end.",
          "To the extent permitted by law, neither party is responsible for indirect or consequential loss. Any negotiated service levels, warranties, indemnities, and liability limits appear in the customer’s order form or enterprise agreement.",
        ],
      },
      {
        title: "Suspension and termination",
        paragraphs: [
          "Access may be suspended to prevent harm, investigate abuse, address unpaid fees, or comply with law. Customers may stop renewal according to their subscription terms. Data export and deletion are handled according to the applicable plan and agreement.",
        ],
      },
      {
        title: "Questions",
        paragraphs: [
          `Contact ${contactEmail} before relying on these public terms for a procurement or regulated-data decision. Enterprise customers should request the complete contractual pack.`,
        ],
      },
    ],
  },
  security: {
    eyebrow: "Security",
    title: "Designed for records that deserve care.",
    description:
      "An overview of Tsewa’s current security approach for the hosted person-centred management service.",
    intro:
      "Security is treated as part of the product model: organisations are separated, access follows responsibility, sensitive files are protected, and important actions remain traceable.",
    sections: [
      {
        title: "Current safeguards",
        bullets: [
          "Organisation-scoped application data and permission checks for protected workflows.",
          "Email verification, minimum password requirements, session expiry, and session revocation after password reset.",
          "Role- and responsibility-based access to operational areas and actions.",
          "Authenticated delivery for protected documents and media rather than public object URLs.",
          "Audit records for important administrative and record-changing actions.",
          "Encrypted HTTPS connections and managed Cloudflare infrastructure for the hosted service.",
          "Separate public marketing infrastructure with no connection to production SaaS data.",
        ],
      },
      {
        title: "Operational practices",
        paragraphs: [
          "Changes are version-controlled and validated before deployment. Secrets are kept out of source control and configured through the deployment environment. Data migrations use reconciliation, checksums where appropriate, and explicit review steps.",
          "Security controls evolve with the product. Tsewa does not currently claim a certification unless it is explicitly listed on this page or in a signed customer agreement.",
        ],
      },
      {
        title: "Customer responsibilities",
        bullets: [
          "Invite only authorised users and remove access promptly when responsibilities change.",
          "Use unique credentials and protect email accounts used for verification and recovery.",
          "Configure permissions conservatively and review audit activity.",
          "Collect and enter personal information only when the organisation has a lawful and documented reason.",
        ],
      },
      {
        title: "Report a vulnerability",
        paragraphs: [
          `Send a clear description to ${contactEmail}. Please avoid accessing, changing, or downloading real customer data, disrupting the service, or publicly disclosing an unresolved issue. We will acknowledge a credible report and coordinate a responsible response.`,
        ],
      },
      {
        title: "Enterprise requirements",
        paragraphs: [
          "Additional data controls, migration planning, contractual security schedules, institution-owned infrastructure, and deployment-specific reviews are available through the Enterprise tier.",
        ],
      },
    ],
  },
  "data-processing": {
    eyebrow: "Data processing",
    title: "A clear division of responsibility.",
    description:
      "How responsibilities are divided when an organisation uses hosted Tsewa to manage personal records.",
    intro:
      "This page is a practical overview, not a substitute for a signed data-processing agreement. It helps organisations understand the model before procurement and onboarding.",
    sections: [
      {
        title: "Roles",
        paragraphs: [
          "The customer organisation decides which people and activities belong in Tsewa, why information is processed, who may access it, and how long it should be retained. The organisation is normally the controller or equivalent responsible body.",
          "Tsewa processes that service data to provide the hosted platform under the customer’s documented instructions. Tsewa separately controls limited account, security, billing, and service-administration information needed to operate the business and platform.",
        ],
      },
      {
        title: "Processing covered",
        bullets: [
          "Hosting, organising, retrieving, updating, exporting, and deleting customer records.",
          "Managing accounts, permissions, invitations, documents, audit activity, and support requests.",
          "Securing, monitoring, backing up, maintaining, and troubleshooting the service.",
          "Assisting with approved imports, migrations, and historical-record reconciliation.",
        ],
      },
      {
        title: "People and data involved",
        paragraphs: [
          "Depending on the customer’s work, records may concern students, residents, patients, beneficiaries, staff, applicants, guardians, family members, sponsors, donors, volunteers, and professional contacts. Information may include identity, relationships, education, care, health, support-programme, employment, contact, document, and audit data.",
          "Customers should use the minimum information needed for their work and apply additional governance where special-category or children’s data is involved.",
        ],
      },
      {
        title: "Subprocessors and transfers",
        paragraphs: [
          "The hosted service relies on carefully selected infrastructure and service providers. A current subprocessor list and relevant processing locations can be supplied during procurement. We will provide reasonable notice of material changes where the customer agreement requires it.",
        ],
      },
      {
        title: "Requests, incidents, return, and deletion",
        paragraphs: [
          "Tsewa supports customers with reasonable technical measures for access requests, correction, export, restriction, and deletion. We notify affected customers of confirmed incidents as required by the applicable agreement and law.",
          "At the end of service, customer data is returned or deleted according to the contract, subject to agreed export windows, backup cycles, and legal retention duties.",
        ],
      },
      {
        title: "Request the contractual pack",
        paragraphs: [
          `Email ${contactEmail} for the data-processing agreement, security schedule, and subprocessor information appropriate to your organisation and jurisdiction.`,
        ],
      },
    ],
  },
};

export function trustPageForPath(pathname: string): TrustPageKey | null {
  const page = pathname.replace(/^\/+|\/+$/g, "") as TrustPageKey;
  return page in trustPages ? page : null;
}

export function TrustPage({ pageKey }: { pageKey: TrustPageKey }) {
  const page = trustPages[pageKey];

  useEffect(() => {
    document.title = `${page.eyebrow} — Tsewa`;
    setMeta("description", page.description);
    setMeta("og:title", `${page.eyebrow} — Tsewa`, "property");
    setMeta("og:description", page.description, "property");
    setMeta("og:url", `https://gettsewa.com/${pageKey}/`, "property");
    const canonical = document.querySelector<HTMLLinkElement>("link[rel='canonical']");
    canonical?.setAttribute("href", `https://gettsewa.com/${pageKey}/`);
  }, [page, pageKey]);

  return (
    <div className="trust-shell">
      <header className="trust-nav page-width">
        <a aria-label="Tsewa home" className="brand" href="/">
          <TsewaMonogram className="brand-mark" />
          <span className="brand-name">Tsewa</span>
        </a>
        <nav aria-label="Trust pages">
          <a aria-current={pageKey === "privacy" ? "page" : undefined} href="/privacy/">
            Privacy
          </a>
          <a aria-current={pageKey === "terms" ? "page" : undefined} href="/terms/">
            Terms
          </a>
          <a aria-current={pageKey === "security" ? "page" : undefined} href="/security/">
            Security
          </a>
          <a
            aria-current={pageKey === "data-processing" ? "page" : undefined}
            href="/data-processing/"
          >
            Data processing
          </a>
        </nav>
        <a className="button button-small button-accent" href="https://app.gettsewa.com">
          Start with Tsewa <ArrowRight aria-hidden="true" />
        </a>
      </header>

      <main id="main-content">
        <section className="trust-hero">
          <div className="page-width trust-hero-inner">
            <a className="trust-back" href="/">
              <ArrowLeft aria-hidden="true" /> Back to Tsewa
            </a>
            <p className="eyebrow eyebrow-light">{page.eyebrow} · Hosted Tsewa</p>
            <h1>{page.title}</h1>
            <p>{page.intro}</p>
            <span>Last updated {updated}</span>
          </div>
        </section>

        <div className="trust-layout page-width">
          <aside>
            <ShieldCheck aria-hidden="true" />
            <p>Trust centre</p>
            <nav aria-label="On this page">
              {page.sections.map((section, index) => (
                <a href={`#section-${index + 1}`} key={section.title}>
                  <span>{String(index + 1).padStart(2, "0")}</span> {section.title}
                </a>
              ))}
            </nav>
          </aside>

          <article className="trust-content">
            {page.sections.map((section, index) => (
              <section id={`section-${index + 1}`} key={section.title}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <h2>{section.title}</h2>
                {section.paragraphs?.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
                {section.bullets ? (
                  <ul>
                    {section.bullets.map((bullet) => (
                      <li key={bullet}>
                        <Check aria-hidden="true" /> <span>{bullet}</span>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </section>
            ))}

            <div className="trust-contact">
              <CircleAlert aria-hidden="true" />
              <div>
                <p>Need a contractual or organisation-specific answer?</p>
                <a href={`mailto:${contactEmail}`}>
                  <Mail aria-hidden="true" /> {contactEmail}
                </a>
              </div>
            </div>
          </article>
        </div>
      </main>

      <footer className="footer page-width trust-footer">
        <div className="footer-brand">
          <TsewaMonogram className="brand-mark" />
          <div>
            <p>Tsewa</p>
            <span>Every person. Every role. One connected record.</span>
          </div>
        </div>
        <div className="footer-links">
          <a href={`mailto:${contactEmail}`}>{contactEmail}</a>
          <a href="https://app.gettsewa.com">Sign in</a>
          <a href="/">Home</a>
        </div>
        <p className="footer-legal">© {new Date().getFullYear()} Tsewa.</p>
      </footer>
    </div>
  );
}

function setMeta(name: string, content: string, attribute = "name") {
  document
    .querySelector<HTMLMetaElement>(`meta[${attribute}='${name}']`)
    ?.setAttribute("content", content);
}
