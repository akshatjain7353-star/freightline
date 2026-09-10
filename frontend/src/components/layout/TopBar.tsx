import { useTheme } from "../../theme/use-theme";
import { useAuth } from "../../lib/auth-context";

export function TopBar({ title }: { title: string }) {
  const { theme, toggleTheme } = useTheme();
  const { session, signOut } = useAuth();

  return (
    <header className="h-14 shrink-0 border-b border-border bg-surface flex items-center justify-between px-6">
      <h1 className="text-sm font-semibold text-primary">{title}</h1>
      <div className="flex items-center gap-4">
        <button
          onClick={toggleTheme}
          className="text-xs px-2.5 py-1.5 rounded border border-border text-secondary hover:text-primary hover:border-accent transition-colors"
        >
          {theme === "dark" ? "☾ Dark" : "☀ Light"}
        </button>
        {session && (
          <div className="flex items-center gap-3 text-xs text-secondary">
            <span>{session.user.email}</span>
            <button onClick={signOut} className="hover:text-primary underline decoration-dotted">
              Sign out
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
