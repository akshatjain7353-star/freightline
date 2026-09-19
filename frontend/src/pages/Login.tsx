import { useState, type FormEvent } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../lib/auth-context";

const setupReady = Boolean(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY);

export function Login() {
  const { session, signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (session) return <Navigate to="/" replace />;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const { error: signInError } = await signIn(email, password);
    setSubmitting(false);
    if (signInError) setError(signInError);
  }

  return (
    <div className="h-screen w-screen flex items-center justify-center bg-app">
      <form onSubmit={handleSubmit} className="w-80 bg-surface border border-border rounded p-6 flex flex-col gap-4">
        <div>
          <h1 className="font-mono text-sm font-semibold tracking-wider text-primary">FREIGHTLINE</h1>
          <p className="text-xs text-muted mt-1">Time Bound internal ops console</p>
        </div>
        {!setupReady && (
          <div className="text-xs text-warning bg-warning/10 border border-warning/30 rounded px-2 py-1.5">
            Frontend env is incomplete. Copy <span className="font-mono">frontend/.env.example</span> to{" "}
            <span className="font-mono">.env</span> and set <span className="font-mono">VITE_SUPABASE_URL</span> and{" "}
            <span className="font-mono">VITE_SUPABASE_ANON_KEY</span>.
          </div>
        )}
        {error && <div className="text-xs text-danger bg-danger/10 border border-danger/30 rounded px-2 py-1.5">{error}</div>}
        <div className="flex flex-col gap-1">
          <label className="text-xs text-secondary">Email</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="bg-surface2 border border-border rounded px-2.5 py-1.5 text-sm focus:outline-none focus:border-accent"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-secondary">Password</label>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="bg-surface2 border border-border rounded px-2.5 py-1.5 text-sm focus:outline-none focus:border-accent"
          />
        </div>
        <button
          type="submit"
          disabled={submitting || !setupReady}
          className="bg-accent text-accent-fg rounded py-1.5 text-sm font-medium hover:opacity-90 disabled:opacity-50"
        >
          {submitting ? "Signing in..." : "Sign in"}
        </button>
      </form>
    </div>
  );
}
