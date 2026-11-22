import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Loader2, Lock, Mail, UserRound } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useSessionStore } from "@/store/session";
import { cn } from "@/lib/utils";
import { LogoMark } from "@/components/layout/LogoMark";
import { Button } from "@/components/ui/Button";
import { TextInput } from "@/components/ui/Field";

type Mode = "signin" | "signup" | "reset";

/** Desktop builds receive reset links through the `akshara://` handler. */
function resetRedirect() {
  if (typeof window === "undefined") return undefined;
  return window.aksharaDesktop
    ? "akshara://auth/recovery"
    : window.location.origin;
}

function friendlyError(message: string) {
  const text = message.toLowerCase();
  if (text.includes("invalid login credentials")) {
    return "That email and password do not match an account.";
  }
  if (text.includes("email not confirmed")) {
    return "Check your inbox and confirm your email address, then sign in.";
  }
  if (text.includes("already registered") || text.includes("already been registered")) {
    return "That email already has an account. Sign in instead.";
  }
  if (text.includes("password should be")) {
    return "Choose a password with at least 8 characters.";
  }
  if (text.includes("should be different")) {
    return "Choose a password you have not used on this account before.";
  }
  if (text.includes("session") && (text.includes("expired") || text.includes("missing"))) {
    return "This reset link has expired. Request a new one and try again.";
  }
  if (text.includes("reauth") || text.includes("reauthenticate")) {
    return "For safety, sign in again before changing the password.";
  }
  if (text.includes("rate limit")) {
    return "Too many attempts. Wait a minute and try again.";
  }
  if (text.includes("failed to fetch") || text.includes("network")) {
    return "The server could not be reached. Check your connection.";
  }
  return message;
}

