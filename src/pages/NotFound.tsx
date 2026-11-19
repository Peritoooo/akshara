import { Link } from "react-router-dom";
import { ArrowLeft, Compass } from "lucide-react";
import { buttonStyles } from "@/components/ui/Button";

export function NotFoundPage() {
  return (
    <div className="page-wrap flex min-h-[70vh] flex-col items-center justify-center py-20 text-center">
      <p className="font-display text-[clamp(4rem,12vw,8rem)] leading-none tracking-[-0.04em] text-line-strong">
        404
      </p>
      <p className="eyebrow mt-4">A page left out of the book</p>
      <h1 className="display-title mt-3 text-[clamp(1.8rem,4vw,2.6rem)] text-ink">
        This chapter does not exist.
      </h1>
      <p className="mt-3 max-w-md text-sm leading-relaxed text-ink-muted">
        The link may be incomplete, or the page may have been moved. The rest of the
        library is exactly where you left it.
      </p>
      <div className="mt-7 flex items-center gap-2.5">
        <Link to="/" className={buttonStyles("primary", "md")}>
          <ArrowLeft className="h-4 w-4" />
          Return home
        </Link>
        <Link to="/library" className={buttonStyles("secondary", "md")}>
          <Compass className="h-4 w-4" />
          Browse books
        </Link>
      </div>
    </div>
  );
}
