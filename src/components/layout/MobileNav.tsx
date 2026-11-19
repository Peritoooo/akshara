import { Link, NavLink } from "react-router-dom";
import {
  BarChart3,
  Heart,
  Home,
  Library,
  Search,
  Settings,
} from "lucide-react";
import { useSettingsStore } from "@/store/settings";
import { cn } from "@/lib/utils";
import { Logo } from "./Logo";
import { Avatar } from "@/components/ui/Misc";

const mobileNav = [
  { to: "/", label: "Home", icon: Home, end: true },
  { to: "/library", label: "Library", icon: Library },
  { to: "/favorites", label: "Favorites", icon: Heart },
  { to: "/stats", label: "Stats", icon: BarChart3 },
];

export function MobileHeader() {
  const displayName = useSettingsStore((state) => state.displayName);
  return (
    <header className="sticky top-0 z-40 flex h-[4.25rem] items-center justify-between border-b border-line bg-canvas/85 px-5 backdrop-blur-xl lg:hidden">
      <Logo compact />
      <div className="flex items-center gap-1.5">
        <Link
          to="/library"
          aria-label="Search your library"
          className="flex h-10 w-10 items-center justify-center rounded-full text-ink-soft transition-colors hover:bg-muted hover:text-ink"
        >
          <Search className="h-4 w-4" />
        </Link>
        <Link
          to="/settings"
          aria-label={`Settings for ${displayName}`}
          className="ml-0.5 rounded-full outline-none ring-offset-2 focus-visible:ring-2 focus-visible:ring-accent"
        >
          <Avatar name={displayName} className="h-8 w-8" />
        </Link>
      </div>
    </header>
  );
}

export function MobileTabBar() {
  return (
    <nav
      aria-label="Primary mobile"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/92 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden"
    >
      <div className="mx-auto flex h-[4.15rem] max-w-xl items-stretch justify-around px-2">
        {mobileNav.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              cn(
                "relative flex flex-1 flex-col items-center justify-center gap-1.5 text-[0.5625rem] font-medium tracking-[0.04em] transition-colors",
                isActive ? "text-ink" : "text-ink-muted hover:text-ink-soft",
              )
            }
          >
            {({ isActive }) => (
              <>
                <item.icon
                  className={cn(
                    "h-[1.15rem] w-[1.15rem]",
                    isActive && "text-accent-strong",
                  )}
                  strokeWidth={isActive ? 2 : 1.7}
                />
                <span>{item.label}</span>
                {isActive ? (
                  <span className="absolute bottom-1 h-[2px] w-4 rounded-full bg-accent-strong" />
                ) : null}
              </>
            )}
          </NavLink>
        ))}
        <NavLink
          to="/settings"
          className={({ isActive }) =>
            cn(
              "flex flex-1 flex-col items-center justify-center gap-1.5 text-[0.5625rem] font-medium tracking-[0.04em] transition-colors",
              isActive ? "text-ink" : "text-ink-muted hover:text-ink-soft",
            )
          }
        >
          {({ isActive }) => (
            <>
              <Settings
                className={cn("h-[1.15rem] w-[1.15rem]", isActive && "text-accent-strong")}
                strokeWidth={isActive ? 2 : 1.7}
              />
              <span>Settings</span>
            </>
          )}
        </NavLink>
      </div>
    </nav>
  );
}
