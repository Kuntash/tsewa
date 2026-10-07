import type { FilterField } from "@/components/filter-bar";

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

const GENDER_OPTIONS = [
  { value: "female", label: "Female" },
  { value: "male", label: "Male" },
  { value: "other", label: "Other" },
  { value: "unknown", label: "Not set" },
];

const PERSON_STATUS_OPTIONS = [
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
];

const choices = (options: CountOption[]) =>
  options.map((option) => ({
    value: option.id ?? option.name,
    label: option.name,
    count: option.count,
  }));

export const studentStatusFilterField: FilterField = {
  type: "choice",
  key: "personStatus",
  label: "Status",
  options: PERSON_STATUS_OPTIONS,
  pinned: true,
};

export function studentDetailFilterFields(options: StudentDetailOptions): FilterField[] {
  return [
    {
      type: "choice",
      key: "category",
      label: "Child category",
      options: choices(options.categories),
    },
    { type: "choice", key: "gender", label: "Gender", options: GENDER_OPTIONS },
    { type: "choice", key: "home", label: "Home", options: choices(options.homes) },
    {
      type: "choice",
      key: "nationality",
      label: "Nationality",
      options: choices(options.nationalities),
    },
    {
      type: "choice",
      key: "parentage",
      label: "Parents' status",
      options: choices(options.parentage),
    },
    { type: "number-range", key: "age", label: "Age", fromKey: "ageMin", toKey: "ageMax" },
    {
      type: "date-range",
      key: "admitted",
      label: "Admission date",
      fromKey: "admittedFrom",
      toKey: "admittedTo",
    },
  ];
}

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
