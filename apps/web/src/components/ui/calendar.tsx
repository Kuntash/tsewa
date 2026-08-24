import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import * as React from "react";
import { DayPicker, getDefaultClassNames, type DayButton } from "react-day-picker";

import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  captionLayout = "label",
  ...props
}: React.ComponentProps<typeof DayPicker>) {
  const defaults = getDefaultClassNames();
  return (
    <DayPicker
      captionLayout={captionLayout}
      className={cn("group/calendar w-fit bg-background p-3 [--cell-size:2rem]", className)}
      classNames={{
        root: cn("w-fit", defaults.root),
        months: cn("relative flex flex-col gap-4", defaults.months),
        month: cn("flex w-full flex-col gap-4", defaults.month),
        nav: cn(
          "absolute inset-x-0 top-0 flex w-full items-center justify-between gap-1",
          defaults.nav,
        ),
        button_previous: cn(
          buttonVariants({ variant: "ghost" }),
          "size-(--cell-size) p-0 select-none aria-disabled:opacity-50",
          defaults.button_previous,
        ),
        button_next: cn(
          buttonVariants({ variant: "ghost" }),
          "size-(--cell-size) p-0 select-none aria-disabled:opacity-50",
          defaults.button_next,
        ),
        month_caption: cn(
          "flex h-(--cell-size) w-full items-center justify-center px-(--cell-size)",
          defaults.month_caption,
        ),
        dropdowns: cn(
          "flex h-(--cell-size) w-full items-center justify-center gap-1.5 text-sm font-medium",
          defaults.dropdowns,
        ),
        dropdown_root: cn(
          "relative rounded-md border border-input shadow-xs has-focus:border-ring has-focus:ring-2 has-focus:ring-ring/30",
          defaults.dropdown_root,
        ),
        dropdown: cn("absolute inset-0 bg-popover opacity-0", defaults.dropdown),
        caption_label: cn(
          "select-none font-medium",
          captionLayout === "label"
            ? "text-sm"
            : "flex h-8 items-center gap-1 rounded-md px-2 text-sm [&>svg]:size-3.5 [&>svg]:text-muted-foreground",
          defaults.caption_label,
        ),
        month_grid: cn("w-full border-collapse", defaults.month_grid),
        weekdays: cn("flex", defaults.weekdays),
        weekday: cn(
          "flex-1 rounded-md text-center text-[0.75rem] font-normal text-muted-foreground select-none",
          defaults.weekday,
        ),
        week: cn("mt-1.5 flex w-full", defaults.week),
        day: cn("group/day relative size-(--cell-size) p-0 text-center select-none", defaults.day),
        today: cn("rounded-md bg-accent text-accent-foreground", defaults.today),
        outside: cn("text-muted-foreground opacity-45", defaults.outside),
        disabled: cn("text-muted-foreground opacity-40", defaults.disabled),
        hidden: cn("invisible", defaults.hidden),
        ...classNames,
      }}
      components={{
        Chevron: ({ className, orientation, ...chevronProps }) => {
          const Icon =
            orientation === "left"
              ? ChevronLeft
              : orientation === "right"
                ? ChevronRight
                : ChevronDown;
          return <Icon className={cn("size-4", className)} {...chevronProps} />;
        },
        DayButton: CalendarDayButton,
      }}
      formatters={{
        formatMonthDropdown: (date) => date.toLocaleString("en-IN", { month: "short" }),
      }}
      showOutsideDays={showOutsideDays}
      {...props}
    />
  );
}

function CalendarDayButton({
  className,
  day,
  modifiers,
  ...props
}: React.ComponentProps<typeof DayButton>) {
  const ref = React.useRef<HTMLButtonElement>(null);
  React.useEffect(() => {
    if (modifiers.focused) ref.current?.focus();
  }, [modifiers.focused]);

  return (
    <Button
      className={cn(
        "size-(--cell-size) p-0 font-normal data-[selected-single=true]:bg-primary data-[selected-single=true]:text-primary-foreground",
        className,
      )}
      data-day={day.date.toLocaleDateString("en-IN")}
      data-selected-single={modifiers.selected}
      ref={ref}
      size="icon"
      variant="ghost"
      {...props}
    />
  );
}

export { Calendar, CalendarDayButton };
