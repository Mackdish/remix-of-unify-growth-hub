import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { HandCoins, ShieldCheck, ArrowLeft, CheckCircle2, XCircle, Wallet, Loader2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/loans")({
  head: () => ({ meta: [{ title: "Loan Approvals — Unify Youth Group" }, { name: "robots", content: "noindex" }] }),
  component: AdminLoans,
});

const fmt = (n: number) => `KSh ${Number(n).toLocaleString("en-KE", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

type LoanRequest = {
  id: string;
  member_id: string;
  amount: number;
  purpose: string;
  repayment_months: number | null;
  status: "pending" | "approved" | "rejected" | "disbursed" | "cancelled";
  reviewer_notes: string | null;
  created_at: string;
  reviewed_at: string | null;
  disbursed_at: string | null;
  disbursed_transaction_id: string | null;
  due_date: string | null;
};

const TABS: { key: LoanRequest["status"] | "all"; label: string }[] = [
  { key: "pending", label: "Pending" },
  { key: "approved", label: "Approved" },
  { key: "disbursed", label: "Disbursed" },
  { key: "rejected", label: "Rejected" },
  { key: "cancelled", label: "Cancelled" },
  { key: "all", label: "All" },
];

function AdminLoans() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("pending");
  const [notes, setNotes] = useState<Record<string, string>>({});

  const { data: isAdmin, isLoading: checking } = useQuery({
    queryKey: ["is-admin"],
    queryFn: async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) return false;
      const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", data.user.id);
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
    queryKey: ["admin-loan-members"],
    queryFn: async () => {
      const { data, error } = await supabase.from("members").select("id, member_code, full_name").order("member_code");
      if (error) throw error;
      return data;
    },
    enabled: !!isAdmin,
  });

  const { data: requests } = useQuery({
    queryKey: ["admin-loan-requests"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("loan_requests")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as LoanRequest[];
    },
    enabled: !!isAdmin,
  });

  const memberMap = useMemo(
    () => Object.fromEntries((members ?? []).map((m) => [m.id, m])),
    [members],
  );

  const visible = (requests ?? []).filter((r) => tab === "all" || r.status === tab);

  const review = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "approved" | "rejected" }) => {
      const { data: u } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("loan_requests")
        .update({
          status,
          reviewer_id: u.user?.id,
          reviewer_notes: notes[id] ?? null,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      toast.success(v.status === "approved" ? "Approved — ready to disburse" : "Rejected");
      qc.invalidateQueries({ queryKey: ["admin-loan-requests"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const disburse = useMutation({
    mutationFn: async (r: LoanRequest) => {
      const { data: u } = await supabase.auth.getUser();
      const { data: txn, error: txnErr } = await supabase
        .from("transactions")
        .insert({
          member_id: r.member_id,
          category: "loan_disbursement",
          amount: r.amount,
          transaction_date: new Date().toISOString().slice(0, 10),
          description: `Loan disbursement — ${r.purpose}`,
          reference: `loan_req:${r.id}`,
          source: "loan_workflow",
          created_by: u.user?.id,
        })
        .select("id")
        .single();
      if (txnErr) throw txnErr;
      const due = new Date();
      due.setMonth(due.getMonth() + (r.repayment_months ?? 3));
      const { error } = await supabase
        .from("loan_requests")
        .update({
          status: "disbursed",
          disbursed_at: new Date().toISOString(),
          disbursed_transaction_id: txn.id,
          due_date: due.toISOString().slice(0, 10),
        })
        .eq("id", r.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Loan disbursed and posted to ledger");
      qc.invalidateQueries({ queryKey: ["admin-loan-requests"] });
      qc.invalidateQueries({ queryKey: ["admin-txns"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (checking || !isAdmin) {
    return <div className="container-page py-24 text-center text-muted-foreground">Checking access…</div>;
  }

  const counts = (requests ?? []).reduce<Record<string, number>>((acc, r) => {
    acc[r.status] = (acc[r.status] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="container-page py-10">
      <div className="flex flex-wrap justify-between items-center gap-3">
        <div>
          <div className="flex items-center gap-2 text-xs text-primary-glow font-semibold uppercase tracking-widest">
            <ShieldCheck className="h-4 w-4" /> Admin
          </div>
          <h1 className="mt-1 text-3xl md:text-4xl text-foreground inline-flex items-center gap-2">
            <HandCoins className="h-7 w-7 text-primary" /> Loan approvals
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Review member requests. Approving records a decision; disbursing posts a loan entry to the ledger.
          </p>
        </div>
        <Link to="/admin" className="btn-outline"><ArrowLeft className="h-4 w-4" /> Admin dashboard</Link>
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`rounded-lg px-3 py-1.5 text-sm border transition-colors ${
              tab === t.key ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border hover:border-primary/40"
            }`}
          >
            {t.label}
            {t.key !== "all" && counts[t.key] ? <span className="ml-1.5 opacity-70">({counts[t.key]})</span> : null}
          </button>
        ))}
      </div>

      <section className="mt-6 rounded-2xl bg-card border border-border overflow-hidden shadow-[var(--shadow-soft)]">
        {visible.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground">No requests in this state.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-secondary text-left text-xs uppercase tracking-wide">
                <tr>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Member</th>
                  <th className="px-4 py-3">Amount</th>
                  <th className="px-4 py-3">Purpose</th>
                  <th className="px-4 py-3">Months</th>
                  <th className="px-4 py-3">Due date</th>
                  <th className="px-4 py-3">Status / Notes</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {visible.map((r) => {
                  const m = memberMap[r.member_id];
                  return (
                    <tr key={r.id} className="hover:bg-secondary/40 align-top">
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{r.created_at.slice(0, 10)}</td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-foreground">{m?.full_name ?? "—"}</div>
                        <div className="text-xs text-muted-foreground">{m?.member_code}</div>
                      </td>
                      <td className="px-4 py-3 font-semibold whitespace-nowrap">{fmt(Number(r.amount))}</td>
                      <td className="px-4 py-3 max-w-[240px]">{r.purpose}</td>
                      <td className="px-4 py-3 text-muted-foreground">{r.repayment_months ?? "—"}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">{r.due_date ?? "—"}</td>
                      <td className="px-4 py-3 text-xs">
                        <div className="uppercase tracking-wide text-muted-foreground">{r.status}</div>
                        {r.status === "pending" ? (
                          <textarea
                            placeholder="Optional notes for member"
                            value={notes[r.id] ?? ""}
                            onChange={(e) => setNotes({ ...notes, [r.id]: e.target.value })}
                            className="mt-1 w-full min-w-[200px] rounded border border-input bg-background px-2 py-1 text-xs"
                            rows={2}
                          />
                        ) : (
                          <div className="mt-1 text-muted-foreground max-w-[220px]">{r.reviewer_notes ?? "—"}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right space-y-1">
                        {r.status === "pending" && (
                          <div className="flex gap-1 justify-end">
                            <button
                              disabled={review.isPending}
                              onClick={() => review.mutate({ id: r.id, status: "approved" })}
                              className="btn-primary !py-1.5 !px-2.5 text-xs"
                            >
                              <CheckCircle2 className="h-3 w-3" /> Approve
                            </button>
                            <button
                              disabled={review.isPending}
                              onClick={() => review.mutate({ id: r.id, status: "rejected" })}
                              className="rounded-lg border border-destructive/40 text-destructive px-2.5 py-1.5 text-xs hover:bg-destructive/10"
                            >
                              <XCircle className="h-3 w-3 inline" /> Reject
                            </button>
                          </div>
                        )}
                        {r.status === "approved" && (
                          <button
                            disabled={disburse.isPending}
                            onClick={() => disburse.mutate(r)}
                            className="btn-primary !py-1.5 !px-2.5 text-xs"
                          >
                            {disburse.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Wallet className="h-3 w-3" />}
                            Disburse
                          </button>
                        )}
                        {r.status === "disbursed" && (
                          <span className="text-xs text-primary inline-flex items-center gap-1">
                            <CheckCircle2 className="h-3 w-3" /> Posted
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
