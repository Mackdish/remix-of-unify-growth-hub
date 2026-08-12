import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  ADMIN_ROLES,
  canWithRoles,
  type AppRole,
  type Permission,
} from "@/lib/permissions";

/** Roles + permission helpers for the signed-in user. */
export function usePermissions() {
  const { data, isLoading } = useQuery({
    queryKey: ["my-permissions"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return { userId: null as string | null, roles: [] as string[] };
      const { data: rows } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", u.user.id);
      return {
        userId: u.user.id,
        roles: (rows ?? []).map((r) => r.role as string),
      };
    },
    staleTime: 60_000,
  });

  const roles = data?.roles ?? [];
  return {
    loading: isLoading,
    userId: data?.userId ?? null,
    roles: roles as AppRole[],
    isAdmin: roles.some((r) => (ADMIN_ROLES as readonly string[]).includes(r)),
    isSuperAdmin: roles.includes("super_admin"),
    can: (permission: Permission) => canWithRoles(roles, permission),
  };
}

/**
 * Page-level guard: sends users without `permission` back where they belong.
 * Returns the same shape as usePermissions plus `allowed`.
 */
export function useRequirePermission(permission: Permission) {
  const perms = usePermissions();
  const navigate = useNavigate();
  const allowed = perms.can(permission);

  useEffect(() => {
    if (perms.loading || allowed) return;
    if (perms.isAdmin) {
      toast.error("Your admin role doesn't include this area");
      navigate({ to: "/admin" });
    } else {
      toast.error("Admin access required");
      navigate({ to: "/dashboard" });
    }
  }, [perms.loading, allowed, perms.isAdmin, navigate]);

  return { ...perms, allowed };
}

export function PermissionScreen({ message = "Checking access…" }: { message?: string }) {
  return (
    <div className="container-page py-24 text-center text-muted-foreground">
      {message}
    </div>
  );
}
