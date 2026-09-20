import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useRequirePermission } from "@/hooks/use-permissions";
import { ROLE_LABEL, PERMISSION_LABEL, PERMISSION_MATRIX, type Permission } from "@/lib/permissions";
import { addMemberWithAccess } from "@/lib/member-accounts.functions";
import { createMemberInvite, revokeMemberInvite } from "@/lib/member-invites.functions";
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
  
  UserPlus,
  CheckCircle2,
  FileBarChart,
  Loader2,
  HandCoins,
  Settings,
  Send,
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

  const { can, allowed, loading: checking, roles } = useRequirePermission("view_admin");
  const isAdmin = allowed;

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
        <span className="text-xs text-muted-foreground">
          Admin area — separate from the member portal
        </span>
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
        {can("view_finances") && <ActionCard
          to="/admin/ledger"
          icon={<BookOpen className="h-5 w-5" />}
          title="Transaction ledger"
          description="Add, filter, or remove entries across all categories."
        />}
        {can("view_reports") && <ActionCard
          to="/admin/reports"
          icon={<FileBarChart className="h-5 w-5" />}
          title="Reports"
          description="Monthly, loans, penalties, contributions, and more."
        />}
        {can("manage_roles") && <ActionCard
          to="/admin/roles"
          icon={<ShieldCheck className="h-5 w-5" />}
          title="Role management"
          description="Assign or revoke admin permissions (super admin only)."
        />}
        {can("view_finances") && <ActionCard
          to="/admin/loans"
          icon={<HandCoins className="h-5 w-5" />}
          title="Loan approvals"
          description="Review, approve, reject, and disburse member loan requests."
        />}
        {can("view_reports") && <ActionCard
          to="/admin/schedule"
          icon={<FileBarChart className="h-5 w-5" />}
          title="Report schedule"
          description="Configure the day & time monthly PDF reports are sent to admins."
        />}
        {can("view_reports") && <ActionCard
          to="/admin/report-preview"
          icon={<FileBarChart className="h-5 w-5" />}
          title="Preview monthly PDF"
          description="See the branded monthly report exactly as admins receive it."
        />}
        {can("manage_documents") && <ActionCard
          to="/documents"
          icon={<FileBarChart className="h-5 w-5" />}
          title="Documents library"
          description="Upload minutes, policies, the constitution and other papers for members."
        />}
        {can("manage_content") && <ActionCard
          to="/admin/settings"
          icon={<Settings className="h-5 w-5" />}
          title="Control panel"
          description="Site settings, notice marquee, photo uploads, and users."
        />}
      </div>


      {/* Add member + Approve accounts */}
      {can("manage_members") && <AddMemberCard />}
      {can("manage_members") && (
        <ApproveAccountsCard members={members ?? []} unlinked={unlinked} />
      )}
      {can("invite_members") && <InviteMembersCard members={members ?? []} />}

      <MyAccessCard roles={roles} />




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

type MemberLite = { id: string; member_code: string; full_name: string; user_id: string | null; status: string };

