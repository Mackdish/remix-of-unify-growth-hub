import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  ShieldCheck,
  Users,
  Wallet,
  BookOpen,
  TrendingUp,
  AlertTriangle,
  ArrowRight,
  Link2,
  ArrowLeft,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/")({
  head: () => ({
    meta: [
      { title: "Admin Dashboard — Unify Youth Group" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminDashboard,
});

const fmt = (n: number) =>
  `KSh ${Number(n).toLocaleString("en-KE", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

const CAT_LABEL: Record<string, string> = {
  monthly_contribution: "Monthly contribution",
  account_boosting: "Account boosting",
  fine: "Fine",
  loan_disbursement: "Loan disbursement",
  loan_repayment: "Loan repayment",
  shirts_loan: "Shirts loan",
  interest: "Interest",
  due: "Due",
  penalty: "Penalty",
  other: "Other",
};

function AdminDashboard() {
  const navigate = useNavigate();

  const { data: isAdmin, isLoading: checking } = useQuery({
    queryKey: ["is-admin"],
    queryFn: async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) return false;
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", data.user.id);
      return (roles ?? []).some((r: { role: string }) =>
        ["super_admin", "treasurer", "secretary", "project_manager"].includes(r.role),
      );
    },
  });

  useEffect(() => {
    if (!checking && isAdmin === false) {
      toast.error("Admin access required");
      navigate({ to: "/dashboard" });
    }
  }, [isAdmin, checking, navigate]);

  const { data: members } = useQuery({
    queryKey: ["admin-members"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("members")
        .select("id, member_code, full_name, user_id, status")
        .order("member_code");
      if (error) throw error;
      return data;
    },
    enabled: !!isAdmin,
  });

  const { data: txns } = useQuery({
    queryKey: ["admin-txns"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transactions")
        .select("id, member_id, category, amount, transaction_date, description")
        .order("transaction_date", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!isAdmin,
  });

  const memberMap = useMemo(
    () => Object.fromEntries((members ?? []).map((m) => [m.id, m])),
    [members],
  );

  const stats = useMemo(() => {
    const totals: Record<string, number> = {};
    let grand = 0;
    (txns ?? []).forEach((t) => {
      const amt = Number(t.amount);
      totals[t.category] = (totals[t.category] ?? 0) + amt;
      grand += amt;
    });
    const outstandingLoans =
      (totals.loan_disbursement ?? 0) - (totals.loan_repayment ?? 0);
    return { totals, grand, outstandingLoans };
  }, [txns]);

  const recent = (txns ?? []).slice(0, 8);
  const unlinked = (members ?? []).filter((m) => !m.user_id);

  if (checking || !isAdmin) {
    return (
      <div className="container-page py-24 text-center text-muted-foreground">
        Checking access…
      </div>
    );
  }

  return (
    <div className="container-page py-10">
      <div className="flex flex-wrap justify-between items-center gap-3">
        <div>
          <div className="flex items-center gap-2 text-xs text-primary-glow font-semibold uppercase tracking-widest">
            <ShieldCheck className="h-4 w-4" /> Admin
          </div>
          <h1 className="mt-1 text-3xl md:text-4xl text-foreground">Admin dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Group overview — members, contributions, and outstanding balances.
          </p>
        </div>
        <Link to="/dashboard" className="btn-outline">
          <ArrowLeft className="h-4 w-4" /> My dashboard
        </Link>
      </div>

      {/* Top stats */}
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={<Wallet className="h-5 w-5" />}
          label="Total ledger value"
          value={fmt(stats.grand)}
          hint="Sum across all categories"
        />
        <StatCard
          icon={<Users className="h-5 w-5" />}
          label="Members"
          value={String(members?.length ?? 0)}
          hint={`${unlinked.length} without linked account`}
        />
        <StatCard
          icon={<TrendingUp className="h-5 w-5" />}
          label="Monthly contributions"
          value={fmt(stats.totals.monthly_contribution ?? 0)}
          hint="Lifetime"
        />
        <StatCard
          icon={<AlertTriangle className="h-5 w-5" />}
          label="Outstanding loans"
          value={fmt(stats.outstandingLoans)}
          hint="Disbursed − repaid"
          tone={stats.outstandingLoans > 0 ? "warn" : "ok"}
        />
      </div>

      {/* Quick actions */}
      <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <ActionCard
          to="/admin/ledger"
          icon={<BookOpen className="h-5 w-5" />}
          title="Transaction ledger"
          description="Add, filter, or remove entries across all categories."
        />
        <ActionCard
          to="/admin/ledger"
          icon={<Link2 className="h-5 w-5" />}
          title="Manage members"
          description="Link member records to user logins so dashboards populate."
        />
        <ActionCard
          to="/admin/ledger"
          icon={<Wallet className="h-5 w-5" />}
          title="Record contribution"
          description="Log a new payment, boost, fine, or repayment."
        />
        <ActionCard
          to="/admin/roles"
          icon={<ShieldCheck className="h-5 w-5" />}
          title="Role management"
          description="Assign or revoke admin permissions (super admin only)."
        />
      </div>

      {/* Category breakdown */}
      <section className="mt-10">
        <h2 className="text-lg font-semibold text-foreground">Category breakdown</h2>
        <div className="mt-3 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {Object.entries(CAT_LABEL).map(([key, label]) => (
            <div
              key={key}
              className="rounded-lg bg-card border border-border p-3 shadow-[var(--shadow-soft)]"
            >
              <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                {label}
              </div>
              <div className="mt-1 text-base font-semibold text-foreground">
                {fmt(stats.totals[key] ?? 0)}
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="mt-10 grid gap-6 lg:grid-cols-3">
        {/* Recent transactions */}
        <section className="lg:col-span-2 rounded-2xl bg-card border border-border overflow-hidden shadow-[var(--shadow-soft)]">
          <div className="px-5 py-4 border-b border-border flex justify-between items-center">
            <h2 className="text-lg font-semibold text-foreground">Recent transactions</h2>
            <Link to="/admin/ledger" className="text-sm text-primary hover:underline inline-flex items-center gap-1">
              View all <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          {recent.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              No transactions yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-secondary text-left text-xs uppercase tracking-wide">
                  <tr>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Member</th>
                    <th className="px-4 py-3">Category</th>
                    <th className="px-4 py-3 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {recent.map((t) => {
                    const m = memberMap[t.member_id];
                    return (
                      <tr key={t.id} className="hover:bg-secondary/40">
                        <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                          {t.transaction_date}
                        </td>
                        <td className="px-4 py-3 font-medium text-foreground">
                          {m ? `${m.member_code} — ${m.full_name}` : "—"}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {CAT_LABEL[t.category] ?? t.category}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold">
                          {fmt(Number(t.amount))}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Unlinked members */}
        <section className="rounded-2xl bg-card border border-border overflow-hidden shadow-[var(--shadow-soft)]">
          <div className="px-5 py-4 border-b border-border">
            <h2 className="text-lg font-semibold text-foreground">Needs account linking</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {unlinked.length} of {members?.length ?? 0} members
            </p>
          </div>
          {unlinked.length === 0 ? (
            <div className="p-6 text-sm text-muted-foreground">
              All members are linked to an account. 🎉
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {unlinked.slice(0, 10).map((m) => (
                <li key={m.id} className="px-5 py-3 flex justify-between items-center">
                  <div>
                    <div className="text-sm font-medium text-foreground">{m.full_name}</div>
                    <div className="text-xs text-muted-foreground">{m.member_code}</div>
                  </div>
                  <Link
                    to="/admin/ledger"
                    className="text-xs text-primary hover:underline inline-flex items-center gap-1"
                  >
                    Link <ArrowRight className="h-3 w-3" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  hint,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
  tone?: "ok" | "warn";
}) {
  return (
    <div className="rounded-2xl bg-card border border-border p-5 shadow-[var(--shadow-soft)]">
      <div className="flex items-center gap-2 text-muted-foreground">
        <span
          className={
            tone === "warn"
              ? "text-destructive"
              : tone === "ok"
                ? "text-primary"
                : "text-primary"
          }
        >
          {icon}
        </span>
        <span className="text-xs uppercase tracking-wide">{label}</span>
      </div>
      <div className="mt-2 text-2xl font-semibold text-foreground">{value}</div>
      {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}

function ActionCard({
  to,
  icon,
  title,
  description,
}: {
  to: string;
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <Link
      to={to}
      className="group rounded-2xl bg-card border border-border p-5 shadow-[var(--shadow-soft)] hover:border-primary/50 transition-colors"
    >
      <div className="flex items-center gap-2 text-primary">
        {icon}
        <span className="font-semibold text-foreground">{title}</span>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">{description}</p>
      <div className="mt-3 inline-flex items-center gap-1 text-sm text-primary">
        Open <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
      </div>
    </Link>
  );
}
