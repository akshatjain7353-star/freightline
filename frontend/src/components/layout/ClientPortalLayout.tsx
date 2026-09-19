import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { useTheme } from "../../theme/use-theme";
import { useAuth } from "../../lib/auth-context";

export function ClientPortalLayout({ title, children }: { title: string; children: ReactNode }) {
  const { theme, toggleTheme } = useTheme();
  const { session, signOut } = useAuth();

  return (
    <div className="min-h-screen bg-app text-primary flex flex-col">
      <header className="border-b border-border bg-surface px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <Link to="/client/shipments" className="font-mono text-sm font-semibold tracking-wider text-primary">
            FREIGHTLINE
          </Link>
          <div className="text-xs text-muted truncate">{title}</div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={toggleTheme}
            className="text-xs px-2.5 py-1.5 rounded border border-border text-secondary hover:text-primary hover:border-accent"
          >
            {theme === "dark" ? "☾ Dark" : "☀ Light"}
          </button>
          {session?.user.email && (
            <span className="hidden sm:inline text-xs text-secondary truncate max-w-[18ch]">{session.user.email}</span>
          )}
          <button onClick={signOut} className="text-xs text-secondary hover:text-primary underline decoration-dotted">
            Sign out
          </button>
        </div>
      </header>
      <main className="flex-1 w-full max-w-3xl mx-auto px-4 sm:px-6 py-6">{children}</main>
    </div>
  );
}
