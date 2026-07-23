import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ShieldCheck, ArrowLeft, Trash2, Plus, Search, UserCog } from "lucide-react";

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

  const { data: me, isLoading: checking } = useQuery({
    queryKey: ["is-super-admin"],
    queryFn: async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) return { userId: null as string | null, isSuper: false };
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", data.user.id);
      const isSuper = (roles ?? []).some((r: { role: string }) => r.role === "super_admin");
      return { userId: data.user.id, isSuper };
    },
  });

  useEffect(() => {
    if (!checking && me && !me.isSuper) {
      toast.error("Super admin access required");
      navigate({ to: "/admin" });
    }
  }, [me, checking, navigate]);

  const { data: users, isLoading: usersLoading } = useQuery({
    queryKey: ["users-with-roles"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("list_users_with_roles");
      if (error) throw error;
      return data as Array<{ user_id: string; email: string; roles: string[] }>;
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
            className="input"
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
            className="input"
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
              className="input pl-8"
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
