import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost" | "subtle" | "danger";
type Size = "xs" | "sm" | "md" | "lg";

const variants: Record<Variant, string> = {
  primary:
    "bg-ink text-canvas shadow-soft hover:opacity-90 active:scale-[0.985] disabled:hover:opacity-100",
  secondary:
    "border border-line-strong bg-surface text-ink hover:bg-muted active:scale-[0.985]",
  ghost: "text-ink-soft hover:bg-muted hover:text-ink",
  subtle: "bg-muted text-ink-soft hover:text-ink hover:bg-line/60",
  danger:
    "border border-rose/40 bg-rose/10 text-rose hover:bg-rose/15 dark:text-rose",
};

const sizes: Record<Size, string> = {
  xs: "h-8 px-3 text-[0.75rem] gap-1.5",
  sm: "h-9 px-4 text-[0.8125rem] gap-1.5",
  md: "h-11 px-5 text-sm gap-2",
  lg: "h-12 px-6 text-[0.9375rem] gap-2.5",
};

export function buttonStyles(
  variant: Variant = "primary",
  size: Size = "md",
  className?: string,
) {
  return cn(
    "inline-flex select-none items-center justify-center rounded-full font-medium tracking-[-0.005em] transition-all duration-200 outline-none disabled:pointer-events-none disabled:opacity-50",
    variants[variant],
    sizes[size],
    className,
  );
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", type = "button", ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      className={buttonStyles(variant, size, className)}
      {...props}
    />
  ),
);

Button.displayName = "Button";

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  variant?: "ghost" | "surface" | "primary";
  size?: "sm" | "md";
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ className, label, variant = "ghost", size = "md", type = "button", ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full transition-all duration-200 outline-none disabled:pointer-events-none disabled:opacity-40",
        size === "md" ? "h-10 w-10" : "h-8 w-8",
        variant === "ghost" && "text-ink-soft hover:bg-muted hover:text-ink",
        variant === "surface" &&
          "border border-line bg-surface text-ink-soft hover:border-line-strong hover:text-ink",
        variant === "primary" && "bg-ink text-canvas hover:opacity-90",
        className,
      )}
      {...props}
    />
  ),
);

IconButton.displayName = "IconButton";