function AddMemberCard() {
  const qc = useQueryClient();
  const addMember = useServerFn(addMemberWithAccess);
  const [open, setOpen] = useState(false);
  const [resultMessage, setResultMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [form, setForm] = useState({
    member_code: "",
    full_name: "",
    phone: "",
    email: "",
    notes: "",
    role: "member" as
      | "member"
      | "treasurer"
      | "secretary"
      | "project_manager"
      | "super_admin",
    access: "email" as "none" | "email",
  });

  const create = useMutation({
    mutationFn: async () => {
      setResultMessage(null);
      setErrorMessage(null);
      return await addMember({
        data: {
          memberCode: form.member_code.trim(),
          fullName: form.full_name.trim(),
          phone: form.phone.trim(),
          email: form.email.trim(),
          notes: form.notes.trim(),
          role: form.role,
          access: form.access,
          redirectTo:
            typeof window !== "undefined" ? `${window.location.origin}/auth` : "",
        },
      });
    },
    onSuccess: (res) => {
      let message = "Member added — pending account approval";
      if (res.email) {
        message = res.inviteToken
          ? `Member added. Activation link created for ${res.email}.`
          : `Member added for ${res.email}.`;
      }
      setResultMessage(message);
      toast.success(message);
      setForm({
        member_code: "",
        full_name: "",
        phone: "",
        email: "",
        notes: "",
        role: "member",
        access: "email",
      });
      qc.invalidateQueries({ queryKey: ["admin-members"] });
      qc.invalidateQueries({ queryKey: ["admin-approve-users"] });
      qc.invalidateQueries({ queryKey: ["users-with-roles"] });
    },
    onError: (e: Error) => {
      const message = e.message || "Could not add the member";
      setErrorMessage(message);
      toast.error(message);
    },
  });

  return (
    <section className="mt-8 rounded-2xl bg-card border border-border p-5 shadow-[var(--shadow-soft)]">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-lg font-semibold text-foreground inline-flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-primary" /> Add member
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Create the member record and optionally create a one-time activation link.
          </p>
        </div>
        <button onClick={() => setOpen((v) => !v)} className="btn-outline !py-2 !px-4 text-sm">
          {open ? "Close" : "New member"}
        </button>
      </div>
      {open && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!form.member_code.trim() || !form.full_name.trim()) {
              setErrorMessage("Member code and full name are required");
              toast.error("Member code and full name are required");
              return;
            }
            if (form.access !== "none" && !form.email.trim()) {
              setErrorMessage("An email is required to create a login");
              toast.error("An email is required to create a login");
              return;
            }
            create.mutate();
          }}
          className="mt-5 grid md:grid-cols-6 gap-3"
        >
          <input
            required
            placeholder="Member code (e.g. UYG-012)"
            value={form.member_code}
            onChange={(e) => setForm({ ...form, member_code: e.target.value })}
            className="md:col-span-2 rounded-lg border border-input bg-background px-3 py-2.5 text-sm"
          />
          <input
            required
            placeholder="Full name"
            value={form.full_name}
            onChange={(e) => setForm({ ...form, full_name: e.target.value })}
            className="md:col-span-2 rounded-lg border border-input bg-background px-3 py-2.5 text-sm"
          />
          <input
            placeholder="Phone"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            className="md:col-span-2 rounded-lg border border-input bg-background px-3 py-2.5 text-sm"
          />
          <input
            type="email"
            placeholder="Email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            className="md:col-span-3 rounded-lg border border-input bg-background px-3 py-2.5 text-sm"
          />
          <select
            value={form.role}
            onChange={(e) =>
              setForm({ ...form, role: e.target.value as typeof form.role })
            }
            className="md:col-span-3 rounded-lg border border-input bg-background px-3 py-2.5 text-sm"
          >
            {(["member", "treasurer", "secretary", "project_manager", "super_admin"] as const).map(
              (r) => (
                <option key={r} value={r}>
                  {ROLE_LABEL[r]}
                </option>
              ),
            )}
          </select>
          <input
            placeholder="Notes (optional)"
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            className="md:col-span-6 rounded-lg border border-input bg-background px-3 py-2.5 text-sm"
          />

          <label className="md:col-span-3 text-sm">
            <span className="text-xs text-muted-foreground">Sign-in access</span>
            <select
              value={form.access}
              onChange={(e) => setForm({ ...form, access: e.target.value as typeof form.access })}
              className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm"
            >
              <option value="email">Create an activation link</option>
              <option value="none">No login yet (record only)</option>
            </select>
          </label>
          {form.access === "email" && (
            <p className="md:col-span-3 text-xs text-muted-foreground md:mt-8">
              Share the generated activation link with the member. They create their own password; the admin never handles it.
            </p>
          )}

          <button
            type="submit"
            disabled={create.isPending}
            className="btn-primary md:col-span-6 disabled:opacity-60"
          >
            {create.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Add member
          </button>

          {resultMessage && (
            <div role="status" className="md:col-span-6 rounded-lg border border-primary/40 bg-primary/5 p-3 text-sm text-foreground">
              <CheckCircle2 className="mr-2 inline h-4 w-4 text-primary" />
              {resultMessage}
            </div>
          )}
          {errorMessage && (
            <div role="alert" className="md:col-span-6 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
              <AlertTriangle className="mr-2 inline h-4 w-4" />
              {errorMessage}
            </div>
          )}

          {issued && (
            <div className="md:col-span-6 rounded-lg border border-primary/40 bg-primary/5 p-4 text-sm">
              <div className="font-semibold text-foreground">Share these sign-in details securely</div>
              <div className="mt-1 font-mono text-xs break-all">
                {issued.email} · {issued.password}
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Shown once — ask them to change the password after first sign-in.
              </p>
            </div>
          )}
        </form>
      )}
    </section>
  );
}

