import type { CSSProperties } from "react";
import type { Book, CoverMotif } from "@/types";
import { cn } from "@/lib/utils";

function splitTitle(title: string): string[] {
  const words = title.split(/\s+/);
  if (title.length <= 15) return [title];
  const lineCount = title.length > 28 ? 3 : 2;
  const target = Math.ceil(title.length / lineCount);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (current && next.length > target + 3 && lines.length < lineCount - 1) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function Motif({ motif, color }: { motif: CoverMotif; color: string }) {
  const props = {
    fill: "none",
    stroke: color,
    strokeWidth: 0.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };

  switch (motif) {
    case "arch":
      return (
        <svg viewBox="0 0 100 100" className="h-full w-full" aria-hidden="true">
          <path d="M16 88V48c0-19 15-34 34-34s34 15 34 34v40" {...props} opacity="0.75" />
          <path d="M27 88V50c0-13 10-23 23-23s23 10 23 23v38" {...props} opacity="0.5" />
          <path d="M38 88V52c0-7 5.5-12 12-12s12 5 12 12v36" {...props} opacity="0.9" />
          <path d="M10 88h80" {...props} opacity="0.35" />
          <circle cx="50" cy="54" r="1.6" fill={color} opacity="0.9" />
        </svg>
      );
    case "sun":
      return (
        <svg viewBox="0 0 100 100" className="h-full w-full" aria-hidden="true">
          <circle cx="50" cy="46" r="19" {...props} opacity="0.8" />
          {Array.from({ length: 12 }, (_, i) => {
            const angle = (i * Math.PI * 2) / 12 - Math.PI / 2;
            const x1 = 50 + Math.cos(angle) * 26;
            const y1 = 46 + Math.sin(angle) * 26;
            const x2 = 50 + Math.cos(angle) * (i % 2 === 0 ? 34 : 30);
            const y2 = 46 + Math.sin(angle) * (i % 2 === 0 ? 34 : 30);
            return <path key={i} d={`M${x1} ${y1}L${x2} ${y2}`} {...props} opacity="0.5" />;
          })}
          <path d="M18 78h64M26 86h48" {...props} opacity="0.35" />
        </svg>
      );
    case "waves":
      return (
        <svg viewBox="0 0 100 100" className="h-full w-full" aria-hidden="true">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <path
              key={i}
              d={`M8 ${32 + i * 10} C 24 ${22 + i * 10}, 38 ${42 + i * 10}, 54 ${32 + i * 10} S 82 ${22 + i * 10}, 94 ${34 + i * 10}`}
              {...props}
              opacity={0.28 + i * 0.1}
            />
          ))}
        </svg>
      );
    case "botanical":
      return (
        <svg viewBox="0 0 100 100" className="h-full w-full" aria-hidden="true">
          <path d="M50 92V28" {...props} opacity="0.75" />
          <path d="M50 58C36 56 26 46 24 32c14 2 24 12 26 26Z" {...props} opacity="0.7" />
          <path d="M50 42c14-2 24-12 26-26-14 2-24 12-26 26Z" {...props} opacity="0.7" />
          <path d="M50 74c-10-1-17-8-19-18 10 2 17 9 19 18Z" {...props} opacity="0.55" />
          <path d="M50 24c-6-4-8-10-4-16 6 4 8 10 4 16Z" fill={color} opacity="0.55" />
          <path d="M24 92h52" {...props} opacity="0.3" />
        </svg>
      );
    case "orbit":
      return (
        <svg viewBox="0 0 100 100" className="h-full w-full" aria-hidden="true">
          <circle cx="50" cy="46" r="9" {...props} opacity="0.9" />
          <ellipse cx="50" cy="46" rx="38" ry="15" transform="rotate(-24 50 46)" {...props} opacity="0.5" />
          <ellipse cx="50" cy="46" rx="28" ry="38" transform="rotate(32 50 46)" {...props} opacity="0.35" />
          <circle cx="18" cy="32" r="2" fill={color} opacity="0.8" />
          <circle cx="79" cy="63" r="1.4" fill={color} opacity="0.6" />
        </svg>
      );
    case "lattice":
      return (
        <svg viewBox="0 0 100 100" className="h-full w-full" aria-hidden="true">
          <g opacity="0.45">
            {Array.from({ length: 8 }, (_, i) => (
              <path key={`a${i}`} d={`M${18 + i * 9} 18 L78 ${78 - i * 9}`} {...props} />
            ))}
            {Array.from({ length: 8 }, (_, i) => (
              <path key={`b${i}`} d={`M${18 + i * 9} 78 L78 ${18 + i * 9}`} {...props} />
            ))}
          </g>
          <rect x="20" y="20" width="60" height="60" {...props} opacity="0.7" />
          <circle cx="50" cy="50" r="5" fill={color} opacity="0.75" />
        </svg>
      );
    case "peaks":
      return (
        <svg viewBox="0 0 100 100" className="h-full w-full" aria-hidden="true">
          <path d="M8 80 32 42l13 20 12-28 27 46" {...props} opacity="0.75" />
          <path d="M8 88 34 60l12 12 16-22 22 38" {...props} opacity="0.4" />
          <path d="M8 92h84" {...props} opacity="0.35" />
          <circle cx="70" cy="30" r="7" {...props} opacity="0.55" />
        </svg>
      );
    case "flame":
      return (
        <svg viewBox="0 0 100 100" className="h-full w-full" aria-hidden="true">
          <path d="M50 88c-14 0-24-10-24-23 0-14 12-21 15-35 9 8 10 15 9 22 5-4 8-9 8-16 11 9 16 19 16 30 0 13-10 22-24 22Z" {...props} opacity="0.65" />
          <path d="M50 86c-7 0-12-5-12-12 0-7 6-11 8-19 5 5 5 10 4 14 3-2 4-5 4-8 5 5 8 10 8 14 0 7-5 11-12 11Z" {...props} opacity="0.9" />
          <path d="M30 94h40" {...props} opacity="0.3" />
        </svg>
      );
    case "feather":
      return (
        <svg viewBox="0 0 100 100" className="h-full w-full" aria-hidden="true">
          <path d="M70 14C48 18 30 36 28 62c-1 10 2 18 6 22 6-24 22-44 42-56" {...props} opacity="0.8" />
          <path d="M34 84c2-20 12-38 28-52" {...props} opacity="0.55" />
          {[0, 1, 2, 3, 4].map((i) => (
            <path
              key={i}
              d={`M${45 + i * 6} ${34 + i * 10} C ${55 + i * 4} ${31 + i * 9}, ${60 + i * 3} ${29 + i * 9}, ${64 + i * 2} ${27 + i * 9}`}
              {...props}
              opacity="0.35"
            />
          ))}
        </svg>
      );
    case "keyhole":
      return (
        <svg viewBox="0 0 100 100" className="h-full w-full" aria-hidden="true">
          <circle cx="50" cy="38" r="20" {...props} opacity="0.8" />
          <path d="M43 55 34 86h32L57 55" {...props} opacity="0.8" />
          <circle cx="50" cy="38" r="27" {...props} opacity="0.25" strokeDasharray="2 5" />
          <path d="M18 92h64" {...props} opacity="0.3" />
        </svg>
      );
    case "moon":
      return (
        <svg viewBox="0 0 100 100" className="h-full w-full" aria-hidden="true">
          <path d="M62 18c-18 2-31 17-31 36 0 15 9 27 21 32-3 1-7 2-10 2-20 0-36-16-36-36s16-36 36-36c7 0 14 2 20 5Z" {...props} opacity="0.75" />
          <circle cx="69" cy="33" r="1.3" fill={color} opacity="0.8" />
          <circle cx="80" cy="49" r="1" fill={color} opacity="0.6" />
          <circle cx="66" cy="55" r="0.8" fill={color} opacity="0.5" />
          <path d="M56 80h30" {...props} opacity="0.3" />
        </svg>
      );
    case "deco":
      return (
        <svg viewBox="0 0 100 100" className="h-full w-full" aria-hidden="true">
          {[0, 1, 2, 3].map((i) => (
            <path
              key={i}
              d={`M${16 + i * 7} 88V${62 - i * 8}c0-${12 - i * 3} ${15 - i * 3} ${18 - i * 3} ${34 - i * 7} ${18 - i * 3}s${34 - i * 7} 0 ${34 - i * 7} ${18 - i * 3}v${26 + i * 8}`}
              {...props}
              opacity={0.28 + i * 0.16}
            />
          ))}
          <path d="M50 20v68M26 54h48" {...props} opacity="0.25" />
        </svg>
      );
    default:
      return null;
  }
}

