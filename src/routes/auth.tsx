import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ShieldCheck, Lock, Loader2 } from "lucide-react";
import logo from "@/assets/logo.png";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { toast } from "sonner";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Member Login — Unify Youth Group" },
      { name: "description", content: "Members of Unify Youth Group sign in to view their contributions, loans, and statements." },
      { property: "og:title", content: "Member Login — Unify Youth Group" },
      { property: "og:description", content: "Secure member sign-in for Unify Youth Group." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Auth,
});

function Auth() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) navigate({ to: "/dashboard", replace: true });
    });
  }, [navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Welcome back");
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${window.location.origin}/dashboard` },
        });
        if (error) throw error;
        toast.success("Account created. If email confirmation is required, check your inbox.");
      }
      navigate({ to: "/dashboard", replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sign-in failed");
    } finally {
      setBusy(false);
    }
  };

  const google = async () => {
    setBusy(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
      if (result.error) throw result.error;
      if (result.redirected) return;
      navigate({ to: "/dashboard", replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Google sign-in failed");
      setBusy(false);
    }
  };

  return (
    <div className="container-page py-16 md:py-24 grid lg:grid-cols-2 gap-12 items-center">
      <div>
        <img src={logo} alt="Unify Youth Group" className="h-16 w-16" width={64} height={64} />
        <h1 className="mt-6 text-3xl md:text-4xl text-foreground">Member portal</h1>
        <p className="mt-3 max-w-md text-muted-foreground">
          Sign in with the credentials issued by your group administrator to view your contributions,
          loans, dues and financial statement.
        </p>
        <ul className="mt-8 space-y-3 text-sm text-muted-foreground">
          <li className="flex gap-3"><ShieldCheck className="h-5 w-5 text-primary-glow shrink-0" /> Your records are private — only you and authorised admins can view them.</li>
          <li className="flex gap-3"><Lock className="h-5 w-5 text-primary-glow shrink-0" /> Passwords are encrypted. Contact your admin to reset yours.</li>
        </ul>
      </div>

      <div className="rounded-2xl bg-card border border-border p-8 shadow-[var(--shadow-elegant)] max-w-md w-full mx-auto">
        <div className="flex gap-1 p-1 rounded-lg bg-secondary mb-6">
          <button
            type="button"
            onClick={() => setMode("signin")}
            className={`flex-1 py-2 text-sm font-medium rounded-md transition ${mode === "signin" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground"}`}
          >Sign in</button>
          <button
            type="button"
            onClick={() => setMode("signup")}
            className={`flex-1 py-2 text-sm font-medium rounded-md transition ${mode === "signup" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground"}`}
          >Create account</button>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="text-sm font-medium text-foreground">Email</label>
            <input
              required type="email" value={email} onChange={(e) => setEmail(e.target.value)}
              className="mt-1.5 w-full rounded-lg border border-input bg-background px-3.5 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              placeholder="you@example.com"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-foreground">Password</label>
            <input
              required type="password" minLength={6} value={password} onChange={(e) => setPassword(e.target.value)}
              className="mt-1.5 w-full rounded-lg border border-input bg-background px-3.5 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              placeholder="••••••••"
            />
          </div>
          <button disabled={busy} type="submit" className="btn-primary w-full disabled:opacity-60">
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            {mode === "signin" ? "Sign in" : "Create account"}
          </button>
        </form>

        <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
          <span className="h-px flex-1 bg-border" /> OR <span className="h-px flex-1 bg-border" />
        </div>

        <button onClick={google} disabled={busy} className="btn-outline w-full disabled:opacity-60">
          Continue with Google
        </button>

        <p className="mt-6 text-xs text-muted-foreground text-center">
          New members: after signing in, ask an admin to link your account to your member record.
        </p>
      </div>
    </div>
  );
}
