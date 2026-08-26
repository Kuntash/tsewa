"use client";

import { Toaster as Sonner, type ToasterProps } from "sonner";

export function Toaster(props: ToasterProps) {
  return (
    <Sonner
      closeButton
      gap={10}
      position="bottom-center"
      toastOptions={{
        unstyled: true,
        classNames: {
          toast:
            "group pointer-events-auto flex w-full items-start gap-3 rounded-2xl border border-border/80 bg-popover px-4 py-3.5 text-popover-foreground shadow-[0_16px_48px_-20px_oklch(0.2_0.025_168_/_0.45)]",
          content: "min-w-0 flex-1",
          title: "text-sm font-semibold leading-5 tracking-[-0.01em]",
          description: "mt-0.5 text-xs leading-5 text-muted-foreground",
          icon: "mt-0.5 shrink-0 text-primary",
          success: "border-primary/25 bg-popover",
          error: "border-destructive/30 [&_[data-icon]]:text-destructive",
          warning:
            "border-amber-500/30 [&_[data-icon]]:text-amber-600 dark:[&_[data-icon]]:text-amber-400",
          loading: "[&_[data-icon]]:text-muted-foreground",
          closeButton:
            "!absolute !-right-2 !-top-2 !size-6 !rounded-full !border !border-border !bg-popover !text-muted-foreground !shadow-sm transition-colors hover:!bg-muted hover:!text-foreground focus-visible:!outline-none focus-visible:!ring-2 focus-visible:!ring-ring",
          actionButton:
            "rounded-lg bg-primary px-2.5 py-1.5 text-xs font-semibold text-primary-foreground",
          cancelButton:
            "rounded-lg bg-muted px-2.5 py-1.5 text-xs font-semibold text-muted-foreground",
        },
      }}
      visibleToasts={4}
      {...props}
    />
  );
}