export function AuthPage() {
  const [mode, setMode] = useState<Mode>("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const canSubmit =
    mode === "reset"
      ? /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
      : /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) && password.length >= 8;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!supabase || !canSubmit || busy) return;
    setBusy(true);
    setError(null);
    setNotice(null);

    if (mode === "reset") {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(
        email.trim(),
        { redirectTo: resetRedirect() },
      );
      if (resetError) {
        setError(friendlyError(resetError.message));
      } else {
        setNotice(
          "If an account exists for that address, a reset link is on its way. Open it on this device to choose a new password.",
        );
      }
    } else if (mode === "signup") {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: { display_name: name.trim() || undefined },
          emailRedirectTo: window.location.origin,
        },
      });
      if (signUpError) {
        setError(friendlyError(signUpError.message));
      } else if (!data.session) {
        setNotice(
          "Your account is ready. Confirm your email address, then sign in here.",
        );
      }
    } else {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (signInError) setError(friendlyError(signInError.message));
    }

    setBusy(false);
  };

  const switchMode = (next: Mode) => {
    setMode(next);
    setError(null);
    setNotice(null);
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-canvas">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_80%_at_15%_-10%,var(--accent-soft)_0%,transparent_55%)] opacity-70"
      />
      <div className="relative mx-auto grid min-h-screen max-w-[1180px] items-center gap-12 px-6 py-10 lg:grid-cols-[1.05fr_0.95fr] lg:px-10">
        <div className="hidden lg:block">
          <div className="flex items-center gap-3">
            <LogoMark className="w-12" />
            <div>
              <p className="text-[0.925rem] font-medium uppercase tracking-[0.28em] text-ink">
                Akshara
              </p>
              <p className="mt-0.5 text-[0.5rem] uppercase tracking-[0.18em] text-ink-muted">
                Every letter opens a world
              </p>
            </div>
          </div>

          <h1 className="mt-14 max-w-[19ch] font-display text-[clamp(2.6rem,4.6vw,3.9rem)] leading-[1.02] tracking-[-0.03em] text-ink">
            Your reading room, wherever you open a book.
          </h1>
          <p className="mt-6 max-w-md text-[0.95rem] leading-relaxed text-ink-soft">
            Sign in once and your library follows you: progress, highlights,
            bookmarks, collections, and daily reading. The PDF files themselves
            stay on the device you imported them on.
          </p>

          <div className="mt-12 space-y-4 border-t border-line pt-8">
            {[
              {
                title: "Private by default",
                body: "Each account can only ever read its own rows, enforced by the database itself.",
              },
              {
                title: "Offline still works",
                body: "Read on a plane. Changes queue quietly and reach your account when you reconnect.",
              },
              {
                title: "PDFs stay local",
                body: "Only the reading metadata syncs — never the file itself.",
              },
            ].map((item) => (
              <div key={item.title} className="flex gap-3">
                <span className="mt-[0.45rem] h-1.5 w-1.5 shrink-0 rounded-full bg-accent-strong" />
                <div>
                  <p className="text-[0.8125rem] font-medium text-ink">{item.title}</p>
                  <p className="mt-0.5 text-[0.75rem] leading-relaxed text-ink-muted">
                    {item.body}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mx-auto w-full max-w-[27rem]">
          <div className="mb-8 flex items-center justify-between lg:hidden">
            <div className="flex items-center gap-3">
              <LogoMark className="w-10" />
              <p className="text-[0.85rem] font-medium uppercase tracking-[0.24em] text-ink">
                Akshara
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-line bg-surface p-6 shadow-lift sm:p-8">
            <div className="flex gap-1 rounded-full border border-line bg-canvas p-1">
              {(
                [
                  { value: "signin", label: "Sign in" },
                  { value: "signup", label: "Create account" },
                ] as Array<{ value: Mode; label: string }>
              ).map((tab) => (
                <button
                  key={tab.value}
                  type="button"
                  onClick={() => switchMode(tab.value)}
                  aria-pressed={mode === tab.value}
                  className={cn(
                    "h-9 flex-1 rounded-full text-[0.8125rem] font-medium transition-all",
                    mode === tab.value
                      ? "border border-line bg-surface text-ink shadow-soft"
                      : "border border-transparent text-ink-muted hover:text-ink",
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <h2 className="mt-7 font-display text-[1.7rem] leading-tight tracking-[-0.02em] text-ink">
              {mode === "signin"
                ? "Welcome back"
                : mode === "signup"
                  ? "Open your reading room"
                  : "Reset your password"}
            </h2>
            <p className="mt-2 text-[0.8rem] leading-relaxed text-ink-muted">
              {mode === "signin"
                ? "Sign in to bring your library together."
                : mode === "signup"
                  ? "One account keeps every highlight and page in step."
                  : "Enter the email on your account and we will send a link to choose a new password."}
            </p>

            <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
              {mode === "signup" ? (
                <label className="block">
                  <span className="mb-1.5 block text-[0.7rem] font-medium text-ink-soft">
                    Display name
                  </span>
                  <div className="relative">
                    <UserRound className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
                    <TextInput
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      placeholder="What should the bookplate say?"
                      maxLength={40}
                      autoComplete="name"
                      className="pl-10"
                    />
                  </div>
                </label>
              ) : null}

              <label className="block">
                <span className="mb-1.5 block text-[0.7rem] font-medium text-ink-soft">
                  Email
                </span>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
                  <TextInput
                    type="email"
                    required
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="you@example.com"
                    autoComplete="email"
                    inputMode="email"
                    className="pl-10"
                  />
                </div>
              </label>

              {mode === "reset" ? null : (
                <label className="block">
                  <span className="mb-1.5 flex items-center justify-between text-[0.7rem] font-medium text-ink-soft">
                    Password
                    <span className="text-[0.65rem] font-normal text-ink-muted">
                      at least 8 characters
                    </span>
                  </span>
                  <div className="relative">
                    <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
                    <TextInput
                      type="password"
                      required
                      minLength={8}
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      placeholder="••••••••"
                      autoComplete={mode === "signin" ? "current-password" : "new-password"}
                      className="pl-10"
                    />
                  </div>
                  {mode === "signin" ? (
                    <button
                      type="button"
                      onClick={() => switchMode("reset")}
                      className="mt-1.5 text-[0.7rem] font-medium text-ink-soft underline decoration-line-strong underline-offset-2 transition-colors hover:text-ink"
                    >
                      Forgot password?
                    </button>
                  ) : null}
                </label>
              )}

              {error ? (
                <p
                  role="alert"
                  className="rounded-xl border border-rose/25 bg-rose/5 px-3.5 py-2.5 text-[0.75rem] leading-relaxed text-rose"
                >
                  {error}
                </p>
              ) : null}

              {notice ? (
                <p className="rounded-xl border border-line bg-canvas px-3.5 py-2.5 text-[0.75rem] leading-relaxed text-ink-soft">
                  {notice}
                </p>
              ) : null}

              <Button
                type="submit"
                size="lg"
                className="w-full"
                disabled={!canSubmit || busy}
              >
                {busy ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {mode === "signin"
                      ? "Signing in…"
                      : mode === "signup"
                        ? "Creating account…"
                        : "Sending link…"}
                  </>
                ) : (
                  <>
                    {mode === "signin"
                      ? "Sign in"
                      : mode === "signup"
                        ? "Create account"
                        : "Send reset link"}
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </Button>
            </form>

            <p className="mt-5 text-center text-[0.65rem] leading-relaxed text-ink-muted">
              {mode === "signin" ? (
                "New here? Create an account — your existing device library joins it."
              ) : mode === "signup" ? (
                "By creating an account you agree to keep your password to yourself."
              ) : (
                <>
                  Remembered it?{" "}
                  <button
                    type="button"
                    onClick={() => switchMode("signin")}
                    className="font-medium text-ink-soft underline decoration-line-strong underline-offset-2 transition-colors hover:text-ink"
                  >
                    Back to sign in
                  </button>
                </>
              )}
            </p>
          </div>

          <p className="mt-6 text-center text-[0.65rem] leading-relaxed text-ink-muted">
            <Link to="/" className="underline decoration-line-strong underline-offset-2">
              Akshara
            </Link>{" "}
            · Every letter opens a new world.
          </p>
        </div>
      </div>
    </div>
  );
}

/**
 * Shown after a reset link opens the app. The link already signed the user in,
 * so this only needs to set the new password.
 */
export function RecoveryPage() {
  const email = useSessionStore((state) => state.email);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = password.length >= 8 && password === confirm;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!supabase || !canSubmit || busy) return;
    setBusy(true);
    setError(null);

    const { error: updateError } = await supabase.auth.updateUser({ password });
    setBusy(false);

    if (updateError) {
      setError(friendlyError(updateError.message));
      return;
    }
    useSessionStore.getState().finishRecovery();
  };

  const cancel = async () => {
    await useSessionStore.getState().signOut();
    useSessionStore.getState().finishRecovery();
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-canvas">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_80%_at_15%_-10%,var(--accent-soft)_0%,transparent_55%)] opacity-70"
      />
      <div className="relative mx-auto flex min-h-screen max-w-[30rem] flex-col justify-center px-6 py-10">
        <div className="mb-8 flex items-center gap-3">
          <LogoMark className="w-10" />
          <div>
            <p className="text-[0.85rem] font-medium uppercase tracking-[0.24em] text-ink">
              Akshara
            </p>
            <p className="mt-0.5 text-[0.5rem] uppercase tracking-[0.18em] text-ink-muted">
              Every letter opens a world
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-line bg-surface p-6 shadow-lift sm:p-8">
          <h1 className="font-display text-[1.7rem] leading-tight tracking-[-0.02em] text-ink">
            Choose a new password
          </h1>
          <p className="mt-2 text-[0.8rem] leading-relaxed text-ink-muted">
            {email
              ? `You are resetting the password for ${email}.`
              : "You are resetting your password."}
          </p>

          <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
            <label className="block">
              <span className="mb-1.5 flex items-center justify-between text-[0.7rem] font-medium text-ink-soft">
                New password
                <span className="text-[0.65rem] font-normal text-ink-muted">
                  at least 8 characters
                </span>
              </span>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
                <TextInput
                  type="password"
                  required
                  minLength={8}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="••••••••"
                  autoComplete="new-password"
                  className="pl-10"
                />
              </div>
            </label>

            <label className="block">
              <span className="mb-1.5 block text-[0.7rem] font-medium text-ink-soft">
                Confirm new password
              </span>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
                <TextInput
                  type="password"
                  required
                  minLength={8}
                  value={confirm}
                  onChange={(event) => setConfirm(event.target.value)}
                  placeholder="••••••••"
                  autoComplete="new-password"
                  className="pl-10"
                />
              </div>
            </label>

            {password.length > 0 && confirm.length > 0 && password !== confirm ? (
              <p className="text-[0.72rem] leading-relaxed text-rose">
                Those passwords do not match yet.
              </p>
            ) : null}

            {error ? (
              <p
                role="alert"
                className="rounded-xl border border-rose/25 bg-rose/5 px-3.5 py-2.5 text-[0.75rem] leading-relaxed text-rose"
              >
                {error}
              </p>
            ) : null}

            <Button type="submit" size="lg" className="w-full" disabled={!canSubmit || busy}>
              {busy ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving…
                </>
              ) : (
                <>
                  Save new password
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>
          </form>

          <p className="mt-5 text-center text-[0.65rem] leading-relaxed text-ink-muted">
            Not your account?{" "}
            <button
              type="button"
              onClick={() => void cancel()}
              className="font-medium text-ink-soft underline decoration-line-strong underline-offset-2 transition-colors hover:text-ink"
            >
              Sign out instead
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
