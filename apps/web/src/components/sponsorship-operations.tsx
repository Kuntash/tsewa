import {
  ArrowLeft,
  Building2,
  Download,
  FileText,
  HandCoins,
  LoaderCircle,
  Pencil,
  Plus,
  Printer,
  Search,
  Settings2,
  UserRoundCheck,
  Users,
} from "lucide-react";
import { useEffect, useState } from "react";
import type { FormEvent } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { useDebouncedValue } from "@/lib/use-debounced-value";

type Option = {
  id: string;
  name: string;
  admissionNumber?: string;
  countryName?: string | null;
  supportsChildren?: number;
  supportsElderly?: number;
};
type Setup = {
  organizations: Option[];
  sponsorTypes: Option[];
  sponsorCategories: Option[];
  statuses: Option[];
  fundTypes: Option[];
  correspondenceTypes: Option[];
  visitorTypes: Option[];
  sessions: Option[];
  people: Option[];
  individuals: Option[];
  visitors: Option[];
  capabilities: { manage: boolean };
};
type Allocation = {
  personId: string;
  personName?: string;
  amount: number;
  remarks?: string | null;
};
type Row = Record<string, string | number | null | Allocation[]>;
type Section = "sponsors" | "assignments" | "funds" | "correspondence" | "visitors";
type ListData = {
  summary: {
    individuals: number;
    organizations: number;
    assignments: number;
    funds: number;
    receivedAmount: number;
    letters: number;
    visitors: number;
  };
  records: Row[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
  capabilities: { manage: boolean };
};
type ReportData = {
  report: string;
  title: string;
  sessionName: string;
  generatedAt: string;
  columns: Array<{ key: string; label: string; numeric?: boolean }>;
  rows: Array<Record<string, string | number | null>>;
};

const emptyList: ListData = {
  summary: {
    individuals: 0,
    organizations: 0,
    assignments: 0,
    funds: 0,
    receivedAmount: 0,
    letters: 0,
    visitors: 0,
  },
  records: [],
  pagination: { page: 1, pageSize: 25, total: 0, totalPages: 0 },
  capabilities: { manage: false },
};
const sections: Array<{ id: Section; label: string; singular: string }> = [
  { id: "sponsors", label: "Sponsors", singular: "sponsor" },
  { id: "assignments", label: "Assignments", singular: "assignment" },
  { id: "funds", label: "Remittances", singular: "remittance" },
  { id: "correspondence", label: "Correspondence", singular: "correspondence" },
  { id: "visitors", label: "Visitors", singular: "visitor" },
];

export type SponsorshipFilters = {
  section?: Section;
  q?: string;
  page?: number;
};

export function SponsorshipOperations({
  activeSessionId,
  filters = {},
  onBack,
  onFiltersChange,
}: {
  activeSessionId: string;
  filters?: SponsorshipFilters;
  onBack: () => void;
  onFiltersChange?: (filters: SponsorshipFilters) => void;
}) {
  const [section, setSection] = useState<Section>(filters.section ?? "sponsors");
  const [query, setQuery] = useState(filters.q ?? "");
  const debouncedQuery = useDebouncedValue(query, 250);
  const [page, setPage] = useState(filters.page ?? 1);
  const [data, setData] = useState<ListData>(emptyList);
  const [setup, setSetup] = useState<Setup | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [editor, setEditor] = useState<Row | "new" | null>(null);
  const [setupOpen, setSetupOpen] = useState(false);
  const [reportsOpen, setReportsOpen] = useState(false);

  useEffect(() => {
    setSection(filters.section ?? "sponsors");
    setQuery(filters.q ?? "");
    setPage(filters.page ?? 1);
  }, [filters.page, filters.q, filters.section]);

  useEffect(() => {
    onFiltersChange?.({ section, q: debouncedQuery || undefined, page });
  }, [debouncedQuery, onFiltersChange, page, section]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    void fetch(
      `/api/sponsorship?${new URLSearchParams({ section, q: debouncedQuery, page: String(page), pageSize: "25" })}`,
      { signal: controller.signal },
    )
      .then(parse<ListData>)
      .then(setData)
      .catch((reason: unknown) => {
        if (!controller.signal.aborted) setError(messageOf(reason));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [debouncedQuery, page, reloadKey, section]);

  useEffect(() => {
    if (!setupOpen && !reportsOpen) return;
    const controller = new AbortController();
    void fetch("/api/sponsorship/setup", {
      signal: controller.signal,
    })
      .then(parse<Setup>)
      .then(setSetup)
      .catch((reason: unknown) => {
        if (!controller.signal.aborted) setError(messageOf(reason));
      });
    return () => controller.abort();
  }, [reloadKey, reportsOpen, setupOpen]);

  function saved(value: string) {
    setMessage(value);
    setEditor(null);
    setReloadKey((current) => current + 1);
  }
  const active = sections.find((item) => item.id === section) ?? sections[0];
  return (
    <main className="min-h-svh bg-muted/30">
      <header className="sticky top-0 z-20 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-[1500px] items-center gap-3 px-5 md:px-8">
          <Button aria-label="Back" onClick={onBack} size="icon" variant="ghost">
            <ArrowLeft />
          </Button>
          <div>
            <p className="font-semibold tracking-tight">Sponsorship</p>
            <p className="hidden text-xs text-muted-foreground sm:block">
              Sponsors, beneficiary relationships, remittances, letters, and visits
            </p>
          </div>
          <div className="ml-auto flex gap-2">
            <Button onClick={() => setReportsOpen(true)} size="sm" variant="outline">
              <FileText /> Reports
            </Button>
            {data.capabilities.manage ? (
              <Button onClick={() => setSetupOpen(true)} size="sm" variant="outline">
                <Settings2 /> Setup
              </Button>
            ) : null}
            {data.capabilities.manage ? (
              <Button onClick={() => setEditor("new")} size="sm">
                <Plus /> New {active.singular}
              </Button>
            ) : null}
          </div>
        </div>
      </header>
      <div className="mx-auto max-w-[1500px] space-y-5 px-5 py-8 md:px-8">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Metric icon={Users} label="Individual sponsors" value={data.summary.individuals} />
          <Metric
            icon={Building2}
            label="Sponsor organisations"
            value={data.summary.organizations}
          />
          <Metric
            icon={UserRoundCheck}
            label="Beneficiary assignments"
            value={data.summary.assignments}
          />
          <Metric
            icon={HandCoins}
            label="Funds received"
            value={money(data.summary.receivedAmount)}
          />
        </div>
        {message ? <Notice>{message}</Notice> : null}
        {error ? <ErrorNotice>{error}</ErrorNotice> : null}
        <Card>
          <CardContent className="space-y-4 p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
              <div className="flex gap-1 overflow-x-auto rounded-xl bg-muted/60 p-1">
                {sections.map((item) => (
                  <Button
                    className="shrink-0"
                    key={item.id}
                    onClick={() => {
                      setSection(item.id);
                      setPage(1);
                    }}
                    size="sm"
                    variant={section === item.id ? "default" : "ghost"}
                  >
                    {item.label}
                  </Button>
                ))}
              </div>
              <div className="relative ml-auto w-full lg:max-w-md">
                <Search className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  aria-label={`Search ${active.label}`}
                  className="pl-10"
                  onChange={(event) => {
                    setQuery(event.target.value);
                    setPage(1);
                  }}
                  placeholder={`Search ${active.label.toLowerCase()}`}
                  value={query}
                />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="overflow-hidden">
          <CardContent className="p-0">
            {loading ? (
              <div className="grid min-h-72 place-items-center">
                <LoaderCircle className="animate-spin text-primary" />
              </div>
            ) : data.records.length ? (
              <>
                <div className="divide-y">
                  {data.records.map((row) => (
                    <RecordRow
                      canEdit={data.capabilities.manage}
                      key={text(row, "id")}
                      onEdit={() => setEditor(row)}
                      row={row}
                      section={section}
                    />
                  ))}
                </div>
                <div className="flex items-center justify-between border-t px-4 py-3 text-xs text-muted-foreground">
                  <span>{data.pagination.total.toLocaleString()} records</span>
                  <div className="flex items-center gap-2">
                    <Button
                      disabled={page <= 1}
                      onClick={() => setPage(page - 1)}
                      size="sm"
                      variant="outline"
                    >
                      Previous
                    </Button>
                    <span>
                      {page} / {Math.max(1, data.pagination.totalPages)}
                    </span>
                    <Button
                      disabled={page >= data.pagination.totalPages}
                      onClick={() => setPage(page + 1)}
                      size="sm"
                      variant="outline"
                    >
                      Next
                    </Button>
                  </div>
                </div>
              </>
            ) : (
              <div className="grid min-h-64 place-items-center text-sm text-muted-foreground">
                No {active.label.toLowerCase()} match this search.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      <RecordEditor
        activeSessionId={activeSessionId}
        onOpenChange={(open) => !open && setEditor(null)}
        onSaved={saved}
        record={editor}
        section={section}
        setup={setup}
      />
      <SponsorshipSetup
        onOpenChange={setSetupOpen}
        onSaved={saved}
        open={setupOpen}
        setup={setup}
      />
      <SponsorshipReports
        activeSessionId={activeSessionId}
        onOpenChange={setReportsOpen}
        open={reportsOpen}
        sessions={setup?.sessions ?? []}
      />
    </main>
  );
}

function RecordRow({
  canEdit,
  onEdit,
  row,
  section,
}: {
  canEdit: boolean;
  onEdit: () => void;
  row: Row;
  section: Section;
}) {
  const content = sectionContent(row, section);
  return (
    <div className="flex items-start gap-4 px-5 py-4 hover:bg-muted/25">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-semibold">{content.title}</p>
          {content.badge ? <Badge variant="secondary">{content.badge}</Badge> : null}
        </div>
        <p className="mt-1 text-sm text-muted-foreground">{content.detail}</p>
        {content.meta ? <p className="mt-1 text-xs text-muted-foreground">{content.meta}</p> : null}
      </div>
      {canEdit ? (
        <Button aria-label="Edit" onClick={onEdit} size="icon" variant="ghost">
          <Pencil />
        </Button>
      ) : null}
    </div>
  );
}

function sectionContent(row: Row, section: Section) {
  if (section === "sponsors")
    return {
      title: text(row, "displayName"),
      badge: text(row, "sponsorCategory"),
      detail:
        [text(row, "organizationName"), text(row, "countryName")].filter(Boolean).join(" · ") ||
        "Independent sponsor",
      meta: `${number(row, "assignmentCount")} beneficiary assignments · ${text(row, "email") || text(row, "phone") || "No contact recorded"}`,
    };
  if (section === "assignments")
    return {
      title: text(row, "personName"),
      badge: text(row, "statusName"),
      detail: `Sponsored by ${text(row, "sponsorName")}`,
      meta: [text(row, "sessionName"), displayDate(text(row, "statusOn")), text(row, "remarks")]
        .filter(Boolean)
        .join(" · "),
    };
  if (section === "funds")
    return {
      title: text(row, "sponsorName"),
      badge: text(row, "fundType"),
      detail: `${money(number(row, "amount"))} received ${displayDate(text(row, "receivedOn"))}`,
      meta: `${number(row, "allocationCount")} beneficiary allocations${text(row, "receiptNumber") ? ` · Receipt ${text(row, "receiptNumber")}` : ""}`,
    };
  if (section === "correspondence")
    return {
      title: `${text(row, "sender") || "Unknown sender"} → ${text(row, "receiver") || "Unknown receiver"}`,
      badge: text(row, "correspondenceType"),
      detail: `Received ${displayDate(text(row, "receivedOn"))}`,
      meta: text(row, "repliedOn")
        ? `Replied ${displayDate(text(row, "repliedOn"))}`
        : "Reply not recorded",
    };
  return {
    title: text(row, "displayName"),
    badge: text(row, "visitorType"),
    detail: [text(row, "countryName"), displayDate(text(row, "visitedOn"))]
      .filter(Boolean)
      .join(" · "),
    meta: text(row, "visitSummary") || text(row, "relatedPersonName"),
  };
}

function RecordEditor({
  activeSessionId,
  onOpenChange,
  onSaved,
  record,
  section,
  setup,
}: {
  activeSessionId: string;
  onOpenChange: (open: boolean) => void;
  onSaved: (message: string) => void;
  record: Row | "new" | null;
  section: Section;
  setup: Setup | null;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [lookup, setLookup] = useState("");
  const debouncedLookup = useDebouncedValue(lookup, 250);
  const [lookupSetup, setLookupSetup] = useState<Setup | null>(null);
  useEffect(() => {
    if (!record) return;
    const controller = new AbortController();
    void fetch(`/api/sponsorship/setup?${new URLSearchParams({ q: debouncedLookup })}`, {
      signal: controller.signal,
    })
      .then(parse<Setup>)
      .then(setLookupSetup)
      .catch(() => undefined);
    return () => controller.abort();
  }, [debouncedLookup, record]);
  const editorSetup = lookupSetup ?? setup;
  const allocations =
    record && record !== "new" && Array.isArray(record.allocations) ? record.allocations : [];
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const id = record && record !== "new" ? text(record, "id") : undefined;
    let value: Record<string, unknown>;
    if (section === "sponsors")
      value = {
        kind: "individual",
        id,
        sponsorOrganizationId: nullable(form, "sponsorOrganizationId"),
        sponsorTypeId: nullable(form, "sponsorTypeId"),
        sponsorCategoryId: nullable(form, "sponsorCategoryId"),
        firstName: required(form, "firstName"),
        middleName: nullable(form, "middleName"),
        lastName: nullable(form, "lastName"),
        address: nullable(form, "address"),
        countryName: nullable(form, "countryName"),
        email: nullable(form, "email"),
        phone: nullable(form, "phone"),
      };
    else if (section === "assignments")
      value = {
        kind: "assignment",
        id,
        personId: required(form, "personId"),
        sponsorIndividualId: required(form, "sponsorIndividualId"),
        statusId: required(form, "statusId"),
        sessionId: nullable(form, "sessionId"),
        statusOn: required(form, "statusOn"),
        remarks: nullable(form, "remarks"),
      };
    else if (section === "funds") {
      const allocationAmounts = form.getAll("allocationAmount");
      const allocationRemarks = form.getAll("allocationRemarks");
      value = {
        kind: "fund",
        id,
        fundTypeId: required(form, "fundTypeId"),
        sessionId: nullable(form, "sessionId"),
        sponsorKind: required(form, "sponsorKind"),
        sponsorPartyId: required(form, "sponsorPartyId"),
        receivedOn: required(form, "receivedOn"),
        periodFrom: nullable(form, "periodFrom"),
        periodTo: nullable(form, "periodTo"),
        amount: numeric(form, "amount"),
        receiptNumber: nullable(form, "receiptNumber"),
        remarks: nullable(form, "remarks"),
        allocations: form
          .getAll("allocationPersonId")
          .map((personId, index) => ({
            personId: typeof personId === "string" ? personId : "",
            amount: Number(allocationAmounts[index] || 0),
            remarks:
              typeof allocationRemarks[index] === "string"
                ? allocationRemarks[index] || null
                : null,
          }))
          .filter((item) => item.personId && item.personId !== "__none"),
      };
    } else if (section === "correspondence")
      value = {
        kind: "correspondence",
        id,
        correspondenceTypeId: required(form, "correspondenceTypeId"),
        sponsorIndividualId: nullable(form, "sponsorIndividualId"),
        personId: nullable(form, "personId"),
        sessionId: nullable(form, "sessionId"),
        sender: nullable(form, "sender"),
        receiver: nullable(form, "receiver"),
        receivedOn: required(form, "receivedOn"),
        repliedOn: nullable(form, "repliedOn"),
        replyDueOn: nullable(form, "replyDueOn"),
        remarks: nullable(form, "remarks"),
      };
    else
      value = {
        kind: "visitor",
        id,
        visitorTypeId: nullable(form, "visitorTypeId"),
        firstName: required(form, "firstName"),
        middleName: nullable(form, "middleName"),
        lastName: nullable(form, "lastName"),
        address: nullable(form, "address"),
        countryName: nullable(form, "countryName"),
        email: nullable(form, "email"),
        phone: nullable(form, "phone"),
        relatedPersonName: nullable(form, "relatedPersonName"),
        visitedOn: required(form, "visitedOn"),
        mementoQuantity: nullableNumber(form, "mementoQuantity"),
        giftsPresented: nullable(form, "giftsPresented"),
        visitSummary: nullable(form, "visitSummary"),
        comments: nullable(form, "comments"),
      };
    setBusy(true);
    setError("");
    try {
      await fetch("/api/sponsorship", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(value),
      }).then(parse);
      onSaved(
        `${sections.find((item) => item.id === section)?.singular ?? "Record"} ${id ? "updated" : "created"}.`,
      );
    } catch (reason) {
      setError(messageOf(reason));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Sheet onOpenChange={onOpenChange} open={Boolean(record)}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-2xl">
        <div className="border-b px-6 py-5 pr-16">
          <SheetTitle>
            {record === "new" ? "New" : "Edit"}{" "}
            {sections.find((item) => item.id === section)?.singular}
          </SheetTitle>
          <SheetDescription>Changes are recorded in the organisation audit trail.</SheetDescription>
        </div>
        <form className="space-y-5 p-6" onSubmit={submit}>
          {section !== "sponsors" && section !== "visitors" ? (
            <div className="space-y-2 rounded-xl border bg-muted/25 p-3">
              <Label htmlFor="sponsorship-lookup">Find a beneficiary, sponsor, or visitor</Label>
              <Input
                id="sponsorship-lookup"
                onChange={(event) => setLookup(event.target.value)}
                placeholder="Type a name or admission number before choosing below"
                value={lookup}
              />
            </div>
          ) : null}
          {section === "sponsors" ? <SponsorFields record={record} setup={editorSetup} /> : null}
          {section === "assignments" ? (
            <AssignmentFields
              activeSessionId={activeSessionId}
              record={record}
              setup={editorSetup}
            />
          ) : null}
          {section === "funds" ? (
            <FundFields
              activeSessionId={activeSessionId}
              allocations={allocations}
              record={record}
              setup={editorSetup}
            />
          ) : null}
          {section === "correspondence" ? (
            <CorrespondenceFields
              activeSessionId={activeSessionId}
              record={record}
              setup={editorSetup}
            />
          ) : null}
          {section === "visitors" ? <VisitorFields record={record} setup={editorSetup} /> : null}
          {error ? <ErrorNotice>{error}</ErrorNotice> : null}
          <div className="flex justify-end gap-2">
            <Button onClick={() => onOpenChange(false)} type="button" variant="outline">
              Cancel
            </Button>
            <Button disabled={busy} type="submit">
              {busy ? <LoaderCircle className="animate-spin" /> : null} Save
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}

function SponsorFields({ record, setup }: { record: Row | "new" | null; setup: Setup | null }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <TextField
        defaultValue={field(record, "firstName")}
        label="First name"
        name="firstName"
        required
      />
      <TextField defaultValue={field(record, "middleName")} label="Middle name" name="middleName" />
      <TextField defaultValue={field(record, "lastName")} label="Last name" name="lastName" />
      <SelectField
        defaultValue={field(record, "sponsorOrganizationId")}
        label="Organisation"
        name="sponsorOrganizationId"
        optional
        options={setup?.organizations ?? []}
      />
      <SelectField
        defaultValue={field(record, "sponsorTypeId")}
        label="Sponsor type"
        name="sponsorTypeId"
        optional
        options={setup?.sponsorTypes ?? []}
      />
      <SelectField
        defaultValue={field(record, "sponsorCategoryId")}
        label="Category"
        name="sponsorCategoryId"
        optional
        options={setup?.sponsorCategories ?? []}
      />
      <TextField defaultValue={field(record, "countryName")} label="Country" name="countryName" />
      <TextField defaultValue={field(record, "email")} label="Email" name="email" type="email" />
      <TextField defaultValue={field(record, "phone")} label="Phone" name="phone" />
      <TextField
        className="sm:col-span-2"
        defaultValue={field(record, "address")}
        label="Address"
        name="address"
      />
    </div>
  );
}
function AssignmentFields({
  activeSessionId,
  record,
  setup,
}: {
  activeSessionId: string;
  record: Row | "new" | null;
  setup: Setup | null;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <SelectField
        defaultValue={field(record, "personId")}
        label="Beneficiary"
        name="personId"
        options={withCurrent(
          setup?.people ?? [],
          field(record, "personId"),
          field(record, "personName"),
          field(record, "admissionNumber"),
        )}
        required
      />
      <SelectField
        defaultValue={field(record, "sponsorIndividualId")}
        label="Sponsor"
        name="sponsorIndividualId"
        options={withCurrent(
          setup?.individuals ?? [],
          field(record, "sponsorIndividualId"),
          field(record, "sponsorName"),
        )}
        required
      />
      <SelectField
        defaultValue={field(record, "statusId")}
        label="Status"
        name="statusId"
        options={setup?.statuses ?? []}
        required
      />
      <SelectField
        defaultValue={field(record, "sessionId") || activeSessionId}
        label="Session"
        name="sessionId"
        optional
        options={setup?.sessions ?? []}
      />
      <TextField
        defaultValue={field(record, "statusOn") || today()}
        label="Status date"
        name="statusOn"
        required
        type="date"
      />
      <TextField
        className="sm:col-span-2"
        defaultValue={field(record, "remarks")}
        label="Remarks"
        name="remarks"
      />
    </div>
  );
}
function FundFields({
  activeSessionId,
  allocations,
  record,
  setup,
}: {
  activeSessionId: string;
  allocations: Allocation[];
  record: Row | "new" | null;
  setup: Setup | null;
}) {
  const [kind, setKind] = useState(field(record, "sponsorKind") || "individual");
  const [lines, setLines] = useState<Allocation[]>(allocations.length ? allocations : []);
  const partyOptions = withCurrent(
    kind === "organization"
      ? (setup?.organizations ?? [])
      : kind === "visitor"
        ? (setup?.visitors ?? [])
        : (setup?.individuals ?? []),
    field(record, "sponsorPartyId"),
    field(record, "sponsorName"),
  );
  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField
          defaultValue={field(record, "fundTypeId")}
          label="Fund type"
          name="fundTypeId"
          options={setup?.fundTypes ?? []}
          required
        />
        <SelectField
          defaultValue={field(record, "sessionId") || activeSessionId}
          label="Session"
          name="sessionId"
          optional
          options={setup?.sessions ?? []}
        />
        <SelectField
          defaultValue={kind}
          label="Source kind"
          name="sponsorKind"
          onChange={setKind}
          options={[
            { id: "individual", name: "Individual sponsor" },
            { id: "organization", name: "Organisation" },
            { id: "visitor", name: "Visitor / donor" },
          ]}
          required
        />
        <SelectField
          defaultValue={field(record, "sponsorPartyId")}
          label="Sponsor / donor"
          name="sponsorPartyId"
          options={partyOptions}
          required
        />
        <TextField
          defaultValue={field(record, "receivedOn") || today()}
          label="Received on"
          name="receivedOn"
          required
          type="date"
        />
        <TextField
          defaultValue={field(record, "amount")}
          label="Amount"
          min="0"
          name="amount"
          required
          step="0.01"
          type="number"
        />
        <TextField
          defaultValue={field(record, "periodFrom")}
          label="Period from"
          name="periodFrom"
          type="date"
        />
        <TextField
          defaultValue={field(record, "periodTo")}
          label="Period to"
          name="periodTo"
          type="date"
        />
        <TextField
          defaultValue={field(record, "receiptNumber")}
          label="Receipt number"
          name="receiptNumber"
        />
        <TextField defaultValue={field(record, "remarks")} label="Remarks" name="remarks" />
      </div>
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Beneficiary allocations</p>
            <p className="text-xs text-muted-foreground">Optionally distribute this remittance.</p>
          </div>
          <Button
            onClick={() => setLines([...lines, { personId: "", amount: 0 }])}
            size="sm"
            type="button"
            variant="outline"
          >
            <Plus /> Add
          </Button>
        </div>
        {lines.map((line, index) => (
          <div
            className="grid gap-2 rounded-xl border p-3 sm:grid-cols-[1fr_120px_1fr_auto]"
            key={`${index}-${line.personId}`}
          >
            <SelectField
              defaultValue={line.personId}
              label="Beneficiary"
              name="allocationPersonId"
              options={withCurrent(setup?.people ?? [], line.personId, line.personName ?? "")}
              required
            />
            <TextField
              defaultValue={String(line.amount)}
              label="Amount"
              min="0"
              name="allocationAmount"
              required
              step="0.01"
              type="number"
            />
            <TextField defaultValue={line.remarks ?? ""} label="Remarks" name="allocationRemarks" />
            <Button
              aria-label="Remove allocation"
              className="self-end"
              onClick={() => setLines(lines.filter((_, itemIndex) => itemIndex !== index))}
              size="icon"
              type="button"
              variant="ghost"
            >
              ×
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
function CorrespondenceFields({
  activeSessionId,
  record,
  setup,
}: {
  activeSessionId: string;
  record: Row | "new" | null;
  setup: Setup | null;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <SelectField
        defaultValue={field(record, "correspondenceTypeId")}
        label="Type"
        name="correspondenceTypeId"
        options={setup?.correspondenceTypes ?? []}
        required
      />
      <SelectField
        defaultValue={field(record, "sessionId") || activeSessionId}
        label="Session"
        name="sessionId"
        optional
        options={setup?.sessions ?? []}
      />
      <SelectField
        defaultValue={field(record, "sponsorIndividualId")}
        label="Sponsor"
        name="sponsorIndividualId"
        optional
        options={withCurrent(
          setup?.individuals ?? [],
          field(record, "sponsorIndividualId"),
          field(record, "sponsorName"),
        )}
      />
      <SelectField
        defaultValue={field(record, "personId")}
        label="Beneficiary"
        name="personId"
        optional
        options={withCurrent(
          setup?.people ?? [],
          field(record, "personId"),
          field(record, "personName"),
          field(record, "admissionNumber"),
        )}
      />
      <TextField defaultValue={field(record, "sender")} label="Sender" name="sender" />
      <TextField defaultValue={field(record, "receiver")} label="Receiver" name="receiver" />
      <TextField
        defaultValue={field(record, "receivedOn") || today()}
        label="Received on"
        name="receivedOn"
        required
        type="date"
      />
      <TextField
        defaultValue={field(record, "repliedOn")}
        label="Replied on"
        name="repliedOn"
        type="date"
      />
      <TextField
        defaultValue={field(record, "replyDueOn")}
        label="Reply due"
        name="replyDueOn"
        type="date"
      />
      <TextField
        className="sm:col-span-2"
        defaultValue={field(record, "remarks")}
        label="Remarks"
        name="remarks"
      />
    </div>
  );
}
function VisitorFields({ record, setup }: { record: Row | "new" | null; setup: Setup | null }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <SelectField
        defaultValue={field(record, "visitorTypeId")}
        label="Visitor type"
        name="visitorTypeId"
        optional
        options={setup?.visitorTypes ?? []}
      />
      <TextField
        defaultValue={field(record, "visitedOn") || today()}
        label="Visited on"
        name="visitedOn"
        required
        type="date"
      />
      <TextField
        defaultValue={field(record, "firstName")}
        label="First name"
        name="firstName"
        required
      />
      <TextField defaultValue={field(record, "middleName")} label="Middle name" name="middleName" />
      <TextField defaultValue={field(record, "lastName")} label="Last name" name="lastName" />
      <TextField defaultValue={field(record, "countryName")} label="Country" name="countryName" />
      <TextField defaultValue={field(record, "email")} label="Email" name="email" type="email" />
      <TextField defaultValue={field(record, "phone")} label="Phone" name="phone" />
      <TextField
        defaultValue={field(record, "relatedPersonName")}
        label="Related person"
        name="relatedPersonName"
      />
      <TextField
        defaultValue={field(record, "mementoQuantity")}
        label="Memento quantity"
        min="0"
        name="mementoQuantity"
        type="number"
      />
      <TextField
        className="sm:col-span-2"
        defaultValue={field(record, "address")}
        label="Address"
        name="address"
      />
      <TextField
        className="sm:col-span-2"
        defaultValue={field(record, "giftsPresented")}
        label="Gifts presented"
        name="giftsPresented"
      />
      <TextField
        className="sm:col-span-2"
        defaultValue={field(record, "visitSummary")}
        label="Visit summary"
        name="visitSummary"
      />
      <TextField
        className="sm:col-span-2"
        defaultValue={field(record, "comments")}
        label="Comments"
        name="comments"
      />
    </div>
  );
}

function SponsorshipSetup({
  onOpenChange,
  onSaved,
  open,
  setup,
}: {
  onOpenChange: (open: boolean) => void;
  onSaved: (message: string) => void;
  open: boolean;
  setup: Setup | null;
}) {
  const [kind, setKind] = useState("organization");
  const [selected, setSelected] = useState<Option | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const kinds = [
    { id: "organization", name: "Sponsor organisation" },
    { id: "sponsorType", name: "Sponsor type" },
    { id: "sponsorCategory", name: "Sponsor category" },
    { id: "status", name: "Sponsorship status" },
    { id: "fundType", name: "Fund type" },
    { id: "correspondenceType", name: "Correspondence type" },
    { id: "visitorType", name: "Visitor type" },
  ];
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const value =
      kind === "organization"
        ? {
            kind,
            id: selected?.id,
            name: required(form, "name"),
            countryName: nullable(form, "countryName"),
            supportsChildren: form.get("supportsChildren") === "on",
            supportsElderly: form.get("supportsElderly") === "on",
          }
        : { kind, id: selected?.id, name: required(form, "name") };
    setBusy(true);
    setError("");
    try {
      await fetch("/api/sponsorship", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(value),
      }).then(parse);
      event.currentTarget.reset();
      setSelected(null);
      onSaved("Sponsorship setup updated.");
    } catch (reason) {
      setError(messageOf(reason));
    } finally {
      setBusy(false);
    }
  }
  const current =
    kind === "organization"
      ? setup?.organizations
      : kind === "sponsorType"
        ? setup?.sponsorTypes
        : kind === "sponsorCategory"
          ? setup?.sponsorCategories
          : kind === "status"
            ? setup?.statuses
            : kind === "fundType"
              ? setup?.fundTypes
              : kind === "correspondenceType"
                ? setup?.correspondenceTypes
                : setup?.visitorTypes;
  return (
    <Sheet onOpenChange={onOpenChange} open={open}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        <div className="border-b px-6 py-5 pr-16">
          <SheetTitle>Sponsorship setup</SheetTitle>
          <SheetDescription>
            Add organisations and controlled-list values used by operational records.
          </SheetDescription>
        </div>
        <form className="space-y-5 p-6" key={`${kind}-${selected?.id ?? "new"}`} onSubmit={submit}>
          <SelectField
            defaultValue={kind}
            label="Setup area"
            name="setupKind"
            onChange={(value) => {
              setKind(value);
              setSelected(null);
            }}
            options={kinds}
            required
          />
          <TextField defaultValue={selected?.name} label="Name" name="name" required />
          {kind === "organization" ? (
            <>
              <TextField
                defaultValue={selected?.countryName ?? ""}
                label="Country"
                name="countryName"
              />
              <div className="flex gap-5 text-sm">
                <label className="flex items-center gap-2">
                  <input
                    defaultChecked={Boolean(selected?.supportsChildren)}
                    name="supportsChildren"
                    type="checkbox"
                  />{" "}
                  Supports children
                </label>
                <label className="flex items-center gap-2">
                  <input
                    defaultChecked={Boolean(selected?.supportsElderly)}
                    name="supportsElderly"
                    type="checkbox"
                  />{" "}
                  Supports elderly
                </label>
              </div>
            </>
          ) : null}
          {error ? <ErrorNotice>{error}</ErrorNotice> : null}
          <Button disabled={busy} type="submit">
            {busy ? <LoaderCircle className="animate-spin" /> : selected ? <Pencil /> : <Plus />}{" "}
            {selected ? "Save changes" : "Add"}
          </Button>
          <div className="space-y-2 border-t pt-5">
            <p className="text-sm font-medium">Existing values</p>
            <div className="flex flex-wrap gap-2">
              {current?.map((item) => (
                <Button
                  key={item.id}
                  onClick={() => setSelected(item)}
                  size="sm"
                  type="button"
                  variant={selected?.id === item.id ? "default" : "secondary"}
                >
                  {item.name}
                </Button>
              ))}
            </div>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}

function SponsorshipReports({
  activeSessionId,
  onOpenChange,
  open,
  sessions,
}: {
  activeSessionId: string;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  sessions: Option[];
}) {
  const [report, setReport] = useState("sponsors");
  const [session, setSession] = useState(activeSessionId || "all");
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const options = [
    { id: "homeWise", name: "Sponsor list · home-wise" },
    { id: "organizationWise", name: "Sponsor list · organisation-wise" },
    { id: "addresses", name: "Address of sponsors" },
    { id: "completionElderly", name: "Completion report · elderly" },
    { id: "completionStudent", name: "Completion report · student" },
    { id: "caseHistoryStudent", name: "Case history · student" },
    { id: "caseHistoryElderly", name: "Case history · elderly" },
    { id: "giftMoney", name: "Gift money" },
    { id: "payments", name: "Sponsorship payment list" },
    { id: "sponsors", name: "Sponsors list" },
    { id: "visitors", name: "Visitor list" },
  ];
  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    setLoading(true);
    setError("");
    void fetch(`/api/sponsorship/reports?${new URLSearchParams({ report, session })}`, {
      signal: controller.signal,
    })
      .then(parse<ReportData>)
      .then(setData)
      .catch((reason: unknown) => {
        if (!controller.signal.aborted) setError(messageOf(reason));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [open, report, session]);
  function exportCsv() {
    if (!data) return;
    downloadCsv(`sponsorship-${data.report}`, [
      data.columns.map((column) => column.label),
      ...data.rows.map((row) => data.columns.map((column) => String(row[column.key] ?? ""))),
    ]);
  }
  return (
    <Sheet onOpenChange={onOpenChange} open={open}>
      <SheetContent className="scholarship-report-portal w-full overflow-y-auto sm:max-w-5xl">
        <div className="border-b px-6 py-5 pr-16">
          <SheetTitle>Sponsorship reports</SheetTitle>
          <SheetDescription>
            The eleven reports available in the legacy sponsorship report center.
          </SheetDescription>
        </div>
        <div className="space-y-5 p-6">
          <div className="scholarship-report-controls grid gap-3 md:grid-cols-[1fr_240px_auto_auto] md:items-end">
            <SelectField
              defaultValue={report}
              label="Report"
              name="report"
              onChange={setReport}
              options={options}
              required
            />
            <SelectField
              defaultValue={session}
              label="Academic session"
              name="session"
              onChange={setSession}
              options={[{ id: "all", name: "All sessions" }, ...sessions]}
              required
            />
            <Button disabled={!data || loading} onClick={exportCsv} variant="outline">
              <Download /> CSV
            </Button>
            <Button disabled={!data || loading} onClick={() => window.print()} variant="outline">
              <Printer /> Print
            </Button>
          </div>
          {error ? <ErrorNotice>{error}</ErrorNotice> : null}
          <div className="scholarship-legacy-report rounded-2xl border bg-background">
            {loading ? (
              <div className="grid min-h-64 place-items-center">
                <LoaderCircle className="animate-spin" />
              </div>
            ) : data ? (
              <>
                <div className="border-b p-5">
                  <p className="text-lg font-semibold">{data.title}</p>
                  <p className="text-sm text-muted-foreground">
                    {data.sessionName} · {data.rows.length.toLocaleString()} rows
                  </p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[760px] text-sm">
                    <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                      <tr>
                        {data.columns.map((column) => (
                          <th
                            className={`px-4 py-3 ${column.numeric ? "text-right" : ""}`}
                            key={column.key}
                          >
                            {column.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {data.rows.map((row, index) => (
                        <tr key={index}>
                          {data.columns.map((column) => (
                            <td
                              className={`px-4 py-3 ${column.numeric ? "text-right tabular-nums" : ""}`}
                              key={column.key}
                            >
                              {column.numeric && /amount/i.test(column.key)
                                ? money(Number(row[column.key] ?? 0))
                                : String(row[column.key] ?? "—")}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {!data.rows.length ? (
                    <p className="p-8 text-center text-sm text-muted-foreground">
                      No records for this report and session.
                    </p>
                  ) : null}
                </div>
              </>
            ) : null}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Users;
  label: string;
  value: string | number;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <Icon className="size-4 text-primary" />
        <p className="mt-2 text-2xl font-semibold tabular-nums">
          {typeof value === "number" ? value.toLocaleString() : value}
        </p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </CardContent>
    </Card>
  );
}
function TextField({
  className = "",
  label,
  name,
  ...props
}: React.ComponentProps<typeof Input> & { label: string; name: string }) {
  return (
    <div className={`space-y-2 ${className}`}>
      <Label htmlFor={`sponsorship-${name}`}>{label}</Label>
      <Input id={`sponsorship-${name}`} name={name} {...props} />
    </div>
  );
}
function SelectField({
  defaultValue,
  label,
  name,
  onChange,
  optional,
  options,
  required,
}: {
  defaultValue?: string;
  label: string;
  name: string;
  onChange?: (value: string) => void;
  optional?: boolean;
  options: Option[];
  required?: boolean;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Select
        defaultValue={defaultValue || (optional ? "__none" : undefined)}
        name={name}
        onValueChange={onChange}
        required={required}
      >
        <SelectTrigger>
          <SelectValue placeholder={`Choose ${label.toLowerCase()}`} />
        </SelectTrigger>
        <SelectContent>
          {optional ? <SelectItem value="__none">Not recorded</SelectItem> : null}
          {options.map((item) => (
            <SelectItem key={item.id} value={item.id}>
              {item.name}
              {item.admissionNumber ? ` · ${item.admissionNumber}` : ""}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
function Notice({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-800 dark:text-emerald-200">
      {children}
    </p>
  );
}
function ErrorNotice({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
      {children}
    </p>
  );
}
function text(row: Row, key: string) {
  const value = row[key];
  return typeof value === "string" ? value : typeof value === "number" ? String(value) : "";
}
function number(row: Row, key: string) {
  const value = row[key];
  return typeof value === "number" ? value : Number(value ?? 0);
}
function field(record: Row | "new" | null, key: string) {
  return record && record !== "new" ? text(record, key) : "";
}
function withCurrent(
  options: Option[],
  id: string,
  name: string,
  admissionNumber?: string,
): Option[] {
  if (!id || !name || options.some((option) => option.id === id)) return options;
  return [{ id, name, admissionNumber: admissionNumber || undefined }, ...options];
}
function required(form: FormData, key: string) {
  const value = form.get(key);
  return typeof value === "string" ? value : "";
}
function nullable(form: FormData, key: string) {
  const value = required(form, key);
  return value && value !== "__none" ? value : null;
}
function numeric(form: FormData, key: string) {
  return Number(form.get(key) ?? 0);
}
function nullableNumber(form: FormData, key: string) {
  const value = required(form, key);
  return value ? Number(value) : null;
}
function today() {
  return new Date().toISOString().slice(0, 10);
}
function displayDate(value: string) {
  if (!value) return "";
  const parsed = new Date(`${value.slice(0, 10)}T00:00:00`);
  return Number.isNaN(parsed.valueOf())
    ? value
    : new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" }).format(
        parsed,
      );
}
function money(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(value || 0);
}
async function parse<T = unknown>(response: Response): Promise<T> {
  const body = (await response.json().catch(() => ({}))) as { error?: string };
  if (!response.ok) throw new Error(body.error ?? "Sponsorship request failed.");
  return body as T;
}
function messageOf(reason: unknown) {
  return reason instanceof Error ? reason.message : "Sponsorship request failed.";
}
function csvCell(value: string) {
  return `"${value.replaceAll('"', '""')}"`;
}
function downloadCsv(name: string, rows: string[][]) {
  const csv = rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
  const url = URL.createObjectURL(new Blob([`\ufeff${csv}`], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `${name}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}
