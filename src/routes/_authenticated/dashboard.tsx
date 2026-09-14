import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { HandCoins, TrendingUp, AlertTriangle, Wallet, PiggyBank, Shirt, Percent, ClipboardList, LogOut, FileText, Download } from "lucide-react";
import { useMemo } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "My Dashboard — Unify Youth Group" }, { name: "robots", content: "noindex" }] }),
  component: Dashboard,
});

type Txn = {
  id: string;
  category: string;
  amount: number;
  transaction_date: string;
  description: string | null;
  reference: string | null;
  source: string;
};

const CATEGORIES: { key: string; label: string; icon: any; tone: string }[] = [
  { key: "monthly_contribution", label: "Monthly contributions", icon: PiggyBank, tone: "text-primary" },
  { key: "account_boosting", label: "Account boosting", icon: TrendingUp, tone: "text-primary" },
  { key: "loan_disbursement", label: "Active loan", icon: HandCoins, tone: "text-accent-foreground" },
  { key: "shirts_loan", label: "Shirts loan", icon: Shirt, tone: "text-primary" },
  { key: "interest", label: "Interest", icon: Percent, tone: "text-primary" },
  { key: "fine", label: "Fines", icon: AlertTriangle, tone: "text-destructive" },
  { key: "due", label: "Outstanding dues", icon: Wallet, tone: "text-destructive" },
  { key: "penalty", label: "Penalties", icon: AlertTriangle, tone: "text-destructive" },
];

const CAT_LABEL: Record<string, string> = Object.fromEntries(
  [...CATEGORIES, { key: "loan_repayment", label: "Loan repayment" }, { key: "other", label: "Other" }].map((c) => [c.key, c.label]),
);

