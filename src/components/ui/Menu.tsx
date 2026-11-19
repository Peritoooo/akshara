import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Check } from "lucide-react";
import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { cn } from "@/lib/utils";

export const Menu = DropdownMenu.Root;
export const MenuTrigger = DropdownMenu.Trigger;
export const MenuSeparator = () => (
  <DropdownMenu.Separator className="my-1.5 h-px bg-line" />
);

export function MenuContent({
  children,
  className,
  align = "end",
  sideOffset = 6,
}: {
  children: ReactNode;
  className?: string;
  align?: "start" | "center" | "end";
  sideOffset?: number;
}) {
  return (
    <DropdownMenu.Portal>
      <DropdownMenu.Content
        align={align}
        sideOffset={sideOffset}
        className={cn(
          "z-50 min-w-[13rem] overflow-hidden rounded-xl border border-line bg-surface p-1.5 text-ink shadow-lift data-[state=open]:animate-[scale-in_0.16s_ease]",
          className,
        )}
      >
        {children}
      </DropdownMenu.Content>
    </DropdownMenu.Portal>
  );
}

export function MenuLabel({ children }: { children: ReactNode }) {
  return (
    <DropdownMenu.Label className="px-2.5 pb-1.5 pt-2 text-[0.625rem] font-medium uppercase tracking-[0.18em] text-ink-muted">
      {children}
    </DropdownMenu.Label>
  );
}

export function MenuItem({
  children,
  icon,
  destructive,
  shortcut,
  disabled,
  onSelect,
  className,
}: {
  children: ReactNode;
  icon?: ReactNode;
  destructive?: boolean;
  shortcut?: string;
  disabled?: boolean;
  onSelect?: (event: Event) => void;
  className?: string;
}) {
  return (
    <DropdownMenu.Item
      disabled={disabled}
      onSelect={onSelect}
      className={cn(
        "flex cursor-pointer select-none items-center gap-2.5 rounded-lg px-2.5 py-2 text-[0.8125rem] outline-none transition-colors data-[disabled]:pointer-events-none data-[highlighted]:bg-muted data-[disabled]:opacity-40",
        destructive ? "text-rose" : "text-ink-soft data-[highlighted]:text-ink",
        className,
      )}
    >
      {icon ? <span className="flex h-4 w-4 items-center justify-center">{icon}</span> : null}
      <span className="flex-1">{children}</span>
      {shortcut ? (
        <span className="text-[0.625rem] tracking-[0.08em] text-ink-muted">
          {shortcut}
        </span>
      ) : null}
    </DropdownMenu.Item>
  );
}

export function MenuCheckboxItem({
  children,
  checked,
  onCheckedChange,
  icon,
}: {
  children: ReactNode;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  icon?: ReactNode;
}) {
  return (
    <DropdownMenu.CheckboxItem
      checked={checked}
      onCheckedChange={onCheckedChange}
      onSelect={(event) => event.preventDefault()}
      className="flex cursor-pointer select-none items-center gap-2.5 rounded-lg px-2.5 py-2 text-[0.8125rem] text-ink-soft outline-none transition-colors data-[highlighted]:bg-muted data-[highlighted]:text-ink"
    >
      {icon ? <span className="flex h-4 w-4 items-center justify-center">{icon}</span> : null}
      <span className="flex-1">{children}</span>
      <DropdownMenu.ItemIndicator>
        <Check className="h-3.5 w-3.5 text-accent-strong" />
      </DropdownMenu.ItemIndicator>
    </DropdownMenu.CheckboxItem>
  );
}

export type MenuContentProps = ComponentPropsWithoutRef<typeof DropdownMenu.Content>;
