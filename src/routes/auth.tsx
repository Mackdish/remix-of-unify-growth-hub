import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ShieldCheck, Lock, Loader2 } from "lucide-react";
import logo from "@/assets/logo.png";
import { supabase } from "@/integrations/supabase/client";
import { getAuthenticatedLandingRoute } from "@/lib/auth-routing";
import { acceptMemberInvite } from "@/lib/member-invites.functions";
import { SITE_URL } from "@/lib/site-config";
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
  const claimInvite = useServerFn(acceptMemberInvite);
  const [mode, setMode] = useState<"signin" | "signup" | "reset">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const claimPendingInvite = useCallback(async () => {
    const token = new URLSearchParams(window.location.search).get("invite");
    if (!token) return;
    await claimInvite({ data: { token } });
    window.history.replaceState({}, "", "/auth");
  }, [claimInvite]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    if (params.get("reset") === "1" || hashParams.get("type") === "recovery") {
      setMode("reset");
      return;
    }

    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return;
      try {
        await claimPendingInvite();
        navigate({ to: await getAuthenticatedLandingRoute(data.user.id), replace: true });
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Could not verify account access");
      }
    });
  }, [claimPendingInvite, navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signin") {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        await claimPendingInvite();
        toast.success("Welcome back");
        navigate({ to: await getAuthenticatedLandingRoute(data.user.id), replace: true });
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${SITE_URL}/dashboard` },
        });
        if (error) throw error;
        toast.success("Account created. If email confirmation is required, check your inbox.");
        navigate({ to: "/dashboard", replace: true });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sign-in failed");
    } finally {
      setBusy(false);
    }
  };

  const forgot = async () => {
    if (!email) {
      toast.error("Enter your email first, then tap “Forgot password”.");
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${SITE_URL}/auth?reset=1`,
      });
      if (error) throw error;
      toast.success("Password reset link sent — check your inbox.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not send reset email");
    } finally {
      setBusy(false);
    }
  };

  const resetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      toast.error("Password must be at least 8 characters.");
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast.success("Password updated successfully. Welcome back.");
      window.history.replaceState({}, "", "/auth");
      navigate({ to: "/dashboard", replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update your password");
    } finally {
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
          <li className="flex gap-3"><Lock className="h-5 w-5 text-primary-glow shrink-0" /> Passwords are protected by Supabase Auth. Use the password-reset link if you need to change yours.</li>
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

        <form onSubmit={mode === "reset" ? resetPassword : submit} className="space-y-4">
          <div>
            <label className="text-sm font-medium text-foreground">Email</label>
            <input
              required={mode !== "reset"} type="email" value={email} onChange={(e) => setEmail(e.target.value)}
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
            {mode === "reset" ? "Update password" : mode === "signin" ? "Sign in" : "Create account"}
          </button>
        </form>

        {mode === "signin" && (
          <button
            type="button"
            onClick={forgot}
            disabled={busy}
            className="mt-3 w-full text-xs text-muted-foreground hover:text-primary disabled:opacity-60"
          >
            Forgot password? Email me a reset link
          </button>
        )}

        <p className="mt-6 text-xs text-muted-foreground text-center">
          New members should use the invitation link supplied by an administrator. Your password is created by you and is never visible to administrators.
        </p>
      </div>
    </div>
  );
}
