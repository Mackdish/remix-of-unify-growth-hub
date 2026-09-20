import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const AppRole = z.enum([
  "super_admin",
  "treasurer",
  "secretary",
  "project_manager",
  "member",
]);

const InviteInput = z.object({
  email: z.string().email(),
  role: AppRole,
});

export const inviteAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => InviteInput.parse(data))
  .handler(async ({ data, context }) => {
    const { data: myRoles, error: myRolesErr } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);

    if (myRolesErr) throw new Error(myRolesErr.message);

    const isSuper = (myRoles ?? []).some((r: { role: string }) => r.role === "super_admin");
    if (!isSuper) throw new Response("Forbidden", { status: 403 });

    const email = data.email.trim().toLowerCase();

    const { error } = await context.supabase
      .from("pending_invites")
      .upsert(
        { email, role: data.role, invited_by: context.userId },
        { onConflict: "email,role" },
      );

    if (error) throw new Error(error.message);

    return {
      ok: true,
      warning:
        "Role invitation recorded. The user must create/sign in to their account with this email; no Supabase Auth Admin key is required.",
    };
  });

export const revokeInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ id: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { data: myRoles } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);

    if (!(myRoles ?? []).some((r: { role: string }) => r.role === "super_admin")) {
      throw new Response("Forbidden", { status: 403 });
    }

    const { error } = await context.supabase
      .from("pending_invites")
      .delete()
      .eq("id", data.id);

    if (error) throw new Error(error.message);
    return { ok: true };
  });
