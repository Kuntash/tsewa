import { ListFilter, Plus, X } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type CountOption = { id?: string; name: string; count: number };

export type StudentDetailFilters = {
  category?: string;
  gender?: "female" | "male" | "other" | "unknown";
  personStatus?: "active" | "inactive";
  home?: string;
  nationality?: string;
  parentage?: string;
  ageMin?: string;
  ageMax?: string;
  admittedFrom?: string;
  admittedTo?: string;
};

export type StudentDetailOptions = {
  categories: CountOption[];
  homes: CountOption[];
  nationalities: CountOption[];
  parentage: CountOption[];
};

type FieldKey =
  | "category"
  | "gender"
  | "personStatus"
  | "home"
  | "nationality"
  | "parentage"
  | "age"
  | "admitted";

const FIELDS: Array<{ key: FieldKey; label: string; values: Array<keyof StudentDetailFilters> }> = [
  { key: "category", label: "Child category", values: ["category"] },
  { key: "gender", label: "Gender", values: ["gender"] },
  { key: "personStatus", label: "Active or inactive", values: ["personStatus"] },
  { key: "home", label: "Home", values: ["home"] },
  { key: "nationality", label: "Nationality", values: ["nationality"] },
  { key: "parentage", label: "Parents' status", values: ["parentage"] },
  { key: "age", label: "Age", values: ["ageMin", "ageMax"] },
  { key: "admitted", label: "Admission date", values: ["admittedFrom", "admittedTo"] },
];

const GENDER_OPTIONS = [
  { id: "female", name: "Female" },
  { id: "male", name: "Male" },
  { id: "other", name: "Other" },
  { id: "unknown", name: "Not set" },
];

const PERSON_STATUS_OPTIONS = [
  { id: "active", name: "Active" },
  { id: "inactive", name: "Inactive" },
];

// Keeps only the detail filters, in a fixed order, so two equal sets compare equal.
export function pickStudentDetailFilters(source: StudentDetailFilters): StudentDetailFilters {
  const picked: StudentDetailFilters = {};
  if (source.category) picked.category = source.category;
  if (source.gender) picked.gender = source.gender;
  if (source.personStatus) picked.personStatus = source.personStatus;
  if (source.home) picked.home = source.home;
  if (source.nationality) picked.nationality = source.nationality;
  if (source.parentage) picked.parentage = source.parentage;
  if (source.ageMin) picked.ageMin = source.ageMin;
  if (source.ageMax) picked.ageMax = source.ageMax;
  if (source.admittedFrom) picked.admittedFrom = source.admittedFrom;
  if (source.admittedTo) picked.admittedTo = source.admittedTo;
  return picked;
}

export function studentDetailFilterSummary(
  filters: StudentDetailFilters,
  options: StudentDetailOptions,
): string[] {
  const summary: string[] = [];
  const name = (list: Array<{ id?: string; name: string }>, value: string) =>
    list.find((option) => (option.id ?? option.name) === value)?.name ?? value;
  if (filters.category) {
    summary.push(`Child category: ${name(options.categories, filters.category)}`);
  }
  if (filters.gender) summary.push(`Gender: ${name(GENDER_OPTIONS, filters.gender)}`);
  if (filters.personStatus) {
    summary.push(`Status: ${name(PERSON_STATUS_OPTIONS, filters.personStatus)}`);
  }
  if (filters.home) summary.push(`Home: ${name(options.homes, filters.home)}`);
  if (filters.nationality) {
    summary.push(`Nationality: ${name(options.nationalities, filters.nationality)}`);
  }
  if (filters.parentage) {
    summary.push(`Parents' status: ${name(options.parentage, filters.parentage)}`);
  }
  if (filters.ageMin && filters.ageMax) {
    summary.push(`Age: ${filters.ageMin} to ${filters.ageMax}`);
  } else if (filters.ageMin) {
    summary.push(`Age: ${filters.ageMin} or older`);
  } else if (filters.ageMax) {
    summary.push(`Age: ${filters.ageMax} or younger`);
  }
  if (filters.admittedFrom && filters.admittedTo) {
    summary.push(`Admitted: ${filters.admittedFrom} to ${filters.admittedTo}`);
  } else if (filters.admittedFrom) {
    summary.push(`Admitted: from ${filters.admittedFrom}`);
  } else if (filters.admittedTo) {
    summary.push(`Admitted: up to ${filters.admittedTo}`);
  }
  return summary;
}

