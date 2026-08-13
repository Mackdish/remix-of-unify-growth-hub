import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ShieldCheck, ArrowLeft, Trash2, Plus, Search, UserCog, Mail, X } from "lucide-react";
import { inviteAdmin, revokeInvite } from "@/lib/invites.functions";

export const Route = createFileRoute("/_authenticated/admin/roles")({
  head: () => ({
    meta: [
      { title: "Role management — Unify Youth Group" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: RolesPage,
});

type AppRole = "super_admin" | "treasurer" | "secretary" | "project_manager" | "member";

const ALL_ROLES: AppRole[] = [
  "super_admin",
  "treasurer",
  "secretary",
  "project_manager",
  "member",
];

const ROLE_LABEL: Record<AppRole, string> = {
  super_admin: "Super admin",
  treasurer: "Treasurer",
  secretary: "Secretary",
  project_manager: "Project manager",
  member: "Member",
};

const ROLE_DESC: Record<AppRole, string> = {
  super_admin: "Full access — manage roles, members, and ledger",
  treasurer: "Manage transactions and financial records",
  secretary: "Manage members and records",
  project_manager: "Manage projects and events",
  member: "Standard member — view own dashboard only",
};

const ADMIN_ROLES: AppRole[] = ["super_admin", "treasurer", "secretary", "project_manager"];

function RolesPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [selectedUser, setSelectedUser] = useState<string>("");
  const [selectedRole, setSelectedRole] = useState<AppRole>("treasurer");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<AppRole>("treasurer");
  const inviteFn = useServerFn(inviteAdmin);
  const revokeInviteFn = useServerFn(revokeInvite);

  const perms = useRequirePermission("manage_roles");
  const checking = perms.loading;
  const me = { userId: perms.userId, isSuper: perms.allowed };

  const { data: users, isLoading: usersLoading } = useQuery({
    queryKey: ["users-with-roles"],
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.rpc as any)("list_users_with_roles");
      if (error) throw error;
      return (data ?? []) as Array<{ user_id: string; email: string; roles: string[] }>;
    },
    enabled: !!me?.isSuper,
  });


  const assign = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: AppRole }) => {
      const { error } = await supabase.from("user_roles").insert({ user_id: userId, role });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Role assigned");
      qc.invalidateQueries({ queryKey: ["users-with-roles"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const revoke = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: AppRole }) => {
      const { error } = await supabase
        .from("user_roles")
        .delete()
        .eq("user_id", userId)
        .eq("role", role);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Role revoked");
      qc.invalidateQueries({ queryKey: ["users-with-roles"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const { data: invites } = useQuery({
    queryKey: ["pending-invites"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pending_invites")
        .select("id, email, role, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!me?.isSuper,
  });

  const invite = useMutation({
    mutationFn: async ({ email, role }: { email: string; role: AppRole }) => {
      return await inviteFn({ data: { email, role } });
    },
    onSuccess: (res: { ok: boolean; warning?: string }) => {
      if (res.warning) {
        toast.warning(`Invite saved. ${res.warning}`);
      } else {
        toast.success("Invite sent");
      }
      setInviteEmail("");
      qc.invalidateQueries({ queryKey: ["pending-invites"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const cancelInvite = useMutation({
    mutationFn: async (id: string) => await revokeInviteFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Invite canceled");
      qc.invalidateQueries({ queryKey: ["pending-invites"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users ?? [];
    return (users ?? []).filter((u) => u.email?.toLowerCase().includes(q));
  }, [users, search]);

  if (checking || !me?.isSuper) {
    return (
      <div className="container-page py-24 text-center text-muted-foreground">
        Checking access…
      </div>
    );
  }

  return (
    <div className="container-page py-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-xs text-primary-glow font-semibold uppercase tracking-widest">
            <ShieldCheck className="h-4 w-4" /> Super admin
          </div>
          <h1 className="mt-1 text-3xl md:text-4xl text-foreground">Role management</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Assign or revoke administrative permissions across the group.
          </p>
        </div>
        <Link to="/admin" className="btn-outline">
          <ArrowLeft className="h-4 w-4" /> Admin
        </Link>
      </div>

      {/* Role reference */}
      <section className="mt-6 rounded-2xl bg-card border border-border p-5 shadow-[var(--shadow-soft)]">
        <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <UserCog className="h-4 w-4 text-primary" /> Roles &amp; permissions
        </h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {ALL_ROLES.map((r) => (
            <div key={r} className="rounded-lg border border-border p-3">
              <div className="flex items-center gap-2">
                <span
                  className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${
                    ADMIN_ROLES.includes(r)
                      ? "bg-primary/15 text-primary"
                      : "bg-secondary text-muted-foreground"
                  }`}
                >
                  {ROLE_LABEL[r]}
                </span>
              </div>
              <p className="mt-1.5 text-xs text-muted-foreground">{ROLE_DESC[r]}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Assign form */}
      <section className="mt-6 rounded-2xl bg-card border border-border p-5 shadow-[var(--shadow-soft)]">
        <h2 className="text-sm font-semibold text-foreground">Assign role</h2>
        <form
          className="mt-3 grid gap-3 md:grid-cols-[1fr_220px_auto]"
          onSubmit={(e) => {
            e.preventDefault();
            if (!selectedUser) return toast.error("Pick a user");
            assign.mutate({ userId: selectedUser, role: selectedRole });
          }}
        >
          <select
            className="rounded-lg border border-input bg-background px-3 py-2.5 text-sm"
            value={selectedUser}
            onChange={(e) => setSelectedUser(e.target.value)}
          >
            <option value="">Select user…</option>
            {(users ?? []).map((u) => (
              <option key={u.user_id} value={u.user_id}>
                {u.email}
              </option>
            ))}
          </select>
          <select
            className="rounded-lg border border-input bg-background px-3 py-2.5 text-sm"
            value={selectedRole}
            onChange={(e) => setSelectedRole(e.target.value as AppRole)}
          >
            {ALL_ROLES.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABEL[r]}
              </option>
            ))}
          </select>
          <button className="btn-primary" type="submit" disabled={assign.isPending}>
            <Plus className="h-4 w-4" /> Assign
          </button>
        </form>
      </section>

      {/* Invite admin */}
      <section className="mt-6 rounded-2xl bg-card border border-border p-5 shadow-[var(--shadow-soft)]">
        <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Mail className="h-4 w-4 text-primary" /> Invite admin by email
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Sends a signup link and pre-authorizes the role. When they sign up, the
          role is applied automatically.
        </p>
        <form
          className="mt-3 grid gap-3 md:grid-cols-[1fr_220px_auto]"
          onSubmit={(e) => {
            e.preventDefault();
            const email = inviteEmail.trim();
            if (!email) return toast.error("Enter an email");
            invite.mutate({ email, role: inviteRole });
          }}
        >
          <input
            type="email"
            required
            placeholder="new-admin@example.com"
            className="rounded-lg border border-input bg-background px-3 py-2.5 text-sm"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
          />
          <select
            className="rounded-lg border border-input bg-background px-3 py-2.5 text-sm"
            value={inviteRole}
            onChange={(e) => setInviteRole(e.target.value as AppRole)}
          >
            {ALL_ROLES.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABEL[r]}
              </option>
            ))}
          </select>
          <button className="btn-primary" type="submit" disabled={invite.isPending}>
            <Mail className="h-4 w-4" /> {invite.isPending ? "Sending…" : "Send invite"}
          </button>
        </form>

        {(invites?.length ?? 0) > 0 && (
          <div className="mt-5">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
              Pending invites ({invites!.length})
            </div>
            <ul className="divide-y divide-border rounded-lg border border-border">
              {invites!.map((inv) => (
                <li key={inv.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-foreground truncate">{inv.email}</div>
                    <div className="text-xs text-muted-foreground">
                      {ROLE_LABEL[inv.role as AppRole] ?? inv.role} · invited{" "}
                      {new Date(inv.created_at).toLocaleDateString()}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="text-xs text-muted-foreground hover:text-destructive inline-flex items-center gap-1"
                    disabled={cancelInvite.isPending}
                    onClick={() => {
                      if (confirm(`Cancel invite for ${inv.email}?`)) {
                        cancelInvite.mutate(inv.id);
                      }
                    }}
                  >
                    <X className="h-3 w-3" /> Cancel
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>


      {/* Users table */}
      <section className="mt-6 rounded-2xl bg-card border border-border overflow-hidden shadow-[var(--shadow-soft)]">
        <div className="px-5 py-4 border-b border-border flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-foreground">
            Users &amp; roles
            <span className="ml-2 text-sm font-normal text-muted-foreground">
              ({filtered.length})
            </span>
          </h2>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              className="pl-8 pr-3 py-2 rounded-lg border border-input bg-background text-sm"
              placeholder="Search by email…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {usersLoading ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Loading users…</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            No users match your search.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-secondary text-left text-xs uppercase tracking-wide">
                <tr>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Roles</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((u) => {
                  const isSelf = u.user_id === me?.userId;
                  return (
                    <tr key={u.user_id} className="hover:bg-secondary/40 align-top">
                      <td className="px-4 py-3 font-medium text-foreground">
                        {u.email}
                        {isSelf && (
                          <span className="ml-2 text-[10px] uppercase tracking-wide text-primary">
                            you
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {u.roles.length === 0 ? (
                          <span className="text-xs text-muted-foreground">No roles</span>
                        ) : (
                          <div className="flex flex-wrap gap-1.5">
                            {u.roles.map((r) => (
                              <span
                                key={r}
                                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                                  ADMIN_ROLES.includes(r as AppRole)
                                    ? "bg-primary/15 text-primary"
                                    : "bg-secondary text-muted-foreground"
                                }`}
                              >
                                {ROLE_LABEL[r as AppRole] ?? r}
                                <button
                                  type="button"
                                  className="hover:text-destructive disabled:opacity-40"
                                  disabled={
                                    revoke.isPending ||
                                    (isSelf && r === "super_admin")
                                  }
                                  title={
                                    isSelf && r === "super_admin"
                                      ? "You cannot revoke your own super admin role"
                                      : "Revoke"
                                  }
                                  onClick={() => {
                                    if (
                                      confirm(
                                        `Revoke "${ROLE_LABEL[r as AppRole] ?? r}" from ${u.email}?`,
                                      )
                                    ) {
                                      revoke.mutate({
                                        userId: u.user_id,
                                        role: r as AppRole,
                                      });
                                    }
                                  }}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </button>
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          className="text-xs text-primary hover:underline"
                          onClick={() => {
                            setSelectedUser(u.user_id);
                            window.scrollTo({ top: 0, behavior: "smooth" });
                          }}
                        >
                          Assign role
                        </button>
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
