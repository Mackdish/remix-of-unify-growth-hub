import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, ShieldCheck, ArrowLeft, Search, Link2, Trash2, Loader2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/ledger")({
  head: () => ({ meta: [{ title: "Admin Ledger — Unify Youth Group" }, { name: "robots", content: "noindex" }] }),
  component: AdminLedger,
});

const CATEGORIES = [
  { key: "monthly_contribution", label: "Monthly contribution" },
  { key: "account_boosting", label: "Account boosting" },
  { key: "fine", label: "Fine" },
  { key: "loan_disbursement", label: "Loan disbursement" },
  { key: "loan_repayment", label: "Loan repayment" },
  { key: "shirts_loan", label: "Shirts loan" },
  { key: "interest", label: "Interest" },
  { key: "due", label: "Due" },
  { key: "penalty", label: "Penalty" },
  { key: "other", label: "Other" },
] as const;
const CAT_LABEL: Record<string, string> = Object.fromEntries(CATEGORIES.map((c) => [c.key, c.label]));

const fmt = (n: number) => `KSh ${Number(n).toLocaleString("en-KE", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

function AdminLedger() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [filter, setFilter] = useState("");
  const [category, setCategory] = useState<string>("all");
  const [memberId, setMemberId] = useState<string>("all");

  // Guard: only admins allowed
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
    queryKey: ["members-all"],
    queryFn: async () => {
      const { data, error } = await supabase.from("members").select("id, member_code, full_name, user_id, phone").order("member_code");
      if (error) throw error;
      return data;
    },
    enabled: !!isAdmin,
  });

  const { data: txns, isLoading: txnsLoading } = useQuery({
    queryKey: ["txns-all", category, memberId],
    queryFn: async () => {
      let q = supabase.from("transactions")
        .select("id, member_id, category, amount, transaction_date, description, reference, source")
        .order("transaction_date", { ascending: false }).limit(500);
      if (category !== "all") q = q.eq("category", category as any);
      if (memberId !== "all") q = q.eq("member_id", memberId);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
    enabled: !!isAdmin,
  });

  const memberMap = useMemo(
    () => Object.fromEntries((members ?? []).map((m) => [m.id, m])),
    [members],
  );

  const filtered = useMemo(() => {
    const f = filter.toLowerCase().trim();
    if (!f) return txns ?? [];
    return (txns ?? []).filter((t) => {
      const m = memberMap[t.member_id];
      return (
        m?.full_name.toLowerCase().includes(f) ||
        m?.member_code.toLowerCase().includes(f) ||
        (t.description ?? "").toLowerCase().includes(f) ||
        (t.reference ?? "").toLowerCase().includes(f)
      );
    });
  }, [txns, filter, memberMap]);

  const totals = useMemo(() => {
    const map: Record<string, number> = {};
    (txns ?? []).forEach((t) => {
      map[t.category] = (map[t.category] ?? 0) + Number(t.amount);
    });
    return map;
  }, [txns]);

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("transactions").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Transaction deleted");
      qc.invalidateQueries({ queryKey: ["txns-all"] });
      qc.invalidateQueries({ queryKey: ["my-financial-summary"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (checking || !isAdmin) {
    return <div className="container-page py-24 text-center text-muted-foreground">Checking access…</div>;
  }

  return (
    <div className="container-page py-10">
      <div className="flex flex-wrap justify-between items-center gap-3">
        <div>
          <div className="flex items-center gap-2 text-xs text-primary-glow font-semibold uppercase tracking-widest">
            <ShieldCheck className="h-4 w-4" /> Admin
          </div>
          <h1 className="mt-1 text-3xl md:text-4xl text-foreground">Transaction ledger</h1>
          <p className="text-sm text-muted-foreground mt-1">Group-wide financial ledger. Add, edit, or remove entries.</p>
        </div>
        <Link to="/dashboard" className="btn-outline"><ArrowLeft className="h-4 w-4" /> My dashboard</Link>
      </div>

      {/* Category totals */}
      <div className="mt-6 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
        {CATEGORIES.map((c) => (
          <div key={c.key} className="rounded-lg bg-card border border-border p-3 shadow-[var(--shadow-soft)]">
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{c.label}</div>
            <div className="mt-1 text-base font-semibold text-foreground">{fmt(totals[c.key] ?? 0)}</div>
          </div>
        ))}
      </div>

      {/* Add transaction form */}
      <AddTransactionForm members={members ?? []} onSaved={() => qc.invalidateQueries({ queryKey: ["txns-all"] })} />

      {/* Member linking */}
      <MembersLinkPanel members={members ?? []} onChanged={() => qc.invalidateQueries({ queryKey: ["members-all"] })} />

      {/* Filters */}
      <div className="mt-8 flex flex-wrap gap-3 items-end">
        <div className="flex-1 min-w-[220px]">
          <label className="text-xs text-muted-foreground">Search</label>
          <div className="relative mt-1">
            <Search className="h-4 w-4 absolute left-3 top-3 text-muted-foreground" />
            <input
              value={filter} onChange={(e) => setFilter(e.target.value)}
              className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-input bg-background text-sm"
              placeholder="Member, description, reference…"
            />
          </div>
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Category</label>
          <select value={category} onChange={(e) => setCategory(e.target.value)} className="mt-1 rounded-lg border border-input bg-background px-3 py-2.5 text-sm">
            <option value="all">All</option>
            {CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Member</label>
          <select value={memberId} onChange={(e) => setMemberId(e.target.value)} className="mt-1 rounded-lg border border-input bg-background px-3 py-2.5 text-sm">
            <option value="all">All</option>
            {(members ?? []).map((m) => <option key={m.id} value={m.id}>{m.member_code} — {m.full_name}</option>)}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="mt-4 rounded-2xl bg-card border border-border overflow-hidden shadow-[var(--shadow-soft)]">
        {txnsLoading ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">No transactions found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-secondary text-left text-xs uppercase tracking-wide">
                <tr>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Member</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">Description</th>
                  <th className="px-4 py-3 text-right">Amount</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((t) => {
                  const m = memberMap[t.member_id];
                  return (
                    <tr key={t.id} className="hover:bg-secondary/40">
                      <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">{t.transaction_date}</td>
                      <td className="px-4 py-3 font-medium text-foreground">{m ? `${m.member_code} — ${m.full_name}` : "—"}</td>
                      <td className="px-4 py-3 text-muted-foreground">{CAT_LABEL[t.category] ?? t.category}</td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {t.description ?? "—"}
                        {t.source !== "manual" && <span className="ml-2 inline-block text-[10px] uppercase bg-accent/20 rounded px-1.5 py-0.5">{t.source.replace(/_/g, " ")}</span>}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold">{fmt(Number(t.amount))}</td>
                      <td className="px-4 py-3 text-right">
                        <button
                          disabled={del.isPending}
                          onClick={() => { if (confirm("Delete this transaction?")) del.mutate(t.id); }}
                          className="text-destructive hover:opacity-80"
                        ><Trash2 className="h-4 w-4" /></button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function AddTransactionForm({ members, onSaved }: { members: any[]; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    member_id: "",
    category: "monthly_contribution",
    amount: "",
    transaction_date: new Date().toISOString().slice(0, 10),
    description: "",
    reference: "",
  });
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.member_id) return toast.error("Select a member");
    const amt = Number(form.amount);
    if (!amt || amt <= 0) return toast.error("Enter a valid amount");
    setBusy(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const { error } = await supabase.from("transactions").insert({
        member_id: form.member_id,
        category: form.category as any,
        amount: amt,
        transaction_date: form.transaction_date,
        description: form.description || null,
        reference: form.reference || null,
        source: "manual",
        created_by: userData.user?.id ?? null,
      });
      if (error) throw error;
      toast.success("Transaction added");
      setForm({ ...form, amount: "", description: "", reference: "" });
      onSaved();
      setOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-8 rounded-2xl bg-card border border-border p-5 shadow-[var(--shadow-soft)]">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold text-foreground">Add transaction</h2>
        <button onClick={() => setOpen((v) => !v)} className="btn-primary !py-2 !px-4 text-sm">
          <Plus className="h-4 w-4" /> {open ? "Close" : "New entry"}
        </button>
      </div>
      {open && (
        <form onSubmit={submit} className="mt-5 grid md:grid-cols-6 gap-3">
          <select required value={form.member_id} onChange={(e) => setForm({ ...form, member_id: e.target.value })} className="md:col-span-2 rounded-lg border border-input bg-background px-3 py-2.5 text-sm">
            <option value="">Select member…</option>
            {members.map((m) => <option key={m.id} value={m.id}>{m.member_code} — {m.full_name}</option>)}
          </select>
          <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="rounded-lg border border-input bg-background px-3 py-2.5 text-sm">
            {CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
          </select>
          <input required type="number" min="0" step="0.01" placeholder="Amount (KSh)" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className="rounded-lg border border-input bg-background px-3 py-2.5 text-sm" />
          <input required type="date" value={form.transaction_date} onChange={(e) => setForm({ ...form, transaction_date: e.target.value })} className="rounded-lg border border-input bg-background px-3 py-2.5 text-sm" />
          <input placeholder="Reference (optional)" value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} className="rounded-lg border border-input bg-background px-3 py-2.5 text-sm" />
          <input placeholder="Description (optional)" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="md:col-span-5 rounded-lg border border-input bg-background px-3 py-2.5 text-sm" />
          <button disabled={busy} type="submit" className="btn-primary md:col-span-1 disabled:opacity-60">
            {busy && <Loader2 className="h-4 w-4 animate-spin" />} Save
          </button>
        </form>
      )}
    </div>
  );
}

function MembersLinkPanel({ members, onChanged }: { members: any[]; onChanged: () => void }) {
  const [open, setOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState("");
  const [linkUserId, setLinkUserId] = useState("");
  const [busy, setBusy] = useState(false);

  const link = async () => {
    if (!selectedMember || !linkUserId) return toast.error("Select member and paste a user ID");
    setBusy(true);
    const { error } = await supabase.from("members").update({ user_id: linkUserId }).eq("id", selectedMember);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Member linked to account");
    setLinkUserId(""); setSelectedMember("");
    onChanged();
  };

  return (
    <div className="mt-4 rounded-2xl bg-card border border-border p-5 shadow-[var(--shadow-soft)]">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Members ({members.length})</h2>
          <p className="text-xs text-muted-foreground">Link a member record to a user login so they can view their dashboard.</p>
        </div>
        <button onClick={() => setOpen((v) => !v)} className="btn-outline !py-2 !px-4 text-sm">
          <Link2 className="h-4 w-4" /> {open ? "Close" : "Manage"}
        </button>
      </div>
      {open && (
        <div className="mt-4 space-y-4">
          <div className="rounded-lg border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-secondary text-left text-xs uppercase tracking-wide">
                <tr><th className="px-3 py-2">Code</th><th className="px-3 py-2">Name</th><th className="px-3 py-2">Linked user</th></tr>
              </thead>
              <tbody className="divide-y divide-border">
                {members.map((m) => (
                  <tr key={m.id}>
                    <td className="px-3 py-2 font-medium">{m.member_code}</td>
                    <td className="px-3 py-2">{m.full_name}</td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">{m.user_id ?? <span className="text-destructive">not linked</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="grid md:grid-cols-3 gap-3">
            <select value={selectedMember} onChange={(e) => setSelectedMember(e.target.value)} className="rounded-lg border border-input bg-background px-3 py-2.5 text-sm">
              <option value="">Select member…</option>
              {members.map((m) => <option key={m.id} value={m.id}>{m.member_code} — {m.full_name}</option>)}
            </select>
            <input placeholder="Paste user auth ID" value={linkUserId} onChange={(e) => setLinkUserId(e.target.value)} className="rounded-lg border border-input bg-background px-3 py-2.5 text-sm font-mono" />
            <button disabled={busy} onClick={link} className="btn-primary disabled:opacity-60">
              {busy && <Loader2 className="h-4 w-4 animate-spin" />} Link account
            </button>
          </div>
          <p className="text-xs text-muted-foreground">Tip: the user's auth ID appears on their dashboard "account not linked" screen — ask them for it, or find it in the Cloud Users panel.</p>
        </div>
      )}
    </div>
  );
}
