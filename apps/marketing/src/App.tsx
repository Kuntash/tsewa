import {
  ArrowRight,
  BriefcaseBusiness,
  Building2,
  Check,
  ChevronDown,
  CircleUserRound,
  FileCheck2,
  FileText,
  GraduationCap,
  HeartHandshake,
  Home,
  LayoutDashboard,
  Menu,
  Search,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  Users,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { ComponentType, ReactNode } from "react";

type DemoView = "overview" | "student" | "resident" | "health" | "sponsorship" | "staff";

type DemoPerson = {
  id: string;
  name: string;
  initials: string;
  description: string;
  age: number;
  gender: string;
  roles: DemoView[];
  status: string;
};

type ViewContent = {
  label: string;
  eyebrow: string;
  Icon: ComponentType<{ className?: string }>;
  accent: string;
  summary: Array<{ label: string; value: string }>;
  events: Array<{ date: string; title: string; detail: string }>;
};

const people: DemoPerson[] = [
  {
    id: "P-2048",
    name: "Tenzin Dolma",
    initials: "TD",
    description: "Class XII · Girls' hostel",
    age: 17,
    gender: "Female",
    roles: ["student", "resident", "health", "sponsorship"],
    status: "Active",
  },
  {
    id: "P-0872",
    name: "Karma Lhamo",
    initials: "KL",
    description: "Senior care · Oak residence",
    age: 68,
    gender: "Female",
    roles: ["resident", "health"],
    status: "Active",
  },
  {
    id: "P-1140",
    name: "Sonam Tashi",
    initials: "ST",
    description: "Teacher · Primary school",
    age: 34,
    gender: "Male",
    roles: ["staff", "health"],
    status: "Active",
  },
];

const roleMeta: Record<
  Exclude<DemoView, "overview">,
  { label: string; Icon: ViewContent["Icon"] }
> = {
  student: { label: "Student", Icon: GraduationCap },
  resident: { label: "Resident", Icon: Home },
  health: { label: "Patient", Icon: Stethoscope },
  sponsorship: { label: "Sponsored", Icon: HeartHandshake },
  staff: { label: "Staff", Icon: BriefcaseBusiness },
};

const demoContent: Record<string, Partial<Record<DemoView, ViewContent>>> = {
  "P-2048": {
    overview: {
      label: "Whole record",
      eyebrow: "Connected overview",
      Icon: CircleUserRound,
      accent: "#d66f48",
      summary: [
        { label: "Primary identifier", value: "THS-2048" },
        { label: "Current placement", value: "Girls' hostel" },
        { label: "Family links", value: "3 connected people" },
        { label: "Documents", value: "12 protected files" },
      ],
      events: [
        { date: "12 Aug", title: "Term assessment recorded", detail: "Class XII · Science" },
        { date: "04 Aug", title: "Routine health visit", detail: "Dispensary · Completed" },
        { date: "16 Jul", title: "Sponsor correspondence", detail: "Letter received" },
      ],
    },
    student: {
      label: "Student record",
      eyebrow: "Education dimension",
      Icon: GraduationCap,
      accent: "#2c775c",
      summary: [
        { label: "Admission number", value: "A-10741" },
        { label: "Class", value: "XII · Science" },
        { label: "Academic session", value: "2026" },
        { label: "Attendance", value: "94% this term" },
      ],
      events: [
        { date: "12 Aug", title: "Physics assessment", detail: "78 / 100 · Published" },
        { date: "09 Aug", title: "Class placement confirmed", detail: "XII · Science" },
        { date: "01 Jul", title: "Session enrolment", detail: "2026 academic year" },
      ],
    },
    resident: {
      label: "Residential care",
      eyebrow: "Placement dimension",
      Icon: Home,
      accent: "#ad713f",
      summary: [
        { label: "Current home", value: "Girls' hostel" },
        { label: "Placement since", value: "18 March 2018" },
        { label: "House", value: "Snow Lion" },
        { label: "Primary caregiver", value: "Dolma Choezom" },
      ],
      events: [
        { date: "10 Aug", title: "Monthly check-in", detail: "No follow-up needed" },
        { date: "27 Jul", title: "Family call recorded", detail: "Mother and guardian" },
        { date: "02 Jul", title: "Room allocation updated", detail: "North wing · Room 8" },
      ],
    },
    health: {
      label: "Health record",
      eyebrow: "Care dimension",
      Icon: Stethoscope,
      accent: "#b45359",
      summary: [
        { label: "Last visit", value: "4 August 2026" },
        { label: "Allergies", value: "None recorded" },
        { label: "Blood group", value: "B positive" },
        { label: "Follow-up", value: "Not required" },
      ],
      events: [
        { date: "04 Aug", title: "Routine consultation", detail: "Seasonal cold · Resolved" },
        { date: "04 Aug", title: "Medication issued", detail: "3-day course" },
        { date: "22 Mar", title: "Annual screening", detail: "All observations normal" },
      ],
    },
    sponsorship: {
      label: "Sponsorship",
      eyebrow: "Support dimension",
      Icon: HeartHandshake,
      accent: "#8a647b",
      summary: [
        { label: "Programme", value: "Education support" },
        { label: "Linked since", value: "June 2019" },
        { label: "Correspondence", value: "6 letters" },
        { label: "Latest remittance", value: "April 2026" },
      ],
      events: [
        { date: "16 Jul", title: "Letter received", detail: "Reviewed by sponsorship team" },
        { date: "30 Apr", title: "Annual update sent", detail: "Delivery confirmed" },
        { date: "02 Apr", title: "Remittance recorded", detail: "Education support" },
      ],
    },
  },
  "P-0872": {
    overview: {
      label: "Whole record",
      eyebrow: "Connected overview",
      Icon: CircleUserRound,
      accent: "#d66f48",
      summary: [
        { label: "Primary identifier", value: "SC-0872" },
        { label: "Current placement", value: "Oak residence" },
        { label: "Family links", value: "2 connected people" },
        { label: "Documents", value: "8 protected files" },
      ],
      events: [
        { date: "18 Aug", title: "Care review completed", detail: "Plan remains current" },
        { date: "11 Aug", title: "Family visit", detail: "Daughter and granddaughter" },
        { date: "03 Aug", title: "Blood pressure review", detail: "Observations stable" },
      ],
    },
    resident: {
      label: "Residential care",
      eyebrow: "Placement dimension",
      Icon: Home,
      accent: "#ad713f",
      summary: [
        { label: "Current home", value: "Oak residence" },
        { label: "Placement since", value: "7 September 2021" },
        { label: "Room", value: "East wing · 12" },
        { label: "Key worker", value: "Pema Wangmo" },
      ],
      events: [
        { date: "18 Aug", title: "Care plan reviewed", detail: "No changes required" },
        { date: "11 Aug", title: "Family visit", detail: "Two visitors" },
        { date: "01 Aug", title: "Monthly wellbeing note", detail: "Positive engagement" },
      ],
    },
    health: {
      label: "Health record",
      eyebrow: "Care dimension",
      Icon: Stethoscope,
      accent: "#b45359",
      summary: [
        { label: "Last visit", value: "3 August 2026" },
        { label: "Care plan", value: "Active" },
        { label: "Blood group", value: "O positive" },
        { label: "Next review", value: "3 September" },
      ],
      events: [
        { date: "03 Aug", title: "Blood pressure review", detail: "Observations stable" },
        { date: "12 Jul", title: "Prescription renewed", detail: "30-day supply" },
        { date: "03 Jul", title: "Monthly consultation", detail: "No concerns" },
      ],
    },
  },
  "P-1140": {
    overview: {
      label: "Whole record",
      eyebrow: "Connected overview",
      Icon: CircleUserRound,
      accent: "#d66f48",
      summary: [
        { label: "Primary identifier", value: "ST-1140" },
        { label: "Department", value: "Primary school" },
        { label: "Family links", value: "4 connected people" },
        { label: "Documents", value: "15 protected files" },
      ],
      events: [
        { date: "20 Aug", title: "Employment record updated", detail: "Annual increment" },
        { date: "14 Aug", title: "Class responsibility", detail: "Class V · Section A" },
        { date: "22 Jul", title: "Health screening", detail: "Completed" },
      ],
    },
    staff: {
      label: "Staff record",
      eyebrow: "Employment dimension",
      Icon: BriefcaseBusiness,
      accent: "#4b6d91",
      summary: [
        { label: "Employee number", value: "EMP-1140" },
        { label: "Designation", value: "Primary teacher" },
        { label: "Department", value: "Primary school" },
        { label: "Joined", value: "4 April 2017" },
      ],
      events: [
        { date: "20 Aug", title: "Annual increment", detail: "Employment record updated" },
        { date: "14 Aug", title: "Class responsibility", detail: "Class V · Section A" },
        { date: "01 Jul", title: "Session assignment", detail: "2026 academic year" },
      ],
    },
    health: {
      label: "Health record",
      eyebrow: "Care dimension",
      Icon: Stethoscope,
      accent: "#b45359",
      summary: [
        { label: "Last screening", value: "22 July 2026" },
        { label: "Allergies", value: "None recorded" },
        { label: "Blood group", value: "A positive" },
        { label: "Follow-up", value: "Not required" },
      ],
      events: [
        { date: "22 Jul", title: "Annual screening", detail: "Completed" },
        { date: "22 Jul", title: "Vision check", detail: "No change" },
        { date: "19 Jan", title: "Routine consultation", detail: "Resolved" },
      ],
    },
  },
};

const capabilities = [
  {
    number: "01",
    title: "A record that outlives a role",
    text: "A student can graduate, become a staff member, or continue receiving care without losing the history that came before.",
    Icon: CircleUserRound,
  },
  {
    number: "02",
    title: "Workflows that understand context",
    text: "Admissions, placements, visits, sponsorships, employment, and documents each retain the structure their teams need.",
    Icon: FileCheck2,
  },
  {
    number: "03",
    title: "Access shaped around responsibility",
    text: "Give teams the records and actions they need while keeping sensitive information protected and auditable.",
    Icon: ShieldCheck,
  },
];

const faq = [
  {
    question: "Is Tsewa only for schools?",
    answer:
      "No. Education is one dimension of a person's record. Tsewa is designed for organisations that combine schooling, residential care, health services, sponsorship, scholarships, or staff operations.",
  },
  {
    question: "Does one person need a separate record in every module?",
    answer:
      "No. Tsewa starts with one person and attaches time-bound roles and histories to that record. Teams see the context relevant to them without creating duplicate identities.",
  },
  {
    question: "Can you help us move existing records?",
    answer:
      "Yes. Assisted onboarding can include mapping and importing existing spreadsheets, databases, documents, and historical records into a clean person-centred structure.",
  },
  {
    question: "Is this a hosted service?",
    answer:
      "Yes. The standard Tsewa product is hosted, maintained, and updated for you. Your team signs in through a secure browser-based application without operating servers.",
  },
  {
    question: "Can our institution control its own infrastructure?",
    answer:
      "Custom deployments, institution-owned cloud infrastructure, and additional data controls are available as part of the Enterprise tier.",
  },
];

export function App() {
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!menuOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [menuOpen]);

  return (
    <div className="site-shell">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <header className="nav-wrap">
        <a aria-label="Tsewa home" className="brand" href="#top">
          <span className="brand-mark">T</span>
          <span className="brand-name">Tsewa</span>
        </a>
        <nav aria-label="Main navigation" className="desktop-nav">
          <a href="#product">Product</a>
          <a href="#demo">Try the demo</a>
          <a href="#hosted">Hosted SaaS</a>
          <a href="#faq">FAQ</a>
        </nav>
        <div className="desktop-actions">
          <a className="text-link" href="https://app.gettsewa.com">
            Sign in
          </a>
          <a className="button button-dark button-small" href="https://app.gettsewa.com">
            Start with Tsewa <ArrowRight aria-hidden="true" />
          </a>
        </div>
        <button
          aria-expanded={menuOpen}
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          className="menu-button"
          onClick={() => setMenuOpen((value) => !value)}
          type="button"
        >
          {menuOpen ? <X /> : <Menu />}
        </button>
        {menuOpen ? (
          <nav aria-label="Mobile navigation" className="mobile-nav">
            <a href="#product" onClick={() => setMenuOpen(false)}>
              Product
            </a>
            <a href="#demo" onClick={() => setMenuOpen(false)}>
              Try the demo
            </a>
            <a href="#hosted" onClick={() => setMenuOpen(false)}>
              Hosted SaaS
            </a>
            <a href="#faq" onClick={() => setMenuOpen(false)}>
              FAQ
            </a>
            <a className="button button-accent" href="https://app.gettsewa.com">
              Start with Tsewa <ArrowRight />
            </a>
          </nav>
        ) : null}
      </header>

      <main id="main-content">
        <section className="hero" id="top">
          <div aria-hidden="true" className="hero-orbit hero-orbit-one" />
          <div aria-hidden="true" className="hero-orbit hero-orbit-two" />
          <div className="hero-grid page-width">
            <div className="hero-copy">
              <p className="eyebrow hero-enter hero-enter-one">
                Hosted software for education & care organisations
              </p>
              <h1 className="hero-title hero-enter hero-enter-two">
                Every person.
                <br />
                Every role.
                <br />
                <em>One connected record.</em>
              </h1>
              <p className="hero-description hero-enter hero-enter-three">
                Tsewa helps organisations manage the people they educate, care for, employ, sponsor,
                and support—without fragmenting their history across departments and spreadsheets.
              </p>
              <div className="hero-actions hero-enter hero-enter-four">
                <a className="button button-accent" href="https://app.gettsewa.com">
                  Create your organisation <ArrowRight />
                </a>
                <a className="button button-quiet" href="#demo">
                  Try the interactive demo
                </a>
              </div>
            </div>
            <div className="hero-record hero-enter hero-enter-three">
              <div className="record-index">PERSON / 2048</div>
              <div className="record-person">
                <span className="portrait portrait-large">TD</span>
                <div>
                  <p className="record-kicker">Active person record</p>
                  <h2>Tenzin Dolma</h2>
                  <p>17 years · Female</p>
                </div>
              </div>
              <div className="record-thread">
                <RecordThreadItem Icon={GraduationCap} label="Student" meta="Class XII · 2026" />
                <RecordThreadItem Icon={Home} label="Resident" meta="Girls' hostel · Since 2018" />
                <RecordThreadItem Icon={Stethoscope} label="Patient" meta="Last visit · 4 Aug" />
                <RecordThreadItem
                  Icon={HeartHandshake}
                  label="Sponsored"
                  meta="Education support · Active"
                />
              </div>
              <p className="record-note">One identity · four living dimensions</p>
            </div>
          </div>
          <div className="role-ribbon" aria-label="Types of people Tsewa can manage">
            <span>Students</span>
            <i />
            <span>Residents</span>
            <i />
            <span>Patients</span>
            <i />
            <span>Staff</span>
            <i />
            <span>Families</span>
            <i />
            <span>Sponsors</span>
          </div>
        </section>

        <Reveal>
          <section className="demo-section page-width" id="demo">
            <div className="section-heading demo-heading">
              <div>
                <p className="eyebrow">Try the product · dummy data only</p>
                <h2>Meet one person from more than one angle.</h2>
              </div>
              <p>
                Choose a person, then move through their roles. The interface changes context; the
                identity and history stay connected.
              </p>
            </div>
            <ProductDemo />
          </section>
        </Reveal>

        <section className="principle-section" id="product">
          <Reveal className="principle-inner page-width">
            <p className="eyebrow eyebrow-light">The organising principle</p>
            <div className="principle-grid">
              <h2>A person is never only one thing.</h2>
              <div className="principle-copy">
                <p>
                  Most systems begin with a department. Tsewa begins with a person, then records
                  every meaningful role, relationship, placement, service, and transition around
                  them.
                </p>
                <p>
                  When a role ends, the person does not become inactive. Their history remains
                  useful, connected, and ready for whatever comes next.
                </p>
              </div>
            </div>
            <LifeLine />
          </Reveal>
        </section>

        <section className="capability-section page-width">
          <Reveal className="section-heading capability-heading">
            <div>
              <p className="eyebrow">Built around real lives</p>
              <h2>Flexible at the centre. Structured at every edge.</h2>
            </div>
            <p>
              Tsewa connects information without flattening the distinct work of schools, homes,
              clinics, programmes, and administration teams.
            </p>
          </Reveal>
          <div className="capability-grid">
            {capabilities.map((capability, index) => (
              <Reveal className="capability-card" delay={index * 70} key={capability.number}>
                <div className="capability-topline">
                  <span>{capability.number}</span>
                  <capability.Icon />
                </div>
                <h3>{capability.title}</h3>
                <p>{capability.text}</p>
              </Reveal>
            ))}
          </div>
        </section>

        <Reveal>
          <section className="hosted-section page-width" id="hosted">
            <div className="hosted-visual">
              <div className="hosted-window">
                <div className="window-bar">
                  <span />
                  <span />
                  <span />
                  <p>app.gettsewa.com</p>
                </div>
                <div className="onboarding-preview">
                  <div className="onboarding-ledger">
                    <span className="ledger-mark">T</span>
                    <p>Organisation setup</p>
                    <ol>
                      <li className="complete">
                        <Check /> Identity
                      </li>
                      <li className="complete">
                        <Check /> Academic year
                      </li>
                      <li className="current">
                        <span>3</span> First school
                      </li>
                      <li>
                        <span>4</span> Invite your team
                      </li>
                    </ol>
                  </div>
                  <div className="onboarding-form">
                    <p>STEP 3 OF 4</p>
                    <h3>Sketch the school as it operates today.</h3>
                    <label>School name</label>
                    <div className="fake-input">Norling Senior School</div>
                    <label>Active classes</label>
                    <div className="fake-tags">
                      <span>Class I</span>
                      <span>Class II</span>
                      <span>Class III</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="hosted-copy">
              <p className="eyebrow">Hosted Tsewa</p>
              <h2>Your organisation, ready without an IT project.</h2>
              <p className="hosted-lead">
                Create an account, verify your email, and set up your first academic year and
                institution in one guided flow. We run the software, infrastructure, updates, and
                recovery.
              </p>
              <ul className="check-list">
                <li>
                  <Check /> Secure browser-based access
                </li>
                <li>
                  <Check /> Organisation-separated records
                </li>
                <li>
                  <Check /> Protected documents and audit history
                </li>
                <li>
                  <Check /> Assisted data migration available
                </li>
              </ul>
              <a className="button button-dark" href="https://app.gettsewa.com">
                Start your organisation <ArrowRight />
              </a>
            </div>
          </section>
        </Reveal>

        <section className="work-areas page-width">
          <Reveal className="work-area-intro">
            <p className="eyebrow">One platform, connected work</p>
            <h2>The familiar tools your teams need.</h2>
          </Reveal>
          <div className="work-area-grid">
            <WorkArea
              Icon={Users}
              title="People & family"
              text="Identity, relationships, placements, and protected documents."
            />
            <WorkArea
              Icon={GraduationCap}
              title="Education"
              text="Admissions, classes, enrolment, results, and academic history."
            />
            <WorkArea
              Icon={Stethoscope}
              title="Health & care"
              text="Visits, diagnoses, treatments, follow-ups, and care history."
            />
            <WorkArea
              Icon={HeartHandshake}
              title="Support programmes"
              text="Scholarships, sponsorships, correspondence, and outcomes."
            />
            <WorkArea
              Icon={BriefcaseBusiness}
              title="Staff"
              text="Employment, departments, designations, and contact records."
            />
            <WorkArea
              Icon={FileText}
              title="Reports & audit"
              text="Useful exports, document workflows, and traceable activity."
            />
          </div>
        </section>

        <Reveal>
          <section className="migration-section page-width">
            <div>
              <p className="eyebrow eyebrow-light">Bring your history</p>
              <h2>Start with what is already true.</h2>
            </div>
            <div className="migration-copy">
              <p>
                Years of spreadsheets, databases, paper registers, and scanned files should not be
                discarded just to adopt better software.
              </p>
              <p>
                We can help map, reconcile, and migrate existing records into Tsewa’s connected
                person model—preserving source history and making uncertainty visible.
              </p>
              <a href="mailto:hello@gettsewa.com?subject=Tsewa%20data%20migration">
                Discuss a migration <ArrowRight />
              </a>
            </div>
          </section>
        </Reveal>

        <section className="plans-section page-width" id="plans">
          <Reveal className="plans-heading">
            <p className="eyebrow">Ways to begin</p>
            <h2>Hosted by default. Adaptable when the institution demands it.</h2>
          </Reveal>
          <div className="plan-grid">
            <Reveal className="plan-card plan-card-primary">
              <div>
                <p className="plan-label">Hosted Tsewa</p>
                <h3>The complete managed service.</h3>
                <p>
                  For schools, care homes, and community organisations that want to begin without
                  managing infrastructure.
                </p>
              </div>
              <ul>
                <li>
                  <Check /> Guided organisation setup
                </li>
                <li>
                  <Check /> Automatic product updates
                </li>
                <li>
                  <Check /> Secure hosted infrastructure
                </li>
                <li>
                  <Check /> Onboarding and migration options
                </li>
              </ul>
              <a className="button button-accent" href="https://app.gettsewa.com">
                Create an account <ArrowRight />
              </a>
            </Reveal>
            <Reveal className="plan-card plan-card-enterprise" delay={80}>
              <div>
                <p className="plan-label">Enterprise</p>
                <h3>For complex institutional requirements.</h3>
                <p>
                  Custom onboarding, migration, data controls, and institution-owned deployment
                  options when required.
                </p>
              </div>
              <a className="text-arrow" href="mailto:hello@gettsewa.com?subject=Tsewa%20Enterprise">
                Talk to us <ArrowRight />
              </a>
            </Reveal>
          </div>
        </section>

        <section className="faq-section page-width" id="faq">
          <Reveal className="faq-heading">
            <p className="eyebrow">Questions, answered</p>
            <h2>Before you bring everyone together.</h2>
          </Reveal>
          <Reveal className="faq-list" delay={60}>
            {faq.map((item) => (
              <FaqItem answer={item.answer} key={item.question} question={item.question} />
            ))}
          </Reveal>
        </section>

        <section className="final-cta">
          <Reveal className="final-cta-inner page-width">
            <p className="eyebrow eyebrow-light">A clearer record starts here</p>
            <h2>Give every person a history that stays connected.</h2>
            <div>
              <a className="button button-accent" href="https://app.gettsewa.com">
                Start with Tsewa <ArrowRight />
              </a>
              <a
                className="button button-outline-light"
                href="mailto:hello@gettsewa.com?subject=Tsewa%20walkthrough"
              >
                Book a walkthrough
              </a>
            </div>
          </Reveal>
        </section>
      </main>

      <footer className="footer page-width">
        <div className="footer-brand">
          <span className="brand-mark">T</span>
          <div>
            <p>Tsewa</p>
            <span>Person-centred management for education and care.</span>
          </div>
        </div>
        <div className="footer-links">
          <a href="mailto:hello@gettsewa.com">hello@gettsewa.com</a>
          <a href="https://app.gettsewa.com">Sign in</a>
          <a href="#top">Back to top ↑</a>
        </div>
        <p className="footer-legal">© {new Date().getFullYear()} Tsewa. Built around people.</p>
      </footer>
    </div>
  );
}