const fmt = (n: number) => `KSh ${n.toLocaleString("en-KE", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

function Dashboard() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["my-financial-summary"],
    queryFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      const [{ data: member, error: memberError }, { data: roles, error: rolesError }] = await Promise.all([
        supabase.from("members").select("id, member_code, full_name, phone, email").eq("user_id", uid ?? "").maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", uid ?? ""),
      ]);
      if (memberError) throw memberError;
      if (rolesError) throw rolesError;
      let transactions: Txn[] = [];
      if (member) {
        const { data: txns, error } = await supabase
          .from("transactions")
          .select("id, category, amount, transaction_date, description, reference, source")
          .eq("member_id", member.id)
          .order("transaction_date", { ascending: false })
          .limit(200);
        if (error) throw error;
        transactions = (txns ?? []) as Txn[];
      }
      let loans: { amount: number; purpose: string; status: string; due_date: string | null; created_at: string }[] = [];
      if (member) {
        const { data: lr, error: loanError } = await supabase
          .from("loan_requests")
          .select("amount, purpose, status, due_date, created_at")
          .eq("member_id", member.id)
          .order("created_at", { ascending: false });
        if (loanError) throw loanError;
        loans = (lr ?? []) as typeof loans;
      }
      const isAdmin = (roles ?? []).some((r: { role: string }) =>
        ["super_admin", "treasurer", "secretary", "project_manager"].includes(r.role),
      );
      return { member, transactions, loans, isAdmin };
    },
  });

  const totals = useMemo(() => {
    const map: Record<string, number> = {};
    (data?.transactions ?? []).forEach((t) => {
      map[t.category] = (map[t.category] ?? 0) + Number(t.amount);
    });
    const loanOutstanding = (map.loan_disbursement ?? 0) - (map.loan_repayment ?? 0);
    const grand =
      (map.monthly_contribution ?? 0) +
      (map.account_boosting ?? 0) +
      (map.fine ?? 0) +
      loanOutstanding +
      (map.shirts_loan ?? 0) +
      (map.interest ?? 0) +
      (map.due ?? 0) +
      (map.penalty ?? 0);
    return { map, loanOutstanding, grand };
  }, [data?.transactions]);

  /** Per-month totals so members can follow their own monthly record. */
  const months = useMemo(() => {
    const byMonth = new Map<
      string,
      { contributions: number; fines: number; loans: number; repayments: number; other: number; count: number }
    >();
    (data?.transactions ?? []).forEach((t) => {
      const key = (t.transaction_date ?? "").slice(0, 7);
      if (!key) return;
      const row =
        byMonth.get(key) ??
        { contributions: 0, fines: 0, loans: 0, repayments: 0, other: 0, count: 0 };
      const amt = Number(t.amount);
      if (t.category === "monthly_contribution" || t.category === "account_boosting") row.contributions += amt;
      else if (t.category === "fine" || t.category === "penalty" || t.category === "due") row.fines += amt;
      else if (t.category === "loan_disbursement" || t.category === "shirts_loan") row.loans += amt;
      else if (t.category === "loan_repayment") row.repayments += amt;
      else row.other += amt;
      row.count += 1;
      byMonth.set(key, row);
    });
    return [...byMonth.entries()]
      .sort((a, b) => (a[0] < b[0] ? 1 : -1))
      .map(([month, v]) => ({
        month,
        label: new Date(`${month}-01T00:00:00`).toLocaleDateString("en-KE", { month: "long", year: "numeric" }),
        ...v,
      }));
  }, [data?.transactions]);

  const downloadStatement = async () => {
    if (!data?.member) return;
    try {
      const { buildMemberStatementPdf } = await import("@/lib/member-statement-pdf");
      const doc = await buildMemberStatementPdf({
        memberName: data.member.full_name,
        memberCode: data.member.member_code,
        txns: data.transactions,
        loans: data.loans ?? [],
      });
      doc.save(`statement-${data.member.member_code}.pdf`);
    } catch {
      toast.error("Could not build your statement");
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    toast.success("Signed out");
    window.location.href = "/auth";
  };

  if (isLoading) {
    return <div className="container-page py-24 text-center text-muted-foreground">Loading your dashboard…</div>;
  }

  if (error) {
    return (
      <div className="container-page py-16 text-center">
        <h1 className="text-2xl font-semibold text-foreground">We couldn’t load your financial records</h1>
        <p className="mt-3 text-sm text-muted-foreground">Please try again. If this continues, ask an administrator to check your account link.</p>
        <button type="button" onClick={() => window.location.reload()} className="btn-primary mt-6">Try again</button>
      </div>
    );
  }

  if (!data?.member) {
    return (
      <div className="container-page py-16">
        <div className="max-w-lg mx-auto rounded-2xl bg-card border border-border p-8 text-center shadow-[var(--shadow-soft)]">
          <ClipboardList className="h-10 w-10 mx-auto text-primary" />
          <h1 className="mt-3 text-2xl font-semibold text-foreground">Account not linked yet</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Your login is active, but it isn't yet linked to a member record. Please contact the group
            administrator so they can link your account and give you access to your financial dashboard.
          </p>
          <Link to="/documents" className="btn-outline mt-6 mx-auto"><FileText className="h-4 w-4" /> Group documents</Link>

          <button onClick={signOut} className="btn-outline mt-3 mx-auto">
            <LogOut className="h-4 w-4" /> Sign out
          </button>
        </div>
      </div>
    );
  }

  const m = data.member;

  return (
    <div className="container-page py-10 md:py-14">
      <div className="flex flex-wrap justify-between items-end gap-4">
        <div>
          <span className="text-xs font-semibold uppercase tracking-widest text-primary-glow">My dashboard</span>
          <h1 className="mt-2 text-3xl md:text-4xl text-foreground">Welcome, {m.full_name.split(" ")[0]}</h1>
          <p className="text-sm text-muted-foreground mt-1">Member <span className="font-medium text-foreground">{m.member_code}</span></p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Link to="/loans" className="btn-outline"><HandCoins className="h-4 w-4" /> My loans</Link>
          <Link to="/documents" className="btn-outline"><FileText className="h-4 w-4" /> Documents</Link>
          <button onClick={downloadStatement} className="btn-outline"><Download className="h-4 w-4" /> Download statement</button>

          <button onClick={signOut} className="btn-outline"><LogOut className="h-4 w-4" /> Sign out</button>
        </div>
      </div>

      {/* Total balance banner */}
      <div className="mt-6 rounded-2xl p-6 md:p-8 text-primary-foreground" style={{ background: "var(--gradient-hero)" }}>
        <div className="text-xs uppercase tracking-widest opacity-80">Total across all categories</div>
        <div className="mt-2 text-4xl md:text-5xl font-display font-bold">{fmt(totals.grand)}</div>
        <div className="mt-1 text-sm opacity-85">Loan outstanding: {fmt(totals.loanOutstanding)}</div>
        {(() => {
          const next = (data.loans ?? [])
            .filter((l) => l.due_date && (l.status === "disbursed" || l.status === "approved"))
            .sort((a, b) => String(a.due_date).localeCompare(String(b.due_date)))[0];
          if (!next) return null;
          const overdue = new Date(String(next.due_date)) < new Date();
          return (
            <div className="mt-1 text-sm opacity-85">
              {overdue ? "Loan repayment overdue since" : "Next loan due"}: {next.due_date}
            </div>
          );
        })()}
      </div>

      {/* Category cards */}
      <div className="mt-6 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {CATEGORIES.map((c) => {
          const val = c.key === "loan_disbursement" ? totals.loanOutstanding : totals.map[c.key] ?? 0;
          return (
            <div key={c.key} className="rounded-xl bg-card border border-border p-5 shadow-[var(--shadow-soft)]">
              <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wide">
                <c.icon className={`h-4 w-4 ${c.tone}`} /> {c.label}
              </div>
              <div className="mt-2 text-xl md:text-2xl font-display font-bold text-foreground">{fmt(val)}</div>
            </div>
          );
        })}
      </div>

      {/* Month by month */}
      <div className="mt-10">
        <h2 className="text-xl font-semibold text-foreground">Month by month</h2>
        <p className="text-sm text-muted-foreground">Your contributions, fines and loan activity for each month.</p>
        <div className="mt-4 rounded-2xl bg-card border border-border overflow-hidden shadow-[var(--shadow-soft)]">
          {months.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">No monthly records yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-secondary text-secondary-foreground text-left text-xs uppercase tracking-wide">
                  <tr>
                    <th className="px-4 py-3">Month</th>
                    <th className="px-4 py-3 text-right">Contributions</th>
                    <th className="px-4 py-3 text-right">Fines &amp; dues</th>
                    <th className="px-4 py-3 text-right">Loans taken</th>
                    <th className="px-4 py-3 text-right">Loan repaid</th>
                    <th className="px-4 py-3 text-right">Entries</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {months.map((r) => (
                    <tr key={r.month} className="hover:bg-secondary/40">
                      <td className="px-4 py-3 font-medium text-foreground whitespace-nowrap">{r.label}</td>
                      <td className="px-4 py-3 text-right text-foreground">{fmt(r.contributions)}</td>
                      <td className="px-4 py-3 text-right text-destructive">{fmt(r.fines)}</td>
                      <td className="px-4 py-3 text-right text-foreground">{fmt(r.loans)}</td>
                      <td className="px-4 py-3 text-right text-foreground">{fmt(r.repayments)}</td>
                      <td className="px-4 py-3 text-right text-muted-foreground">{r.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Transactions */}
      <div className="mt-10">
        <h2 className="text-xl font-semibold text-foreground">Transaction history</h2>
        <p className="text-sm text-muted-foreground">Every record posted to your account.</p>
        <div className="mt-4 rounded-2xl bg-card border border-border overflow-hidden shadow-[var(--shadow-soft)]">
          {data.transactions.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">No transactions yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-secondary text-secondary-foreground text-left text-xs uppercase tracking-wide">
                  <tr>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Category</th>
                    <th className="px-4 py-3">Description</th>
                    <th className="px-4 py-3 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {data.transactions.map((t) => (
                    <tr key={t.id} className="hover:bg-secondary/40">
                      <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">{t.transaction_date}</td>
                      <td className="px-4 py-3 font-medium text-foreground">{CAT_LABEL[t.category] ?? t.category}</td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {t.description ?? "—"}
                        {t.source !== "manual" && (
                          <span className="ml-2 inline-block text-[10px] uppercase tracking-wide bg-accent/20 text-accent-foreground rounded px-1.5 py-0.5">
                            {t.source.replace(/_/g, " ")}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-foreground">{fmt(Number(t.amount))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
