import { createFileRoute, Link } from "@tanstack/react-router";
import { ShieldCheck, Lock } from "lucide-react";
import logo from "@/assets/logo.png";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Member Login — Unify Youth Group" },
      { name: "description", content: "Members of Unify Youth Group sign in here to view their contributions, loans, and statements." },
      { property: "og:title", content: "Member Login — Unify Youth Group" },
      { property: "og:description", content: "Secure member sign-in for Unify Youth Group." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Auth,
});

function Auth() {
  return (
    <div className="container-page py-16 md:py-24 grid lg:grid-cols-2 gap-12 items-center">
      <div>
        <img src={logo} alt="Unify Youth Group" className="h-16 w-16" width={64} height={64} />
        <h1 className="mt-6 text-3xl md:text-4xl text-foreground">Member portal</h1>
        <p className="mt-3 max-w-md text-muted-foreground">
          Sign in with the credentials issued by your group administrator to view your contributions,
          loans, dues, and financial statement.
        </p>
        <ul className="mt-8 space-y-3 text-sm text-muted-foreground">
          <li className="flex gap-3"><ShieldCheck className="h-5 w-5 text-primary-glow shrink-0" /> Your records are private — only you and authorised admins can view them.</li>
          <li className="flex gap-3"><Lock className="h-5 w-5 text-primary-glow shrink-0" /> Passwords are encrypted. Contact your admin to reset yours.</li>
        </ul>
      </div>

      <div className="rounded-2xl bg-card border border-border p-8 shadow-[var(--shadow-elegant)] max-w-md w-full mx-auto">
        <h2 className="text-xl font-semibold text-foreground">Sign in</h2>
        <p className="mt-1 text-sm text-muted-foreground">Member portal login will be enabled in the next update.</p>

        <div className="mt-6 space-y-4 opacity-60 pointer-events-none">
          <div>
            <label className="text-sm font-medium text-foreground">Member ID or email</label>
            <input className="mt-1.5 w-full rounded-lg border border-input bg-background px-3.5 py-2.5 text-sm" placeholder="e.g. UYG-001 or you@example.com" />
          </div>
          <div>
            <label className="text-sm font-medium text-foreground">Password</label>
            <input type="password" className="mt-1.5 w-full rounded-lg border border-input bg-background px-3.5 py-2.5 text-sm" placeholder="••••••••" />
          </div>
          <button className="btn-primary w-full">Sign in</button>
        </div>

        <div className="mt-6 rounded-lg bg-secondary p-4 text-xs text-secondary-foreground">
          <p className="font-semibold">Coming soon</p>
          <p className="mt-1">Secure sign-in, member dashboards and admin controls are being set up. Meanwhile, please <Link to="/contact" className="text-primary underline">contact us</Link> for any questions.</p>
        </div>
      </div>
    </div>
  );
}
