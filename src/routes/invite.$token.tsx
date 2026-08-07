import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, ShieldCheck, KeyRound } from "lucide-react";
import { toast } from "sonner";
import logo from "@/assets/logo.png";
import { supabase } from "@/integrations/supabase/client";
import {
  acceptMemberInvite,
  getMemberInvite,
} from "@/lib/member-invites.functions";

export const Route = createFileRoute("/invite/$token")({
  head: () => ({
    meta: [
      { title: "Accept Your Invitation — Unify Youth Group" },
      {
        name: "description",
        content:
          "Set your own password to activate your Unify Youth Group member account.",
      },
      { property: "og:title", content: "Accept Your Invitation — Unify Youth Group" },
      {
        property: "og:description",
        content: "Activate your Unify Youth Group member account securely.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AcceptInvite,
});

function AcceptInvite() {
  const { token } = Route.useParams();
  const navigate = useNavigate();
  const load = useServerFn(getMemberInvite);
  const accept = useServerFn(acceptMemberInvite);

  const [state, setState] = useState<
    | { status: "loading" }
    | { status: "invalid"; reason: string }
    | { status: "ready"; fullName: string; email: string | null }
  >({ status: "loading" });
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    load({ data: { token } })
      .then((r) => {
        if (!r.valid) return setState({ status: "invalid", reason: r.reason });
        setState({ status: "ready", fullName: r.fullName, email: r.email });
        if (r.email) setEmail(r.email);
      })
      .catch(() => setState({ status: "invalid", reason: "not_found" }));
  }, [token, load]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) return toast.error("Passwords do not match");
    setBusy(true);
    try {
      await accept({ data: { token, email, password } });
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      toast.success("Account activated — welcome!");
      navigate({ to: "/dashboard", replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not activate account");
    } finally {
      setBusy(false);
    }
  };

  if (state.status === "loading") {
    return (
      <div className="container-page py-24 text-center text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin inline" /> Checking your invitation…
      </div>
    );
  }

  if (state.status === "invalid") {
    const msg =
      state.reason === "used"
        ? "This invitation has already been used. Try signing in instead."
        : state.reason === "expired"
          ? "This invitation has expired. Ask your group admin for a new link."
          : "This invitation link is not valid.";
    return (
      <div className="container-page py-24 max-w-lg text-center">
        <h1 className="text-2xl text-foreground">Invitation unavailable</h1>
        <p className="mt-3 text-muted-foreground">{msg}</p>
        <a href="/auth" className="btn-primary mt-6 inline-flex">Go to sign in</a>
      </div>
    );
  }

  return (
    <div className="container-page py-16 md:py-24 grid lg:grid-cols-2 gap-12 items-center">
      <div>
        <img src={logo} alt="Unify Youth Group" className="h-16 w-16" width={64} height={64} />
        <h1 className="mt-6 text-3xl md:text-4xl text-foreground">
          Welcome, {state.fullName.split(" ")[0]}
        </h1>
        <p className="mt-3 max-w-md text-muted-foreground">
          You have been invited to join the Unify Youth Group member portal. Choose your own
          password below — nobody else, including admins, will know it.
        </p>
        <ul className="mt-8 space-y-3 text-sm text-muted-foreground">
          <li className="flex gap-3">
            <ShieldCheck className="h-5 w-5 text-primary-glow shrink-0" /> Your contributions,
            loans and statements stay private to you and authorised admins.
          </li>
          <li className="flex gap-3">
            <KeyRound className="h-5 w-5 text-primary-glow shrink-0" /> This link works once and
            expires — don't share it.
          </li>
        </ul>
      </div>

      <form
        onSubmit={submit}
        className="rounded-2xl bg-card border border-border p-8 shadow-[var(--shadow-elegant)] max-w-md w-full mx-auto space-y-4"
      >
        <div>
          <label className="text-sm font-medium text-foreground">Email</label>
          <input
            required
            type="email"
            value={email}
            readOnly={!!state.email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="mt-1.5 w-full rounded-lg border border-input bg-background px-3.5 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 read-only:opacity-70"
          />
          {state.email && (
            <p className="mt-1 text-xs text-muted-foreground">
              This invite is tied to this address.
            </p>
          )}
        </div>
        <div>
          <label className="text-sm font-medium text-foreground">Create password</label>
          <input
            required
            type="password"
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 8 characters"
            className="mt-1.5 w-full rounded-lg border border-input bg-background px-3.5 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
        </div>
        <div>
          <label className="text-sm font-medium text-foreground">Confirm password</label>
          <input
            required
            type="password"
            minLength={8}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="Repeat your password"
            className="mt-1.5 w-full rounded-lg border border-input bg-background px-3.5 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
        </div>
        <button disabled={busy} type="submit" className="btn-primary w-full disabled:opacity-60">
          {busy && <Loader2 className="h-4 w-4 animate-spin" />} Activate my account
        </button>
      </form>
    </div>
  );
}
