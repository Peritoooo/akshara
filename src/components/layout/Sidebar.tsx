import { useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import {
  BarChart3,
  Heart,
  Home,
  Library,
  Plus,
  Settings,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { useLibraryStore } from "@/store/library";
import { useSettingsStore } from "@/store/settings";
import { getCollectionCount } from "@/lib/stats";
import { cn } from "@/lib/utils";
import { Logo } from "./Logo";
import { ReadingGoal } from "./ReadingGoal";
import { Avatar } from "@/components/ui/Misc";
import { IconButton } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { TextInput } from "@/components/ui/Field";

const navItems = [
  { to: "/", label: "Home", icon: Home, end: true },
  { to: "/library", label: "My Library", icon: Library },
  { to: "/favorites", label: "Favorites", icon: Heart },
  { to: "/stats", label: "Reading Statistics", icon: BarChart3 },
  { to: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar() {
  const location = useLocation();
  const entries = useLibraryStore((state) => state.entries);
  const collections = useLibraryStore((state) => state.collections);
  const createCollection = useLibraryStore((state) => state.createCollection);
  const displayName = useSettingsStore((state) => state.displayName);
  const favoriteCount = Object.values(entries).filter((entry) => entry.favorite).length;
  const [newCollectionOpen, setNewCollectionOpen] = useState(false);
  const [collectionName, setCollectionName] = useState("");

  const handleCreateCollection = () => {
    if (!collectionName.trim()) return;
    const name = collectionName.trim();
    createCollection(name);
    setCollectionName("");
    setNewCollectionOpen(false);
    toast.success("Collection created", { description: name });
  };

  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-[272px] flex-col border-r border-line bg-surface/45 lg:flex">
      <div className="px-6 pb-6 pt-7">
        <Logo />
      </div>

      <div className="flex-1 overflow-y-auto px-3">
        <nav aria-label="Primary" className="space-y-0.5">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  "group flex h-10 items-center gap-3 rounded-lg px-3 text-[0.8125rem] transition-all duration-200",
                  isActive
                    ? "border border-line bg-surface text-ink shadow-soft"
                    : "border border-transparent text-ink-soft hover:bg-muted/70 hover:text-ink",
                )
              }
            >
              {({ isActive }) => (
                <>
                  <item.icon
                    className={cn(
                      "h-[1.05rem] w-[1.05rem] transition-colors",
                      isActive ? "text-accent-strong" : "text-ink-muted group-hover:text-ink-soft",
                    )}
                    strokeWidth={1.7}
                  />
                  <span className="flex-1">{item.label}</span>
                  {item.to === "/favorites" && favoriteCount > 0 ? (
                    <span className="text-[0.625rem] tabular-nums text-ink-muted">
                      {favoriteCount}
                    </span>
                  ) : null}
                  {isActive ? (
                    <span className="h-1 w-1 rounded-full bg-accent-strong" />
                  ) : null}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="mt-8">
          <div className="flex items-center justify-between px-3">
            <p className="text-[0.5875rem] font-medium uppercase tracking-[0.2em] text-ink-muted">
              Collections
            </p>
            <button
              type="button"
              onClick={() => setNewCollectionOpen(true)}
              aria-label="Create a collection"
              className="rounded-full p-1 text-ink-muted transition-colors hover:bg-muted hover:text-ink"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="mt-2 space-y-0.5">
            {collections.map((collection) => {
              const active =
                location.pathname === "/library" &&
                new URLSearchParams(location.search).get("collection") === collection.id;
              return (
                <Link
                  key={collection.id}
                  to={`/library?collection=${collection.id}`}
                  className={cn(
                    "group flex items-center gap-2.5 rounded-lg px-3 py-2 text-[0.75rem] transition-colors",
                    active
                      ? "bg-muted text-ink"
                      : "text-ink-muted hover:bg-muted/60 hover:text-ink",
                  )}
                >
                  <span
                    className={cn(
                      "h-1 w-1 rounded-full transition-colors",
                      active ? "bg-accent-strong" : "bg-line-strong group-hover:bg-accent",
                    )}
                  />
                  <span className="flex-1 truncate">{collection.name}</span>
                  <span className="text-[0.625rem] tabular-nums text-ink-muted/70">
                    {getCollectionCount(entries, collection.id)}
                  </span>
                </Link>
              );
            })}
            {collections.length === 0 ? (
              <button
                type="button"
                onClick={() => setNewCollectionOpen(true)}
                className="flex w-full items-center gap-2 rounded-lg border border-dashed border-line-strong/70 px-3 py-2.5 text-left text-[0.7rem] text-ink-muted transition-colors hover:border-line-strong hover:text-ink"
              >
                <Sparkles className="h-3.5 w-3.5" />
                Create your first collection
              </button>
            ) : null}
          </div>
        </div>
      </div>

      <div className="space-y-3 border-t border-line p-4">
        <ReadingGoal />
        <Link
          to="/settings"
          className="flex items-center gap-2.5 rounded-lg px-1 py-1 transition-colors hover:bg-muted/60"
        >
          <Avatar name={displayName} />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[0.75rem] font-medium text-ink">
              {displayName}
            </span>
            <span className="block text-[0.625rem] text-ink-muted">Local library</span>
          </span>
          <IconButton label="Open settings" size="sm" className="text-ink-muted">
            <Settings className="h-3.5 w-3.5" />
          </IconButton>
        </Link>
      </div>

      <Dialog
        open={newCollectionOpen}
        onOpenChange={(open) => {
          setNewCollectionOpen(open);
          if (!open) setCollectionName("");
        }}
        title="New collection"
        description="Gather books around a mood, a theme, or a season of reading."
        footer={
          <>
            <button
              type="button"
              onClick={() => setNewCollectionOpen(false)}
              className="h-9 rounded-full px-4 text-[0.8125rem] font-medium text-ink-soft transition-colors hover:bg-muted hover:text-ink"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleCreateCollection}
              disabled={!collectionName.trim()}
              className="h-9 rounded-full bg-ink px-4 text-[0.8125rem] font-medium text-canvas transition-opacity hover:opacity-90 disabled:opacity-40"
            >
              Create collection
            </button>
          </>
        }
      >
        <label htmlFor="collection-name" className="mb-2 block text-xs text-ink-muted">
          Collection name
        </label>
        <TextInput
          id="collection-name"
          value={collectionName}
          onChange={(event) => setCollectionName(event.target.value)}
          placeholder="e.g. Rainy afternoons"
          maxLength={40}
          autoFocus
          onKeyDown={(event) => {
            if (event.key === "Enter") handleCreateCollection();
          }}
        />
      </Dialog>
    </aside>
  );
}