interface BookCoverProps {
  book: Book;
  className?: string;
  showEdition?: boolean;
}

export function BookCover({ book, className, showEdition = true }: BookCoverProps) {
  const lines = splitTitle(book.title);
  const maxLen = Math.max(...lines.map((line) => line.length));
  const base = lines.length === 1 ? 12.8 : lines.length === 2 ? 10.8 : 8.9;
  const titleSize = Math.min(base, 92 / (maxLen * 0.545));
  const style = {
    "--cover-bg": book.cover.bg,
    "--cover-ink": book.cover.ink,
    "--cover-accent": book.cover.accent,
    backgroundColor: book.cover.bg,
    color: book.cover.ink,
  } as CSSProperties;

  if (book.coverImage) {
    return (
      <div
        className={cn(
          "cover-container grain relative aspect-[2/3] w-full overflow-hidden rounded-[2px] book-shadow",
          className,
        )}
        style={style}
        aria-hidden="true"
      >
        <img
          src={book.coverImage}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div
          className="pointer-events-none absolute inset-0 z-[1]"
          style={{
            background:
              "linear-gradient(180deg, rgba(0,0,0,.12), transparent 18%, transparent 72%, rgba(0,0,0,.38))",
          }}
        />
        <div
          className="pointer-events-none absolute inset-y-0 left-0 z-[3] w-[3.4%]"
          style={{
            background:
              "linear-gradient(90deg, rgba(0,0,0,.34), rgba(255,255,255,.10) 42%, rgba(0,0,0,.05) 62%, transparent)",
          }}
        />
        <div className="absolute inset-[4.5%] z-[2] border border-white/15" />
        <div className="absolute inset-x-0 bottom-0 z-[4] flex items-end justify-between gap-2 p-[8%]">
          <span className="shrink-0 rounded-full bg-black/35 px-2.5 py-1 text-[0.5rem] font-medium uppercase tracking-[0.16em] text-white/85 backdrop-blur-sm">
            PDF
          </span>
          <span className="min-w-0 truncate font-display text-[2.2cqw] uppercase tracking-[0.14em] text-white/75">
            {book.author}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "cover-container grain relative aspect-[2/3] w-full overflow-hidden rounded-[2px] book-shadow",
        className,
      )}
      style={style}
      aria-hidden="true"
    >
      <div
        className="pointer-events-none absolute inset-0 z-[1]"
        style={{
          background:
            "radial-gradient(120% 90% at 15% 0%, rgba(255,255,255,.10), transparent 55%), linear-gradient(180deg, rgba(0,0,0,.06), transparent 24%, transparent 70%, rgba(0,0,0,.16))",
        }}
      />
      <div
        className="pointer-events-none absolute inset-y-0 left-0 z-[3] w-[3.4%]"
        style={{
          background:
            "linear-gradient(90deg, rgba(0,0,0,.34), rgba(255,255,255,.10) 42%, rgba(0,0,0,.05) 62%, transparent)",
        }}
      />
      <div className="absolute inset-[4.5%] z-[2] border border-white/10" />

      <div className="relative z-[4] flex h-full flex-col px-[10%] py-[8.5%]">
        <div className="flex items-center justify-between">
          <span
            className="font-medium uppercase"
            style={{
              fontSize: "2.45cqw",
              letterSpacing: "0.24em",
              color: book.cover.accent,
            }}
          >
            Akshara
          </span>
          <span
            className="uppercase"
            style={{
              fontSize: "2.1cqw",
              letterSpacing: "0.16em",
              opacity: 0.45,
            }}
          >
            {showEdition ? "Edition" : ""}
          </span>
        </div>

        <div
          className="pointer-events-none absolute left-[16%] right-[8%] top-[16%] h-[48%]"
          style={{ color: book.cover.accent }}
        >
          <Motif motif={book.motif} color={book.cover.accent} />
        </div>

        <div className="relative mt-auto">
          <div
            className="mb-[6%] h-px w-[12%]"
            style={{ backgroundColor: book.cover.accent, opacity: 0.8 }}
          />
          <h3
            className="font-display font-normal tracking-[-0.025em]"
            style={{
              fontSize: `${titleSize}cqw`,
              lineHeight: 1.02,
              fontVariationSettings: '"opsz" 72',
              textWrap: "balance",
            }}
          >
            {lines.map((line, index) => (
              <span key={`${line}-${index}`} className="block">
                {line}
              </span>
            ))}
          </h3>
          <p
            className="font-medium uppercase"
            style={{
              marginTop: "7%",
              fontSize: "2.8cqw",
              letterSpacing: "0.16em",
              opacity: 0.72,
            }}
          >
            {book.author}
          </p>
        </div>

        <div className="mt-[8%] flex items-center justify-between">
          <span
            className="h-px flex-1"
            style={{ backgroundColor: book.cover.ink, opacity: 0.16 }}
          />
          <span
            className="ml-[5%] uppercase"
            style={{
              fontSize: "1.9cqw",
              letterSpacing: "0.2em",
              opacity: 0.4,
            }}
          >
            {book.year}
          </span>
        </div>
      </div>
    </div>
  );
}