export function StudentDetailFilterBar({
  onChange,
  options,
  value,
}: {
  onChange: (value: StudentDetailFilters) => void;
  options: StudentDetailOptions;
  value: StudentDetailFilters;
}) {
  // A filter stays on screen once added, even before a value is chosen for it.
  const [added, setAdded] = useState<FieldKey[]>([]);
  const shown = FIELDS.filter(
    (field) => added.includes(field.key) || field.values.some((key) => value[key]),
  );
  const available = FIELDS.filter((field) => !shown.includes(field));

  function set(patch: StudentDetailFilters) {
    onChange(pickStudentDetailFilters({ ...value, ...patch }));
  }

  function remove(field: (typeof FIELDS)[number]) {
    setAdded((current) => current.filter((key) => key !== field.key));
    const next = { ...value };
    for (const key of field.values) delete next[key];
    onChange(pickStudentDetailFilters(next));
  }

  function clear() {
    setAdded([]);
    onChange({});
  }

  return (
    <div className="mt-3 space-y-2">
      {shown.length ? (
        <div className="grid gap-2 lg:grid-cols-2">
          {shown.map((field) => (
            <div
              className="flex items-center gap-2 rounded-2xl border bg-muted/30 py-1.5 pl-3.5 pr-1.5"
              key={field.key}
            >
              <span className="w-28 shrink-0 text-xs font-medium text-muted-foreground">
                {field.label}
              </span>
              <div className="flex min-w-0 flex-1 items-center gap-2">
                {field.key === "category" ? (
                  <ValueSelect
                    label={field.label}
                    onChange={(category) => set({ category })}
                    options={options.categories}
                    value={value.category}
                  />
                ) : field.key === "gender" ? (
                  <ValueSelect
                    label={field.label}
                    onChange={(gender) => set({ gender: gender as StudentDetailFilters["gender"] })}
                    options={GENDER_OPTIONS}
                    value={value.gender}
                  />
                ) : field.key === "personStatus" ? (
                  <ValueSelect
                    label={field.label}
                    onChange={(personStatus) =>
                      set({ personStatus: personStatus as StudentDetailFilters["personStatus"] })
                    }
                    options={PERSON_STATUS_OPTIONS}
                    value={value.personStatus}
                  />
                ) : field.key === "home" ? (
                  <ValueSelect
                    label={field.label}
                    onChange={(home) => set({ home })}
                    options={options.homes}
                    value={value.home}
                  />
                ) : field.key === "nationality" ? (
                  <ValueSelect
                    label={field.label}
                    onChange={(nationality) => set({ nationality })}
                    options={options.nationalities}
                    value={value.nationality}
                  />
                ) : field.key === "parentage" ? (
                  <ValueSelect
                    label={field.label}
                    onChange={(parentage) => set({ parentage })}
                    options={options.parentage}
                    value={value.parentage}
                  />
                ) : field.key === "age" ? (
                  <>
                    <Input
                      aria-label="Youngest age"
                      className="h-9"
                      inputMode="numeric"
                      max={120}
                      min={0}
                      onChange={(event) => set({ ageMin: event.target.value })}
                      placeholder="From"
                      type="number"
                      value={value.ageMin ?? ""}
                    />
                    <span className="text-xs text-muted-foreground">to</span>
                    <Input
                      aria-label="Oldest age"
                      className="h-9"
                      inputMode="numeric"
                      max={120}
                      min={0}
                      onChange={(event) => set({ ageMax: event.target.value })}
                      placeholder="To"
                      type="number"
                      value={value.ageMax ?? ""}
                    />
                  </>
                ) : (
                  <>
                    <Input
                      aria-label="Admitted from"
                      className="h-9"
                      max={value.admittedTo}
                      onChange={(event) => set({ admittedFrom: event.target.value })}
                      type="date"
                      value={value.admittedFrom ?? ""}
                    />
                    <span className="text-xs text-muted-foreground">to</span>
                    <Input
                      aria-label="Admitted up to"
                      className="h-9"
                      min={value.admittedFrom}
                      onChange={(event) => set({ admittedTo: event.target.value })}
                      type="date"
                      value={value.admittedTo ?? ""}
                    />
                  </>
                )}
              </div>
              <Button
                aria-label={`Remove ${field.label} filter`}
                onClick={() => remove(field)}
                size="icon-sm"
                type="button"
                variant="ghost"
              >
                <X />
              </Button>
            </div>
          ))}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        {available.length ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button className="rounded-full" size="sm" type="button" variant="outline">
                {shown.length ? <Plus /> : <ListFilter />}
                {shown.length ? "Add filter" : "More filters"}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              {available.map((field) => (
                <DropdownMenuItem
                  key={field.key}
                  onSelect={() => setAdded((current) => [...current, field.key])}
                >
                  {field.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
        {shown.length ? (
          <Button onClick={clear} size="sm" type="button" variant="ghost">
            Clear filters
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function ValueSelect({
  label,
  onChange,
  options,
  value,
}: {
  label: string;
  onChange: (value: string | undefined) => void;
  options: Array<{ id?: string; name: string; count?: number }>;
  value: string | undefined;
}) {
  return (
    <Select
      onValueChange={(next) => onChange(next === "all" ? undefined : next)}
      value={value ?? "all"}
    >
      <SelectTrigger aria-label={label} className="h-9 w-full rounded-full bg-background">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">Any</SelectItem>
        {options.map((option) => (
          <SelectItem key={option.id ?? option.name} value={option.id ?? option.name}>
            {option.name}
            {option.count === undefined ? "" : ` · ${Number(option.count).toLocaleString()}`}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
