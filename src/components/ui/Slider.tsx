import * as SliderPrimitive from "@radix-ui/react-slider";
import { cn } from "@/lib/utils";

interface SliderProps {
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
  label: string;
  id?: string;
  className?: string;
}

export function Slider({
  value,
  min,
  max,
  step = 1,
  onChange,
  label,
  id,
  className,
}: SliderProps) {
  return (
    <SliderPrimitive.Root
      className={cn(
        "relative flex h-5 w-full touch-none select-none items-center",
        className,
      )}
      value={[value]}
      min={min}
      max={max}
      step={step}
      onValueChange={([next]) => onChange(next)}
      aria-label={label}
      id={id}
    >
      <SliderPrimitive.Track className="relative h-1 w-full grow overflow-hidden rounded-full bg-line-strong/60">
        <SliderPrimitive.Range className="absolute h-full bg-accent-strong" />
      </SliderPrimitive.Track>
      <SliderPrimitive.Thumb className="block h-4 w-4 rounded-full border-2 border-surface bg-accent-strong shadow-soft outline-none ring-offset-2 transition-transform hover:scale-110 focus-visible:ring-2 focus-visible:ring-accent-strong disabled:pointer-events-none disabled:opacity-50" />
    </SliderPrimitive.Root>
  );
}
