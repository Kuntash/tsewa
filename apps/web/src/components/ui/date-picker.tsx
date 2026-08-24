import { CalendarIcon } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

function parseDate(value: string) {
  if (!value) return undefined;
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function serializeDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function displayDate(value: string) {
  const date = parseDate(value);
  return date
    ? new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" }).format(
        date,
      )
    : "Pick a date";
}

export function DatePickerField({
  label,
  name,
  required = false,
  value,
  onChange,
  endMonth = new Date(),
  startMonth = new Date(1930, 0),
}: {
  endMonth?: Date;
  label: string;
  name: string;
  required?: boolean;
  startMonth?: Date;
  value: string;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <input name={name} type="hidden" value={value} />
      <Popover onOpenChange={setOpen} open={open}>
        <PopoverTrigger asChild>
          <Button
            className={cn(
              "w-full justify-start text-left font-normal",
              !value && "text-muted-foreground",
            )}
            type="button"
            variant="outline"
          >
            <CalendarIcon />
            {displayDate(value)}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-auto p-0">
          <Calendar
            captionLayout="dropdown"
            defaultMonth={parseDate(value)}
            endMonth={endMonth}
            mode="single"
            onSelect={(date) => {
              if (!date && required) return;
              onChange(date ? serializeDate(date) : "");
              if (date) setOpen(false);
            }}
            selected={parseDate(value)}
            startMonth={startMonth}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
