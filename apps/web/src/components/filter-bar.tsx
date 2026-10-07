import { Check, ChevronDown, ChevronLeft, Plus, Search, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export type FilterOption = { value: string; label: string; count?: number };

type FieldBase = {
  label: string;
  // A pinned filter is always on the bar; the rest sit behind "Add filter".
  pinned?: boolean;
};

export type FilterField =
  | (FieldBase & { type: "choice"; key: string; options: FilterOption[] })
  | (FieldBase & {
      type: "number-range" | "date-range";
      key: string;
      fromKey: string;
      toKey: string;
    });

export type FilterValues = Record<string, string | undefined>;

const SEARCHABLE_FROM = 9;

function fieldKeys(field: FilterField): string[] {
  return field.type === "choice" ? [field.key] : [field.fromKey, field.toKey];
}

function isSet(field: FilterField, value: FilterValues) {
  return fieldKeys(field).some((key) => value[key]);
}

function fieldValueLabel(field: FilterField, value: FilterValues): string {
  if (field.type === "choice") {
    const current = value[field.key];
    return field.options.find((option) => option.value === current)?.label ?? current ?? "";
  }
  const from = value[field.fromKey];
  const to = value[field.toKey];
  if (from && to) return `${from} to ${to}`;
  if (field.type === "number-range") return from ? `${from} or more` : `up to ${to}`;
  return from ? `from ${from}` : `up to ${to}`;
}

// Applied filters as plain text, for print headers and export summaries.
export function filterSummary(fields: FilterField[], value: FilterValues): string[] {
  return fields
    .filter((field) => isSet(field, value))
    .map((field) => `${field.label}: ${fieldValueLabel(field, value)}`);
}

export function FilterBar({
  className,
  fields,
  onChange,
  value,
}: {
  className?: string;
  fields: FilterField[];
  onChange: (value: FilterValues) => void;
  value: FilterValues;
}) {
  const shown = fields.filter((field) => field.pinned || isSet(field, value));
  const addable = fields.filter((field) => !shown.includes(field));
  const anySet = fields.some((field) => isSet(field, value));

  function apply(patch: FilterValues) {
    onChange({ ...value, ...patch });
  }

  function clear(field: FilterField) {
    apply(Object.fromEntries(fieldKeys(field).map((key) => [key, undefined])));
  }

  function clearAll() {
    apply(Object.fromEntries(fields.flatMap(fieldKeys).map((key) => [key, undefined])));
  }

  return (
    <div className={cn("flex flex-wrap items-center gap-1.5", className)}>
      {shown.map((field) => (
        <FilterChip
          field={field}
          key={field.key}
          onApply={apply}
          onClear={() => clear(field)}
          value={value}
        />
      ))}
      {addable.length ? <AddFilter fields={addable} onApply={apply} value={value} /> : null}
      {anySet ? (
        <Button
          className="h-8 rounded-full px-2.5 text-muted-foreground"
          onClick={clearAll}
          size="sm"
          type="button"
          variant="ghost"
        >
          Clear all
        </Button>
      ) : null}
    </div>
  );
}

function FilterChip({
  field,
  onApply,
  onClear,
  value,
}: {
  field: FilterField;
  onApply: (patch: FilterValues) => void;
  onClear: () => void;
  value: FilterValues;
}) {
  const [open, setOpen] = useState(false);
  const active = isSet(field, value);
  return (
    <Popover onOpenChange={setOpen} open={open}>
      <div
        className={cn(
          "inline-flex h-8 max-w-full items-center rounded-full border text-xs transition-colors",
          active
            ? "border-primary/25 bg-primary/8 text-foreground"
            : "border-border bg-background text-muted-foreground hover:text-foreground",
        )}
      >
        <PopoverTrigger asChild>
          <button
            className={cn(
              "inline-flex h-full min-w-0 items-center gap-1.5 rounded-full pl-3 outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
              active ? "pr-1.5" : "pr-2.5",
            )}
            type="button"
          >
            {active ? (
              <>
                <span className="shrink-0 text-muted-foreground">{field.label}</span>
                <span className="truncate font-medium">{fieldValueLabel(field, value)}</span>
              </>
            ) : (
              <>
                <span className="font-medium">{field.label}</span>
                <ChevronDown className="size-3.5 opacity-60" />
              </>
            )}
          </button>
        </PopoverTrigger>
        {active ? (
          <button
            aria-label={`Remove ${field.label} filter`}
            className="mr-1 grid size-6 shrink-0 place-items-center rounded-full text-muted-foreground outline-none hover:bg-primary/10 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/40"
            onClick={onClear}
            type="button"
          >
            <X className="size-3.5" />
          </button>
        ) : null}
      </div>
      <PopoverContent align="start" className="w-64 p-0">
        <FieldEditor
          field={field}
          onApply={(patch) => {
            onApply(patch);
            setOpen(false);
          }}
          value={value}
        />
      </PopoverContent>
    </Popover>
  );
}

function AddFilter({
  fields,
  onApply,
  value,
}: {
  fields: FilterField[];
  onApply: (patch: FilterValues) => void;
  value: FilterValues;
}) {
  const [open, setOpen] = useState(false);
  const [fieldKey, setFieldKey] = useState<string | null>(null);
  const field = fields.find((item) => item.key === fieldKey) ?? null;

  useEffect(() => {
    if (!open) setFieldKey(null);
  }, [open]);

  return (
    <Popover onOpenChange={setOpen} open={open}>
      <PopoverTrigger asChild>
        <Button
          className="h-8 rounded-full px-2.5 text-muted-foreground"
          size="sm"
          type="button"
          variant="ghost"
        >
          <Plus className="size-3.5" /> Add filter
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-0">
        {field ? (
          <>
            <button
              className="flex w-full items-center gap-1.5 border-b px-3 py-2.5 text-left text-xs font-medium outline-none hover:bg-muted/60 focus-visible:bg-muted/60"
              onClick={() => setFieldKey(null)}
              type="button"
            >
              <ChevronLeft className="size-3.5 text-muted-foreground" /> {field.label}
            </button>
            <FieldEditor
              field={field}
              onApply={(patch) => {
                onApply(patch);
                setOpen(false);
              }}
              value={value}
            />
          </>
        ) : (
          <div className="max-h-72 overflow-y-auto p-1">
            {fields.map((item) => (
              <button
                className="flex w-full items-center rounded-lg px-2.5 py-2 text-left text-sm outline-none hover:bg-muted focus-visible:bg-muted"
                key={item.key}
                onClick={() => setFieldKey(item.key)}
                type="button"
              >
                {item.label}
              </button>
            ))}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

function FieldEditor({
  field,
  onApply,
  value,
}: {
  field: FilterField;
  onApply: (patch: FilterValues) => void;
  value: FilterValues;
}) {
  if (field.type === "choice") {
    return (
      <ChoiceEditor
        field={field}
        onPick={(next) => onApply({ [field.key]: next })}
        selected={value[field.key]}
      />
    );
  }
  return <RangeEditor field={field} onApply={onApply} value={value} />;
}

function ChoiceEditor({
  field,
  onPick,
  selected,
}: {
  field: Extract<FilterField, { type: "choice" }>;
  onPick: (value: string | undefined) => void;
  selected: string | undefined;
}) {
  const [query, setQuery] = useState("");
  const searchable = field.options.length >= SEARCHABLE_FROM;
  const options = useMemo(() => {
    const search = query.trim().toLowerCase();
    return search
      ? field.options.filter((option) => option.label.toLowerCase().includes(search))
      : field.options;
  }, [field.options, query]);

  return (
    <div>
      {searchable ? (
        <div className="relative border-b">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            aria-label={`Search ${field.label}`}
            autoFocus
            className="h-10 w-full bg-transparent pl-8.5 pr-3 text-sm outline-none placeholder:text-muted-foreground"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search"
            value={query}
          />
        </div>
      ) : null}
      <div className="max-h-64 overflow-y-auto p-1">
        {options.map((option) => {
          const checked = option.value === selected;
          return (
            <button
              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm outline-none hover:bg-muted focus-visible:bg-muted"
              key={option.value}
              // Picking the selected option again takes the filter off.
              onClick={() => onPick(checked ? undefined : option.value)}
              type="button"
            >
              <span className="min-w-0 flex-1 truncate">{option.label}</span>
              {option.count === undefined ? null : (
                <span className="text-xs tabular-nums text-muted-foreground">
                  {Number(option.count).toLocaleString()}
                </span>
              )}
              <Check className={cn("size-3.5 text-primary", checked ? "" : "invisible")} />
            </button>
          );
        })}
        {!options.length ? (
          <p className="px-2.5 py-3 text-sm text-muted-foreground">Nothing matches.</p>
        ) : null}
      </div>
    </div>
  );
}

function RangeEditor({
  field,
  onApply,
  value,
}: {
  field: Extract<FilterField, { type: "number-range" | "date-range" }>;
  onApply: (patch: FilterValues) => void;
  value: FilterValues;
}) {
  const [from, setFrom] = useState(value[field.fromKey] ?? "");
  const [to, setTo] = useState(value[field.toKey] ?? "");
  const type = field.type === "number-range" ? "number" : "date";
  return (
    <form
      className="space-y-3 p-3"
      onSubmit={(event) => {
        event.preventDefault();
        onApply({ [field.fromKey]: from || undefined, [field.toKey]: to || undefined });
      }}
    >
      <div className="grid grid-cols-2 gap-2">
        <label className="space-y-1 text-xs text-muted-foreground">
          <span>From</span>
          <Input
            className="h-9"
            inputMode={type === "number" ? "numeric" : undefined}
            max={type === "date" ? to || undefined : 120}
            min={type === "number" ? 0 : undefined}
            onChange={(event) => setFrom(event.target.value)}
            type={type}
            value={from}
          />
        </label>
        <label className="space-y-1 text-xs text-muted-foreground">
          <span>To</span>
          <Input
            className="h-9"
            inputMode={type === "number" ? "numeric" : undefined}
            max={type === "number" ? 120 : undefined}
            min={type === "date" ? from || undefined : 0}
            onChange={(event) => setTo(event.target.value)}
            type={type}
            value={to}
          />
        </label>
      </div>
      <Button className="h-8 w-full" size="sm" type="submit">
        Apply
      </Button>
    </form>
  );
}