function ProductDemo() {
  const [personId, setPersonId] = useState(people[0].id);
  const [view, setView] = useState<DemoView>("overview");
  const person = people.find((item) => item.id === personId) ?? people[0];
  const availableViews: DemoView[] = ["overview", ...person.roles];
  const content = demoContent[person.id][view] ?? demoContent[person.id].overview;

  if (!content) return null;

  function selectPerson(id: string) {
    setPersonId(id);
    setView("overview");
  }

  function moveTabFocus(event: React.KeyboardEvent<HTMLButtonElement>) {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    const buttons = Array.from(
      event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>("[role='tab']") ?? [],
    );
    const currentIndex = buttons.indexOf(event.currentTarget);
    if (currentIndex < 0) return;
    event.preventDefault();
    const nextIndex =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? buttons.length - 1
          : (currentIndex + (event.key === "ArrowRight" ? 1 : -1) + buttons.length) %
            buttons.length;
    buttons[nextIndex]?.focus();
    buttons[nextIndex]?.click();
  }

  return (
    <div className="product-demo">
      <div className="demo-browser-bar">
        <div className="browser-dots">
          <span />
          <span />
          <span />
        </div>
        <div className="browser-address">
          <ShieldCheck /> app.gettsewa.com/people
        </div>
        <span className="demo-label">INTERACTIVE DEMO</span>
      </div>
      <div className="demo-app">
        <aside className="demo-sidebar">
          <span className="demo-logo">T</span>
          <div className="demo-nav-items">
            <span>
              <LayoutDashboard /> <b>Dashboard</b>
            </span>
            <span className="active">
              <Users /> <b>People</b>
            </span>
            <span>
              <GraduationCap /> <b>School</b>
            </span>
            <span>
              <Stethoscope /> <b>Health</b>
            </span>
            <span>
              <FileText /> <b>Reports</b>
            </span>
          </div>
          <span className="demo-sidebar-bottom">
            <Building2 /> <b>Norling Community</b>
          </span>
        </aside>
        <div className="demo-directory">
          <div className="directory-heading">
            <div>
              <p>People</p>
              <span>3 dummy records</span>
            </div>
            <Search />
          </div>
          <div className="people-list">
            {people.map((item) => (
              <button
                className={item.id === person.id ? "person-row selected" : "person-row"}
                key={item.id}
                onClick={() => selectPerson(item.id)}
                type="button"
              >
                <span className="portrait">{item.initials}</span>
                <span>
                  <strong>{item.name}</strong>
                  <small>{item.description}</small>
                </span>
                <ArrowRight />
              </button>
            ))}
          </div>
          <p className="demo-privacy">
            <Sparkles /> Safe to explore. Nothing here is real.
          </p>
        </div>
        <div className="demo-record">
          <div className="demo-record-header">
            <div className="record-identity">
              <span className="portrait portrait-record">{person.initials}</span>
              <div>
                <span className="status-dot">{person.status}</span>
                <h3>{person.name}</h3>
                <p>
                  {person.id} · {person.age} years · {person.gender}
                </p>
              </div>
            </div>
            <div className="view-tabs" role="tablist" aria-label="Person record dimensions">
              {availableViews.map((item) => {
                const meta =
                  item === "overview"
                    ? { label: "Overview", Icon: CircleUserRound }
                    : roleMeta[item];
                return (
                  <button
                    aria-controls="demo-dimension-panel"
                    aria-selected={view === item}
                    className={view === item ? "active" : ""}
                    key={item}
                    onClick={() => setView(item)}
                    onKeyDown={moveTabFocus}
                    role="tab"
                    tabIndex={view === item ? 0 : -1}
                    type="button"
                  >
                    <meta.Icon /> {meta.label}
                  </button>
                );
              })}
            </div>
          </div>
          <div
            aria-live="polite"
            className="dimension-panel"
            id="demo-dimension-panel"
            key={`${person.id}-${view}`}
            role="tabpanel"
            style={{ "--dimension-accent": content.accent } as React.CSSProperties}
            tabIndex={0}
          >
            <div className="dimension-title">
              <span>
                <content.Icon />
              </span>
              <div>
                <p>{content.eyebrow}</p>
                <h4>{content.label}</h4>
              </div>
            </div>
            <div className="dimension-summary">
              {content.summary.map((item) => (
                <div key={item.label}>
                  <span>{item.label}</span>
                  <strong>{item.value}</strong>
                </div>
              ))}
            </div>
            <div className="timeline">
              <p className="timeline-title">Recent history</p>
              {content.events.map((event) => (
                <div className="timeline-event" key={`${event.date}-${event.title}`}>
                  <time>{event.date}</time>
                  <i />
                  <div>
                    <strong>{event.title}</strong>
                    <span>{event.detail}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function RecordThreadItem({
  Icon,
  label,
  meta,
}: {
  Icon: ViewContent["Icon"];
  label: string;
  meta: string;
}) {
  return (
    <div className="record-thread-item">
      <span>
        <Icon />
      </span>
      <div>
        <strong>{label}</strong>
        <p>{meta}</p>
      </div>
      <Check />
    </div>
  );
}

function LifeLine() {
  const points = [
    { year: "2009", label: "Person created", Icon: CircleUserRound },
    { year: "2018", label: "Residential placement", Icon: Home },
    { year: "2019", label: "Sponsorship begins", Icon: HeartHandshake },
    { year: "2026", label: "Class XII", Icon: GraduationCap },
    { year: "Next", label: "The record continues", Icon: ArrowRight },
  ];

  return (
    <div className="life-line">
      {points.map((point, index) => (
        <div
          className="life-point"
          key={point.label}
          style={{ "--point-delay": `${index * 80}ms` } as React.CSSProperties}
        >
          <span className="life-icon">
            <point.Icon />
          </span>
          <span className="life-year">{point.year}</span>
          <strong>{point.label}</strong>
        </div>
      ))}
    </div>
  );
}

function WorkArea({
  Icon,
  title,
  text,
}: {
  Icon: ViewContent["Icon"];
  title: string;
  text: string;
}) {
  return (
    <Reveal className="work-area-card">
      <Icon />
      <div>
        <h3>{title}</h3>
        <p>{text}</p>
      </div>
      <ArrowRight />
    </Reveal>
  );
}

function FaqItem({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={open ? "faq-item open" : "faq-item"}>
      <button aria-expanded={open} onClick={() => setOpen((value) => !value)} type="button">
        <span>{question}</span>
        <ChevronDown />
      </button>
      <div className="faq-answer" inert={!open ? true : undefined}>
        <div>
          <p>{answer}</p>
        </div>
      </div>
    </div>
  );
}

function Reveal({
  children,
  className = "",
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        element.dataset.visible = "true";
        observer.disconnect();
      },
      { rootMargin: "0px 0px -80px", threshold: 0.08 },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      className={`reveal ${className}`}
      ref={ref}
      style={{ "--reveal-delay": `${delay}ms` } as React.CSSProperties}
    >
      {children}
    </div>
  );
}
