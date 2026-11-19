import { Search, X } from "lucide-react";
import { forwardRef } from "react";
import type { InputHTMLAttributes, SelectHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

interface SearchFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  onClear?: () => void;
  containerClassName?: string;
  shortcut?: string;
}

export const SearchField = forwardRef<HTMLInputElement, SearchFieldProps>(
  function SearchField(
    { className, containerClassName, onClear, shortcut, value, ...props },
    ref,
  ) {
    return (
    <div className={cn("relative", containerClassName)}>
      <Search
        className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted"
        aria-hidden="true"
      />
      <input
        ref={ref}
        type="search"
        value={value}
        className={cn(
          "h-10 w-full rounded-full border border-line bg-surface pl-10 pr-10 text-[0.8125rem] text-ink outline-none transition-colors placeholder:text-ink-muted focus:border-line-strong focus:bg-elevated [&::-webkit-search-cancel-button]:hidden",
          className,
        )}
        {...props}
      />
      {value && onClear ? (
        <button
          type="button"
          onClick={onClear}
          aria-label="Clear search"
          className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-ink-muted hover:bg-muted hover:text-ink"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      ) : shortcut ? (
        <kbd className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 rounded border border-line bg-muted px-1.5 py-0.5 text-[0.625rem] text-ink-muted sm:block">
          {shortcut}
        </kbd>
      ) : null}
    </div>
    );
  },
);

interface SelectFieldProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  options: Array<{ value: string; label: string }>;
  hideLabel?: boolean;
}

export function SelectField({
  label,
  options,
  hideLabel = true,
  className,
  ...props
}: SelectFieldProps) {
  return (
    <div className="relative">
      <label className={hideLabel ? "sr-only" : "mb-1.5 block text-xs text-ink-muted"} htmlFor={props.id}>
        {label}
      </label>
      <select
        className={cn(
          "h-10 w-full appearance-none rounded-full border border-line bg-surface pl-4 pr-9 text-[0.8125rem] text-ink outline-none transition-colors hover:border-line-strong focus:border-line-strong",
          className,
        )}
        {...props}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <svg
        className="pointer-events-none absolute right-3.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-muted"
        viewBox="0 0 16 16"
        fill="none"
        aria-hidden="true"
      >
        <path d="m4 6 4 4 4-4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      </svg>
    </div>
  );
}

export function TextArea({
  className,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "w-full resize-none rounded-xl border border-line bg-canvas px-3.5 py-3 text-sm leading-relaxed text-ink outline-none transition-colors placeholder:text-ink-muted focus:border-line-strong focus:bg-surface",
        className,
      )}
      {...props}
    />
  );
}

export function TextInput({
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "h-11 w-full rounded-xl border border-line bg-canvas px-3.5 text-sm text-ink outline-none transition-colors placeholder:text-ink-muted focus:border-line-strong focus:bg-surface",
        className,
      )}
      {...props}
    />
  );
}
