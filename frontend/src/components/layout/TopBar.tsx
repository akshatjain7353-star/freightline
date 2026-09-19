import { useTheme } from "../../theme/use-theme";
import { useAuth } from "../../lib/auth-context";

export function TopBar({ title }: { title: string }) {
  const { theme, toggleTheme } = useTheme();
  const { session, role, signOut } = useAuth();

  return (
    <header className="h-14 shrink-0 border-b border-border bg-surface flex items-center justify-between gap-3 px-6">
      <h1 className="text-sm font-semibold text-primary whitespace-nowrap truncate min-w-0">{title}</h1>
      <div className="flex items-center gap-4 shrink-0">
        <button
          onClick={toggleTheme}
          className="text-xs px-2.5 py-1.5 rounded border border-border text-secondary hover:text-primary hover:border-accent transition-colors whitespace-nowrap"
        >
          {theme === "dark" ? "☾ Dark" : "☀ Light"}
        </button>
        {session && (
          <div className="hidden sm:flex items-center gap-3 text-xs text-secondary min-w-0">
            <span className="truncate max-w-[16ch]" title={session.user.email}>
              {session.user.email}
            </span>
            {role && (
              <span className="font-mono text-[10px] uppercase tracking-wide text-muted border border-border rounded px-1.5 py-0.5">
                {role}
              </span>
            )}
            <button onClick={signOut} className="hover:text-primary underline decoration-dotted whitespace-nowrap">
              Sign out
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
