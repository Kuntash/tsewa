import {
  ArrowLeft,
  BriefcaseBusiness,
  Building2,
  ChevronLeft,
  ChevronRight,
  LoaderCircle,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Search,
  ShieldCheck,
  UserRoundCheck,
  UsersRound,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { FormEvent, ReactNode } from "react";

import { ThemeToggle } from "@/components/theme-toggle";
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
import { authClient } from "@/lib/auth-client";
import { useDebouncedValue } from "@/lib/use-debounced-value";

type StaffStatus = "active" | "inactive";
type CatalogItem = { id: string; name: string };
type Designation = CatalogItem & { departmentId: string | null };

type StaffRow = {
  personId: string;
  staffNumber: string;
  displayName: string;
  status: StaffStatus;
  gender: string | null;
  dateOfBirth: string | null;
  joinedOn: string | null;
  location: string | null;
  departmentId: string | null;
  departmentName: string | null;
  designationId: string | null;
  designationName: string | null;
  categoryId: string | null;
  categoryName: string | null;
  permanentOn: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  maritalStatus: string | null;
  spouseName: string | null;
  settlementName: string | null;
  allocatedPlace: string | null;
  registrationCertificateNumber: string | null;
  panNumber: string | null;
  quarterNumber: string | null;
  nominee: string | null;
  birthPlace: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
  identityCardNumber: string | null;
  greenBookNumber: string | null;
  withdrawalReason: string | null;
  withdrawalOn: string | null;
  remarks: string | null;
  legacyDepartmentId: string | null;
  legacyDesignationId: string | null;
};

type StaffResponse = {
  staff: StaffRow[];
  summary: Array<{ status: StaffStatus; total: number }>;
  departments: CatalogItem[];
  designations: Designation[];
  categories: CatalogItem[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
  capabilities: { manage: boolean };
};

const emptyState: StaffResponse = {
  staff: [],
  summary: [],
  departments: [],
  designations: [],
  categories: [],
  pagination: { page: 1, pageSize: 25, total: 0, totalPages: 0 },
  capabilities: { manage: false },
};

export type StaffFilters = {
  q?: string;
  status?: "all" | StaffStatus;
  department?: string;
  page?: number;
};

export function StaffOperations({
  filters = {},
  onBack,
  onFiltersChange,
}: {
  filters?: StaffFilters;
  onBack: () => void;
  onFiltersChange?: (filters: StaffFilters) => void;
}) {
  const [query, setQuery] = useState(filters.q ?? "");
  const debouncedQuery = useDebouncedValue(query);
  const [status, setStatus] = useState<"all" | StaffStatus>(filters.status ?? "all");
  const [department, setDepartment] = useState(filters.department ?? "all");
  const [page, setPage] = useState(filters.page ?? 1);
  const [data, setData] = useState<StaffResponse>(emptyState);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<StaffRow | null>(null);
  const [refreshVersion, setRefreshVersion] = useState(0);

  useEffect(() => {
    setQuery(filters.q ?? "");
    setStatus(filters.status ?? "all");
    setDepartment(filters.department ?? "all");
    setPage(filters.page ?? 1);
  }, [filters.department, filters.page, filters.q, filters.status]);

  useEffect(() => {
    onFiltersChange?.({
      q: debouncedQuery || undefined,
      status,
      department,
      page,
    });
  }, [debouncedQuery, department, onFiltersChange, page, status]);

  useEffect(() => {
    const controller = new AbortController();
    const parameters = new URLSearchParams({
      q: debouncedQuery,
      status,
      department,
      page: String(page),
      pageSize: "25",
    });
    setLoading(true);
    setError("");
    void fetch(`/api/staff?${parameters}`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) {
          const payload = (await response.json()) as { error?: string };
          throw new Error(payload.error ?? "Staff records could not be loaded.");
        }
        return response.json() as Promise<StaffResponse>;
      })
      .then(setData)
      .catch((cause: unknown) => {
        if (cause instanceof DOMException && cause.name === "AbortError") return;
        setError(cause instanceof Error ? cause.message : "Staff records could not be loaded.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [debouncedQuery, department, page, refreshVersion, status]);

  useEffect(() => setPage(1), [department, status]);

  const counts = useMemo(() => {
    const next = { active: 0, inactive: 0, all: 0 };
    for (const item of data.summary) {
      next[item.status] = Number(item.total);
      next.all += Number(item.total);
    }
    return next;
  }, [data.summary]);

  return (
    <main className="min-h-svh w-full max-w-none bg-muted/30">
      <header className="sticky top-0 z-20 flex h-16 items-center border-b bg-background/95 px-4 backdrop-blur md:px-6">
        <button className="flex min-w-0 items-center gap-3" onClick={onBack} type="button">
          <div className="grid size-9 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground">
            <BriefcaseBusiness className="size-4" />
          </div>
          <div className="min-w-0 text-left">
            <div className="truncate text-sm font-semibold tracking-tight">Tsewa</div>
            <div className="truncate text-[11px] text-muted-foreground">Staff operations</div>
          </div>
        </button>
        <div className="ml-auto flex items-center gap-2">
          <ThemeToggle />
          <Button
            className="hidden sm:inline-flex"
            onClick={() => void authClient.signOut().then(() => window.location.reload())}
            variant="ghost"
          >
            Sign out
          </Button>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-7 md:px-8 md:py-10">
        <Button className="-ml-3 mb-4" onClick={onBack} size="sm" variant="ghost">
          <ArrowLeft /> Dashboard
        </Button>
        <div className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-end">
          <div>
            <p className="text-sm font-medium text-primary">Staff operations</p>
            <h1 className="mt-1 text-3xl font-semibold tracking-[-0.045em] md:text-4xl">
              Employment directory
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              Employment, department, designation, and contact records in one organisation-scoped
              workspace.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <Summary value={counts.all} label="Staff" icon={UsersRound} />
            <Summary value={counts.active} label="Active" icon={UserRoundCheck} />
            <Summary value={data.departments.length} label="Departments" icon={Building2} />
          </div>
        </div>

        <Card className="mt-7 overflow-hidden">
          <CardContent className="p-0">
            <div className="grid gap-3 border-b bg-card p-4 lg:grid-cols-[minmax(260px,1fr)_190px_220px]">
              <div className="relative min-w-0">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  aria-label="Search staff"
                  className="w-full pl-10"
                  onChange={(event) => {
                    setQuery(event.target.value);
                    setPage(1);
                  }}
                  placeholder="Search name, staff number, email, or phone"
                  value={query}
                />
              </div>
              <Select onValueChange={(value) => setStatus(value as typeof status)} value={status}>
                <SelectTrigger className="w-full rounded-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
              <Select onValueChange={setDepartment} value={department}>
                <SelectTrigger className="w-full rounded-full">
                  <SelectValue placeholder="All departments" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All departments</SelectItem>
                  {data.departments.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {error ? (
              <div className="m-5 rounded-xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {error}
              </div>
            ) : loading ? (
              <div className="grid min-h-80 place-items-center">
                <div className="text-center">
                  <LoaderCircle className="mx-auto size-5 animate-spin text-primary" />
                  <p className="mt-3 text-sm text-muted-foreground">Loading staff records…</p>
                </div>
              </div>
            ) : data.staff.length ? (
              <StaffResults data={data} onSelect={setSelected} setPage={setPage} />
            ) : (
              <div className="grid min-h-80 place-items-center px-6 text-center">
                <div className="max-w-sm">
                  <BriefcaseBusiness className="mx-auto size-7 text-muted-foreground" />
                  <h2 className="mt-4 text-lg font-semibold">No matching staff</h2>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    Try a different name, status, or department.
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <StaffEditor
        categories={data.categories}
        canManage={data.capabilities.manage}
        departments={data.departments}
        designations={data.designations}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
        onSaved={() => {
          setSelected(null);
          setRefreshVersion((value) => value + 1);
        }}
        staff={selected}
      />
    </main>
  );
}

function Summary({
  value,
  label,
  icon: Icon,
}: {
  value: number;
  label: string;
  icon: typeof UsersRound;
}) {
  return (
    <div className="min-w-0 rounded-2xl border bg-card px-3 py-3 sm:min-w-28 sm:px-4">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="size-3.5 shrink-0" />
        <span className="truncate text-[10px] font-semibold uppercase tracking-[0.1em]">
          {label}
        </span>
      </div>
      <p className="mt-1.5 text-xl font-semibold tabular-nums tracking-[-0.03em]">
        {value.toLocaleString()}
      </p>
    </div>
  );
}

function StaffResults({
  data,
  onSelect,
  setPage,
}: {
  data: StaffResponse;
  onSelect: (staff: StaffRow) => void;
  setPage: (page: number | ((value: number) => number)) => void;
}) {
  return (
    <>
      <div className="hidden md:block">
        <div className="grid grid-cols-[minmax(180px,1.3fr)_minmax(150px,1fr)_minmax(150px,1fr)_130px_92px_40px] gap-4 border-b bg-muted/35 px-5 py-3 text-xs font-medium text-muted-foreground">
          <span>Staff member</span>
          <span>Department</span>
          <span>Designation</span>
          <span>Contact</span>
          <span>Status</span>
          <span className="sr-only">Edit</span>
        </div>
        {data.staff.map((staff) => (
          <button
            className="grid w-full grid-cols-[minmax(180px,1.3fr)_minmax(150px,1fr)_minmax(150px,1fr)_130px_92px_40px] items-center gap-4 border-b px-5 py-4 text-left text-sm transition-colors last:border-b-0 hover:bg-muted/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
            key={staff.personId}
            onClick={() => onSelect(staff)}
            type="button"
          >
            <span className="min-w-0">
              <span className="block truncate font-semibold">{staff.displayName}</span>
              <span className="mt-1 block truncate font-mono text-xs text-muted-foreground">
                {staff.staffNumber}
              </span>
            </span>
            <span className="truncate text-muted-foreground">
              {staff.departmentName ?? legacyLabel(staff.legacyDepartmentId)}
            </span>
            <span className="truncate text-muted-foreground">
              {staff.designationName ?? legacyLabel(staff.legacyDesignationId)}
            </span>
            <span className="min-w-0 text-xs text-muted-foreground">
              <span className="block truncate">{staff.phone || "No phone"}</span>
              <span className="mt-1 block truncate">{staff.email || "No email"}</span>
            </span>
            <StatusBadge status={staff.status} />
            <Pencil className="size-4 text-muted-foreground" />
          </button>
        ))}
      </div>

      <div className="divide-y md:hidden">
        {data.staff.map((staff) => (
          <button
            className="w-full p-4 text-left transition-colors hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
            key={staff.personId}
            onClick={() => onSelect(staff)}
            type="button"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-semibold">{staff.displayName}</p>
                <p className="mt-1 font-mono text-xs text-muted-foreground">{staff.staffNumber}</p>
              </div>
              <StatusBadge status={staff.status} />
            </div>
            <div className="mt-3 grid gap-1.5 text-sm text-muted-foreground">
              <p className="flex min-w-0 items-center gap-2">
                <Building2 className="size-3.5 shrink-0" />
                <span className="truncate">
                  {staff.departmentName || "Department not recorded"}
                </span>
              </p>
              <p className="flex min-w-0 items-center gap-2">
                <BriefcaseBusiness className="size-3.5 shrink-0" />
                <span className="truncate">
                  {staff.designationName || "Designation not recorded"}
                </span>
              </p>
              {staff.location ? (
                <p className="flex min-w-0 items-center gap-2">
                  <MapPin className="size-3.5 shrink-0" />
                  <span className="truncate">{staff.location}</span>
                </p>
              ) : null}
            </div>
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-3 border-t bg-muted/20 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
        <p className="text-muted-foreground">
          {data.pagination.total.toLocaleString()} staff · page {data.pagination.page} of{" "}
          {Math.max(data.pagination.totalPages, 1)}
        </p>
        <div className="grid grid-cols-2 gap-2 sm:flex">
          <Button
            disabled={data.pagination.page <= 1}
            onClick={() => setPage((value) => Math.max(1, value - 1))}
            size="sm"
            variant="outline"
          >
            <ChevronLeft /> Previous
          </Button>
          <Button
            disabled={data.pagination.page >= data.pagination.totalPages}
            onClick={() => setPage((value) => value + 1)}
            size="sm"
            variant="outline"
          >
            Next <ChevronRight />
          </Button>
        </div>
      </div>
    </>
  );
}

function StaffEditor({
  staff,
  departments,
  designations,
  categories,
  canManage,
  onOpenChange,
  onSaved,
}: {
  staff: StaffRow | null;
  departments: CatalogItem[];
  designations: Designation[];
  categories: CatalogItem[];
  canManage: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const [departmentId, setDepartmentId] = useState("none");
  const [designationId, setDesignationId] = useState("none");
  const [categoryId, setCategoryId] = useState("none");
  const [status, setStatus] = useState<StaffStatus>("active");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setDepartmentId(staff?.departmentId ?? "none");
    setDesignationId(staff?.designationId ?? "none");
    setCategoryId(staff?.categoryId ?? "none");
    setStatus(staff?.status ?? "active");
    setError("");
  }, [staff]);

  const availableDesignations = designations.filter(
    (item) => departmentId === "none" || !item.departmentId || item.departmentId === departmentId,
  );

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!staff || !canManage) return;
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const response = await fetch(`/api/staff/${staff.personId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        status,
        departmentId: nullableChoice(departmentId),
        designationId: nullableChoice(designationId),
        categoryId: nullableChoice(categoryId),
        joinedOn: nullable(form.get("joinedOn")),
        permanentOn: nullable(form.get("permanentOn")),
        location: nullable(form.get("location")),
        phone: nullable(form.get("phone")),
        email: nullable(form.get("email")),
        address: nullable(form.get("address")),
        maritalStatus: nullable(form.get("maritalStatus")),
        spouseName: nullable(form.get("spouseName")),
        settlementName: nullable(form.get("settlementName")),
        allocatedPlace: nullable(form.get("allocatedPlace")),
        registrationCertificateNumber: nullable(form.get("registrationCertificateNumber")),
        panNumber: nullable(form.get("panNumber")),
        quarterNumber: nullable(form.get("quarterNumber")),
        nominee: nullable(form.get("nominee")),
        birthPlace: nullable(form.get("birthPlace")),
        city: nullable(form.get("city")),
        region: nullable(form.get("region")),
        country: nullable(form.get("country")),
        identityCardNumber: nullable(form.get("identityCardNumber")),
        greenBookNumber: nullable(form.get("greenBookNumber")),
        remarks: nullable(form.get("remarks")),
      }),
    });
    const payload = (await response.json()) as { error?: string };
    setBusy(false);
    if (!response.ok) {
      setError(payload.error ?? "The staff profile could not be updated.");
      return;
    }
    onSaved();
  }

  return (
    <Sheet onOpenChange={onOpenChange} open={Boolean(staff)}>
      <SheetContent className="overflow-y-auto sm:max-w-2xl">
        {staff ? (
          <form className="flex min-h-full flex-col" onSubmit={save}>
            <div className="border-b px-5 pb-5 pt-6 sm:px-7">
              <div className="flex items-start gap-4 pr-10">
                <div className="grid size-11 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary">
                  <BriefcaseBusiness className="size-5" />
                </div>
                <div className="min-w-0">
                  <SheetTitle className="truncate">{staff.displayName}</SheetTitle>
                  <SheetDescription className="mt-1">
                    Staff number {staff.staffNumber}
                  </SheetDescription>
                </div>
              </div>
            </div>

            <div className="flex-1 space-y-8 px-5 py-6 sm:px-7">
              {!canManage ? (
                <div className="flex gap-3 rounded-xl border bg-muted/45 p-4 text-sm text-muted-foreground">
                  <ShieldCheck className="mt-0.5 size-4 shrink-0" />
                  Your access is read-only. A staff manager can update this profile.
                </div>
              ) : null}
              {error ? (
                <div className="rounded-xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                  {error}
                </div>
              ) : null}

              <EditorSection
                title="Employment"
                description="Current organisational placement and status."
              >
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Status">
                    <Select
                      disabled={!canManage}
                      onValueChange={(value) => setStatus(value as StaffStatus)}
                      value={status}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="inactive">Inactive</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="Category">
                    <CatalogSelect
                      disabled={!canManage}
                      items={categories}
                      onChange={setCategoryId}
                      value={categoryId}
                    />
                  </Field>
                  <Field label="Department">
                    <CatalogSelect
                      disabled={!canManage}
                      items={departments}
                      onChange={(value) => {
                        setDepartmentId(value);
                        const selectedDesignation = designations.find(
                          (item) => item.id === designationId,
                        );
                        if (
                          selectedDesignation?.departmentId &&
                          selectedDesignation.departmentId !== value
                        )
                          setDesignationId("none");
                      }}
                      value={departmentId}
                    />
                  </Field>
                  <Field label="Designation">
                    <CatalogSelect
                      disabled={!canManage}
                      items={availableDesignations}
                      onChange={setDesignationId}
                      value={designationId}
                    />
                  </Field>
                  <TextField
                    defaultValue={staff.joinedOn}
                    disabled={!canManage}
                    label="Joined on"
                    name="joinedOn"
                    type="date"
                  />
                  <TextField
                    defaultValue={staff.permanentOn}
                    disabled={!canManage}
                    label="Permanent on"
                    name="permanentOn"
                    type="date"
                  />
                  <TextField
                    defaultValue={staff.location}
                    disabled={!canManage}
                    label="Campus / location"
                    name="location"
                  />
                  <TextField
                    defaultValue={staff.allocatedPlace}
                    disabled={!canManage}
                    label="Allocated place"
                    name="allocatedPlace"
                  />
                </div>
              </EditorSection>

              <EditorSection
                title="Contact"
                description="How the organisation can reach this staff member."
              >
                <div className="grid gap-4 sm:grid-cols-2">
                  <TextField
                    defaultValue={staff.phone}
                    disabled={!canManage}
                    icon={Phone}
                    label="Phone"
                    name="phone"
                    type="tel"
                  />
                  <TextField
                    defaultValue={staff.email}
                    disabled={!canManage}
                    icon={Mail}
                    label="Email"
                    name="email"
                    type="email"
                  />
                  <TextField
                    className="sm:col-span-2"
                    defaultValue={staff.address}
                    disabled={!canManage}
                    label="Address"
                    name="address"
                  />
                  <TextField
                    defaultValue={staff.city}
                    disabled={!canManage}
                    label="City"
                    name="city"
                  />
                  <TextField
                    defaultValue={staff.region}
                    disabled={!canManage}
                    label="State / region"
                    name="region"
                  />
                  <TextField
                    defaultValue={staff.country}
                    disabled={!canManage}
                    label="Country"
                    name="country"
                  />
                  <TextField
                    defaultValue={staff.settlementName}
                    disabled={!canManage}
                    label="Settlement"
                    name="settlementName"
                  />
                </div>
              </EditorSection>

              <EditorSection
                title="Personal and official"
                description="Employment-linked identity and household details."
              >
                <div className="grid gap-4 sm:grid-cols-2">
                  <TextField
                    defaultValue={staff.maritalStatus}
                    disabled={!canManage}
                    label="Marital status"
                    name="maritalStatus"
                  />
                  <TextField
                    defaultValue={staff.spouseName}
                    disabled={!canManage}
                    label="Spouse"
                    name="spouseName"
                  />
                  <TextField
                    defaultValue={staff.birthPlace}
                    disabled={!canManage}
                    label="Birth place"
                    name="birthPlace"
                  />
                  <TextField
                    defaultValue={staff.nominee}
                    disabled={!canManage}
                    label="Nominee"
                    name="nominee"
                  />
                  <TextField
                    defaultValue={staff.registrationCertificateNumber}
                    disabled={!canManage}
                    label="RC number"
                    name="registrationCertificateNumber"
                  />
                  <TextField
                    defaultValue={staff.greenBookNumber}
                    disabled={!canManage}
                    label="Green Book number"
                    name="greenBookNumber"
                  />
                  <TextField
                    defaultValue={staff.identityCardNumber}
                    disabled={!canManage}
                    label="Identity card number"
                    name="identityCardNumber"
                  />
                  <TextField
                    defaultValue={staff.panNumber}
                    disabled={!canManage}
                    label="PAN number"
                    name="panNumber"
                  />
                  <TextField
                    defaultValue={staff.quarterNumber}
                    disabled={!canManage}
                    label="Quarter number"
                    name="quarterNumber"
                  />
                </div>
                <div className="mt-4 space-y-2">
                  <Label htmlFor="staff-remarks">Remarks</Label>
                  <textarea
                    className="min-h-28 w-full resize-y rounded-2xl border bg-transparent px-4 py-3 text-sm outline-none transition-shadow placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                    defaultValue={staff.remarks ?? ""}
                    disabled={!canManage}
                    id="staff-remarks"
                    name="remarks"
                  />
                </div>
              </EditorSection>
            </div>

            <div className="sticky bottom-0 flex flex-col-reverse gap-2 border-t bg-background/95 px-5 py-4 backdrop-blur sm:flex-row sm:justify-end sm:px-7">
              <Button onClick={() => onOpenChange(false)} type="button" variant="outline">
                Close
              </Button>
              {canManage ? (
                <Button disabled={busy} type="submit">
                  {busy ? <LoaderCircle className="animate-spin" /> : <Pencil />}
                  Save staff profile
                </Button>
              ) : null}
            </div>
          </form>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

function EditorSection({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section>
      <h3 className="font-semibold tracking-[-0.015em]">{title}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0 space-y-2">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function TextField({
  label,
  name,
  defaultValue,
  disabled,
  type = "text",
  className = "",
  icon: Icon,
}: {
  label: string;
  name: string;
  defaultValue: string | null;
  disabled: boolean;
  type?: string;
  className?: string;
  icon?: typeof Phone;
}) {
  return (
    <div className={`min-w-0 space-y-2 ${className}`}>
      <Label htmlFor={`staff-${name}`}>{label}</Label>
      <div className="relative">
        {Icon ? (
          <Icon className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        ) : null}
        <Input
          className={Icon ? "pl-10" : undefined}
          defaultValue={dateInput(defaultValue, type)}
          disabled={disabled}
          id={`staff-${name}`}
          name={name}
          type={type}
        />
      </div>
    </div>
  );
}

function CatalogSelect({
  items,
  value,
  onChange,
  disabled,
}: {
  items: CatalogItem[];
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
}) {
  return (
    <Select disabled={disabled} onValueChange={onChange} value={value}>
      <SelectTrigger className="w-full">
        <SelectValue placeholder="Not recorded" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="none">Not recorded</SelectItem>
        {items.map((item) => (
          <SelectItem key={item.id} value={item.id}>
            {item.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function StatusBadge({ status }: { status: StaffStatus }) {
  return (
    <Badge className="w-fit rounded-full" variant={status === "active" ? "default" : "secondary"}>
      {status === "active" ? "Active" : "Inactive"}
    </Badge>
  );
}

function nullable(value: FormDataEntryValue | null): string | null {
  const text = typeof value === "string" ? value.trim() : "";
  return text || null;
}

function nullableChoice(value: string): string | null {
  return value === "none" ? null : value;
}

function dateInput(value: string | null, type: string): string {
  if (!value) return "";
  return type === "date" ? value.slice(0, 10) : value;
}

function legacyLabel(value: string | null): string {
  return value ? `Legacy reference ${value}` : "Not recorded";
}
