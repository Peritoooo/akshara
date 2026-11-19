import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
  hideHeader?: boolean;
}

export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  className,
  hideHeader = false,
}: DialogProps) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-[#1a1712]/35 backdrop-blur-[3px] data-[state=closed]:animate-[fade-in_0.2s_ease_reverse] data-[state=open]:animate-[fade-in_0.25s_ease] dark:bg-black/55" />
        <DialogPrimitive.Content
          className={cn(
            "fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-2xl border border-line bg-surface shadow-lift data-[state=open]:animate-[scale-in_0.25s_cubic-bezier(0.22,0.61,0.36,1)]",
            className,
          )}
        >
          {hideHeader ? (
            <DialogPrimitive.Title className="sr-only">{title}</DialogPrimitive.Title>
          ) : (
            <div className="flex items-start justify-between gap-6 border-b border-line px-6 py-5">
              <div>
                <DialogPrimitive.Title className="font-display text-[1.4rem] leading-tight tracking-[-0.02em] text-ink">
                  {title}
                </DialogPrimitive.Title>
                {description ? (
                  <DialogPrimitive.Description className="mt-1.5 text-[0.8125rem] leading-relaxed text-ink-muted">
                    {description}
                  </DialogPrimitive.Description>
                ) : null}
              </div>
              <DialogPrimitive.Close className="mt-0.5 rounded-full p-2 text-ink-muted transition-colors hover:bg-muted hover:text-ink">
                <X className="h-4 w-4" />
                <span className="sr-only">Close</span>
              </DialogPrimitive.Close>
            </div>
          )}
          {hideHeader ? (
            <DialogPrimitive.Close className="absolute right-4 top-4 z-10 rounded-full p-2 text-ink-muted transition-colors hover:bg-muted hover:text-ink">
              <X className="h-4 w-4" />
              <span className="sr-only">Close</span>
            </DialogPrimitive.Close>
          ) : null}
          <div className="px-6 py-5">{children}</div>
          {footer ? (
            <div className="flex items-center justify-end gap-2 border-t border-line bg-muted/40 px-6 py-4">
              {footer}
            </div>
          ) : null}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