function ApproveAccountsCard({ members, unlinked }: { members: MemberLite[]; unlinked: MemberLite[] }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const { data: users } = useQuery({
    queryKey: ["admin-approve-users"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("list_users_with_roles" as never);
      if (error) throw error;
      return (data ?? []) as { user_id: string; email: string; roles: string[] }[];
    },
    enabled: open,
  });

  const linkedUserIds = new Set(members.map((m) => m.user_id).filter(Boolean) as string[]);
  const availableUsers = (users ?? []).filter((u) => !linkedUserIds.has(u.user_id));

  const [selections, setSelections] = useState<Record<string, string>>({});

  const approve = async (memberId: string) => {
    const userId = selections[memberId];
    if (!userId) return toast.error("Pick a signed-up user to approve");
    setBusyId(memberId);
    const { error } = await supabase
      .from("members")
      .update({ user_id: userId, status: "active" })
      .eq("id", memberId);
    setBusyId(null);
    if (error) return toast.error(error.message);
    toast.success("Account approved & linked");
    setSelections((s) => {
      const n = { ...s };
      delete n[memberId];
      return n;
    });
    qc.invalidateQueries({ queryKey: ["admin-members"] });
    qc.invalidateQueries({ queryKey: ["admin-approve-users"] });
  };

  return (
    <section className="mt-4 rounded-2xl bg-card border border-border p-5 shadow-[var(--shadow-soft)]">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-lg font-semibold text-foreground inline-flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-primary" /> Approve accounts
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Link signed-up users to member records so their dashboard populates.
          </p>
        </div>
        <button onClick={() => setOpen((v) => !v)} className="btn-outline !py-2 !px-4 text-sm">
          <Link2 className="h-4 w-4" /> {open ? "Close" : `Manage (${unlinked.length})`}
        </button>
      </div>
      {open && (
        <div className="mt-5">
          {unlinked.length === 0 ? (
            <div className="text-sm text-muted-foreground">All members are approved and linked. 🎉</div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead className="bg-secondary text-left text-xs uppercase tracking-wide">
                  <tr>
                    <th className="px-3 py-2">Member</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2">Match signed-up user</th>
                    <th className="px-3 py-2 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {unlinked.map((m) => (
                    <tr key={m.id}>
                      <td className="px-3 py-2">
                        <div className="font-medium text-foreground">{m.full_name}</div>
                        <div className="text-xs text-muted-foreground">{m.member_code}</div>
                      </td>
                      <td className="px-3 py-2 text-xs">
                        <span className="inline-block rounded px-2 py-0.5 bg-accent/20 uppercase tracking-wide">
                          {m.status}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <select
                          value={selections[m.id] ?? ""}
                          onChange={(e) => setSelections({ ...selections, [m.id]: e.target.value })}
                          className="rounded-lg border border-input bg-background px-2 py-1.5 text-sm min-w-[220px]"
                        >
                          <option value="">Select user…</option>
                          {availableUsers.map((u) => (
                            <option key={u.user_id} value={u.user_id}>{u.email}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-3 py-2 text-right">
                        <button
                          disabled={busyId === m.id || !selections[m.id]}
                          onClick={() => approve(m.id)}
                          className="btn-primary !py-1.5 !px-3 text-xs disabled:opacity-50"
                        >
                          {busyId === m.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />}
                          Approve
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {availableUsers.length === 0 && unlinked.length > 0 && (
            <p className="mt-3 text-xs text-muted-foreground">
              No unlinked accounts are available. Add the member above with email activation or a temporary password.
            </p>
          )}
        </div>
      )}
    </section>
  );
}


function randomPassword(len = 12) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const bytes = new Uint32Array(len);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => chars[b % chars.length]).join("");
}

function InviteMembersCard({ members }: { members: MemberLite[] }) {
  const qc = useQueryClient();
  const create = useServerFn(createMemberInvite);
  const revoke = useServerFn(revokeMemberInvite);
  const [open, setOpen] = useState(false);
  const [fullName, setFullName] = useState("");
  const [memberCode, setMemberCode] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState("member");
  const [memberId, setMemberId] = useState("");
  const [busy, setBusy] = useState(false);
  const [lastLink, setLastLink] = useState<{ url: string; phone: string; emailSent: boolean } | null>(null);

  const { data: invites } = useQuery({
    queryKey: ["member-invites"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("member_invites")
        .select("id, full_name, email, phone, role, token, expires_at, accepted_at, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const unlinkedMembers = members.filter((m) => !m.user_id);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email && !phone) return toast.error("Add an email address or a phone number");
    setBusy(true);
    try {
      const res = await create({
        data: {
          fullName: fullName || members.find((m) => m.id === memberId)?.full_name || "",
          memberCode,
          email,
          phone,
          role: role as "member",
          memberId,
        },
      });
      const url = `${window.location.origin}/invite/${res.token}`;
      setLastLink({ url, phone, emailSent: res.emailSent });
      toast.success(
        res.emailSent ? "Invitation sent by email" : "Invite link created — share it with them",
      );
      if (res.emailWarning) toast.error(`Email not sent: ${res.emailWarning}`);
      setFullName("");
      setMemberCode("");
      setEmail("");
      setPhone("");
      setMemberId("");
      qc.invalidateQueries({ queryKey: ["member-invites"] });
      qc.invalidateQueries({ queryKey: ["admin-members"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not create invitation");
    } finally {
      setBusy(false);
    }
  };

  const cancel = async (id: string) => {
    try {
      await revoke({ data: { id } });
      toast.success("Invitation cancelled");
      qc.invalidateQueries({ queryKey: ["member-invites"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not cancel");
    }
  };

  const pending = (invites ?? []).filter((i) => !i.accepted_at);

  return (
    <section className="mt-4 rounded-2xl bg-card border border-border p-5 shadow-[var(--shadow-soft)]">
      <div className="flex justify-between items-center gap-3 flex-wrap">
        <div>
          <h2 className="text-lg font-semibold text-foreground inline-flex items-center gap-2">
            <Send className="h-5 w-5 text-primary" /> Invite members
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Invite by email or phone — they set their own password on a secure one-time link.
          </p>
        </div>
        <button onClick={() => setOpen((v) => !v)} className="btn-outline !py-2 !px-4 text-sm">
          <Send className="h-4 w-4" /> {open ? "Close" : `Invite (${pending.length} pending)`}
        </button>
      </div>

      {open && (
        <div className="mt-5 space-y-6">
          <form onSubmit={submit} className="grid gap-3 md:grid-cols-2">
            <select
              value={memberId}
              onChange={(e) => {
                setMemberId(e.target.value);
                const m = members.find((mm) => mm.id === e.target.value);
                if (m) {
                  setFullName(m.full_name);
                  setMemberCode(m.member_code);
                }
              }}
              className="rounded-lg border border-input bg-background px-3 py-2 text-sm md:col-span-2"
            >
              <option value="">New person (not yet a member record)</option>
              {unlinkedMembers.map((m) => (
                <option key={m.id} value={m.id}>
                  Existing: {m.member_code} — {m.full_name}
                </option>
              ))}
            </select>
            <input
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Full name"
              className="rounded-lg border border-input bg-background px-3 py-2 text-sm"
            />
            <input
              value={memberCode}
              onChange={(e) => setMemberCode(e.target.value)}
              placeholder="Member code (optional)"
              className="rounded-lg border border-input bg-background px-3 py-2 text-sm"
            />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email (sends the invite automatically)"
              className="rounded-lg border border-input bg-background px-3 py-2 text-sm"
            />
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Phone e.g. +254703977431 (share link via SMS/WhatsApp)"
              className="rounded-lg border border-input bg-background px-3 py-2 text-sm"
            />
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="rounded-lg border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="member">Member</option>
              <option value="treasurer">Treasurer</option>
              <option value="secretary">Secretary</option>
              <option value="project_manager">Project manager</option>
            </select>
            <button disabled={busy} type="submit" className="btn-primary text-sm disabled:opacity-60">
              {busy && <Loader2 className="h-4 w-4 animate-spin" />} Send invitation
            </button>
          </form>

          {lastLink && (
            <div className="rounded-lg border border-primary/40 bg-primary/5 p-4 text-sm">
              <div className="font-semibold text-foreground">
                {lastLink.emailSent ? "Emailed — you can also share this link" : "Share this invite link"}
              </div>
              <div className="mt-1 font-mono text-xs break-all">{lastLink.url}</div>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(lastLink.url);
                    toast.success("Link copied");
                  }}
                  className="btn-outline !py-1.5 !px-3 text-xs"
                >
                  Copy link
                </button>
                {lastLink.phone && (
                  <a
                    href={`https://wa.me/${lastLink.phone.replace(/[^0-9]/g, "")}?text=${encodeURIComponent(
                      `Karibu Unify Youth Group! Activate your member account here: ${lastLink.url}`,
                    )}`}
                    target="_blank"
                    rel="noreferrer"
                    className="btn-outline !py-1.5 !px-3 text-xs"
                  >
                    Send on WhatsApp
                  </a>
                )}
                {lastLink.phone && (
                  <a
                    href={`sms:${lastLink.phone}?&body=${encodeURIComponent(
                      `Activate your Unify Youth Group account: ${lastLink.url}`,
                    )}`}
                    className="btn-outline !py-1.5 !px-3 text-xs"
                  >
                    Send by SMS
                  </a>
                )}
              </div>
            </div>
          )}

          <div>
            <h3 className="text-sm font-semibold text-foreground">Invitations</h3>
            {(invites ?? []).length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">No invitations yet.</p>
            ) : (
              <div className="mt-2 overflow-x-auto rounded-lg border border-border">
                <table className="w-full text-sm">
                  <thead className="bg-secondary text-left text-xs uppercase tracking-wide">
                    <tr>
                      <th className="px-3 py-2">Person</th>
                      <th className="px-3 py-2">Sent to</th>
                      <th className="px-3 py-2">Role</th>
                      <th className="px-3 py-2">Status</th>
                      <th className="px-3 py-2 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {(invites ?? []).map((i) => {
                      const expired = !i.accepted_at && new Date(i.expires_at) < new Date();
                      return (
                        <tr key={i.id}>
                          <td className="px-3 py-2 font-medium text-foreground">{i.full_name}</td>
                          <td className="px-3 py-2 text-xs text-muted-foreground">
                            {i.email ?? "—"}
                            {i.phone ? <div>{i.phone}</div> : null}
                          </td>
                          <td className="px-3 py-2 text-xs uppercase tracking-wide">{i.role}</td>
                          <td className="px-3 py-2 text-xs">
                            {i.accepted_at ? (
                              <span className="text-primary">Accepted</span>
                            ) : expired ? (
                              <span className="text-destructive">Expired</span>
                            ) : (
                              <span className="text-muted-foreground">Pending</span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-right space-x-2">
                            {!i.accepted_at && (
                              <>
                                <button
                                  onClick={() => {
                                    navigator.clipboard.writeText(
                                      `${window.location.origin}/invite/${i.token}`,
                                    );
                                    toast.success("Link copied");
                                  }}
                                  className="text-xs underline text-muted-foreground"
                                >
                                  Copy link
                                </button>
                                <button
                                  onClick={() => cancel(i.id)}
                                  className="text-xs underline text-destructive"
                                >
                                  Cancel
                                </button>
                              </>
                            )}
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
      )}
    </section>
  );
}


/* ---------------- My access ---------------- */
function MyAccessCard({ roles }: { roles: string[] }) {
  const perms = (Object.keys(PERMISSION_MATRIX) as Permission[]).filter((p) =>
    (PERMISSION_MATRIX[p] as string[]).some((r) => roles.includes(r)),
  );
  return (
    <section className="mt-8 rounded-2xl bg-card border border-border p-5 shadow-[var(--shadow-soft)]">
      <h2 className="text-lg font-semibold text-foreground inline-flex items-center gap-2">
        <ShieldCheck className="h-5 w-5 text-primary" /> My access
      </h2>
      <p className="text-xs text-muted-foreground mt-0.5">
        What your role allows on this admin dashboard.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {roles.map((r) => (
          <span key={r} className="rounded-full bg-primary/10 text-primary text-xs font-semibold px-3 py-1">
            {ROLE_LABEL[r as keyof typeof ROLE_LABEL] ?? r}
          </span>
        ))}
      </div>
      <ul className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3 text-sm text-muted-foreground">
        {perms.map((p) => (
          <li key={p} className="inline-flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-primary shrink-0" /> {PERMISSION_LABEL[p]}
          </li>
        ))}
      </ul>
    </section>
  );
}
