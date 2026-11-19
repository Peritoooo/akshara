import { cn } from "@/lib/utils";

/**
 * The Akshara brand mark: a gold arch, a four-point star, the अ monogram,
 * and a fanned open book. Rendered from the official logo asset
 * (`public/logo-mark.png`); a dark variant is swapped in for dark themes
 * so the ink stays legible.
 */
export function LogoMark({
  className,
  tone = "site",
}: {
  className?: string;
  tone?: "site" | "reader";
}) {
  return (
    <img
      src="/logo-mark.png"
      alt="Akshara logo"
      draggable={false}
      className={cn("logo-mark h-auto select-none", className)}
      data-logo-tone={tone}
    />
  );
}
