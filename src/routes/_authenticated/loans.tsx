import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { HandCoins, ArrowLeft, Loader2, CheckCircle2, Clock, XCircle, Ban } from "lucide-react";

export const Route = createFileRoute("/_authenticated/loans")({
  head: () => ({ meta: [{ title: "My Loans — Unify Youth Group" }, { name: "robots", content: "noindex" }] }),
  component: LoansPage,
});

const fmt = (n: number) => `KSh ${Number(n).toLocaleString("en-KE", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

type LoanRequest = {
  id: string;
  member_id: string;
  amount: number;
  purpose: string;
  repayment_months: number | null;
  status: string;
  reviewer_notes: string | null;
  created_at: string;
  reviewed_at: string | null;
  disbursed_at: string | null;
  due_date: string | null;
};

const STATUS_META: Record<string, { label: string; className: string; icon: React.ReactNode }> = {
  pending: { label: "Pending review", className: "bg-accent/20 text-accent-foreground", icon: <Clock className="h-3 w-3" /> },
  approved: { label: "Approved", className: "bg-primary/15 text-primary", icon: <CheckCircle2 className="h-3 w-3" /> },
  disbursed: { label: "Disbursed", className: "bg-primary text-primary-foreground", icon: <CheckCircle2 className="h-3 w-3" /> },
  rejected: { label: "Rejected", className: "bg-destructive/15 text-destructive", icon: <XCircle className="h-3 w-3" /> },
  cancelled: { label: "Cancelled", className: "bg-muted text-muted-foreground", icon: <Ban className="h-3 w-3" /> },
};

function LoansPage() {
  const qc = useQueryClient();
  const [form, setForm] = useState({ amount: "", purpose: "", months: "" });

  const { data: member, isLoading: memberLoading, error: memberError } = useQuery({
    queryKey: ["my-member"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return null;
      const { data, error } = await supabase.from("members").select("id, full_name, member_code").eq("user_id", u.user.id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: requests, isLoading } = useQuery({
    queryKey: ["my-loan-requests", member?.id],
    enabled: !!member?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("loan_requests")
        .select("*")
        .eq("member_id", member?.id ?? "")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as LoanRequest[];
    },
  });

  const submit = useMutation({
    mutationFn: async () => {
      if (!member) throw new Error("Your account isn't linked to a member yet");
      const amt = Number(form.amount);
      if (!amt || amt <= 0) throw new Error("Enter a valid amount");
      if (!form.purpose.trim()) throw new Error("Purpose is required");
      const { error } = await supabase.from("loan_requests").insert({
        member_id: member.id,
        amount: amt,
        purpose: form.purpose.trim(),
        repayment_months: form.months ? Number(form.months) : null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Loan request submitted for review");
      setForm({ amount: "", purpose: "", months: "" });
      qc.invalidateQueries({ queryKey: ["my-loan-requests"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const cancel = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("loan_requests").update({ status: "cancelled" }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Request cancelled");
      qc.invalidateQueries({ queryKey: ["my-loan-requests"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (memberLoading) {
    return <div className="container-page py-16 text-center text-muted-foreground">Loading your loans…</div>;
  }

  if (memberError) {
    return <div className="container-page py-16 text-center text-destructive">We couldn’t load your member account. Please try again.</div>;
  }

  if (!member) {
    return (
      <div className="container-page py-16 text-center text-muted-foreground">
        Your account isn't linked to a member profile yet. Please contact an admin.
      </div>
    );
  }

  return (
    <div className="container-page py-10">
      <div className="flex flex-wrap justify-between items-center gap-3">
        <div>
          <div className="flex items-center gap-2 text-xs text-primary-glow font-semibold uppercase tracking-widest">
            <HandCoins className="h-4 w-4" /> Loans
          </div>
          <h1 className="mt-1 text-3xl md:text-4xl text-foreground">My loan requests</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Submit a request. A treasurer or super admin reviews before disbursement.
          </p>
        </div>
        <Link to="/dashboard" className="btn-outline"><ArrowLeft className="h-4 w-4" /> Dashboard</Link>
      </div>

      <section className="mt-8 rounded-2xl bg-card border border-border p-5 shadow-[var(--shadow-soft)]">
        <h2 className="text-lg font-semibold text-foreground">New request</h2>
        <form
          onSubmit={(e) => { e.preventDefault(); submit.mutate(); }}
          className="mt-4 grid md:grid-cols-6 gap-3"
        >
          <input
            required
            type="number"
            min="1"
            step="1"
            placeholder="Amount (KSh)"
            value={form.amount}
            onChange={(e) => setForm({ ...form, amount: e.target.value })}
            className="md:col-span-2 rounded-lg border border-input bg-background px-3 py-2.5 text-sm"
          />
          <input
            type="number"
            min="1"
            max="60"
            placeholder="Repayment months (optional)"
            value={form.months}
            onChange={(e) => setForm({ ...form, months: e.target.value })}
            className="md:col-span-2 rounded-lg border border-input bg-background px-3 py-2.5 text-sm"
          />
          <input
            required
            placeholder="Purpose"
            value={form.purpose}
            onChange={(e) => setForm({ ...form, purpose: e.target.value })}
            className="md:col-span-6 rounded-lg border border-input bg-background px-3 py-2.5 text-sm"
          />
          <button type="submit" disabled={submit.isPending} className="btn-primary md:col-span-6 disabled:opacity-60">
            {submit.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Submit request
          </button>
        </form>
      </section>

      <section className="mt-6 rounded-2xl bg-card border border-border overflow-hidden shadow-[var(--shadow-soft)]">
        <div className="px-5 py-4 border-b border-border">
          <h2 className="text-lg font-semibold text-foreground">History</h2>
        </div>
        {isLoading ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Loading…</div>
        ) : !requests || requests.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">No loan requests yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-secondary text-left text-xs uppercase tracking-wide">
                <tr>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Amount</th>
                  <th className="px-4 py-3">Purpose</th>
                  <th className="px-4 py-3">Months</th>
                  <th className="px-4 py-3">Due date</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Notes</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {requests.map((r) => {
                  const meta = STATUS_META[r.status] ?? STATUS_META.pending;
                  return (
                    <tr key={r.id} className="hover:bg-secondary/40">
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{r.created_at.slice(0, 10)}</td>
                      <td className="px-4 py-3 font-semibold">{fmt(Number(r.amount))}</td>
                      <td className="px-4 py-3">{r.purpose}</td>
                      <td className="px-4 py-3 text-muted-foreground">{r.repayment_months ?? "—"}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {r.due_date ? (
                          <span className={new Date(r.due_date) < new Date() && r.status === "disbursed" ? "text-destructive font-medium" : "text-muted-foreground"}>
                            {r.due_date}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-[11px] uppercase tracking-wide ${meta.className}`}>
                          {meta.icon}{meta.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground max-w-[220px]">{r.reviewer_notes ?? "—"}</td>
                      <td className="px-4 py-3 text-right">
                        {r.status === "pending" && (
                          <button
                            onClick={() => cancel.mutate(r.id)}
                            className="text-xs text-destructive hover:underline"
                          >
                            Cancel
                          </button>
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
