import { createServerFn } from "@tanstack/react-start";
import { getRequestHost } from "@tanstack/react-start/server";
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
    // Verify caller is super_admin (via their own RLS-scoped client)
    const { data: myRoles, error: myRolesErr } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    if (myRolesErr) throw new Error(myRolesErr.message);
    const isSuper = (myRoles ?? []).some((r) => r.role === "super_admin");
    if (!isSuper) {
      throw new Response("Forbidden", { status: 403 });
    }

    const email = data.email.trim().toLowerCase();

    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );

    // Pre-authorize the role so it applies automatically on signup
    const { error: pendingErr } = await supabaseAdmin
      .from("pending_invites")
      .upsert(
        { email, role: data.role, invited_by: context.userId },
        { onConflict: "email,role" },
      );
    if (pendingErr) throw new Error(pendingErr.message);

    // Send the Supabase invite email (uses default Lovable auth mail)
    let host: string;
    try {
      host = getRequestHost();
    } catch {
      host = "";
    }
    const proto = host.startsWith("localhost") ? "http" : "https";
    const redirectTo = host ? `${proto}://${host}/auth` : undefined;

    const { error: inviteErr } =
      await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
        redirectTo,
      });

    // If the user already exists, the invite call errors — that's fine, the
    // pending_invite row will still redeem when/if they sign in.
    if (inviteErr && !/already/i.test(inviteErr.message)) {
      // Non-fatal — surface as a warning but keep the pending invite
      return { ok: true, warning: inviteErr.message };
    }

    return { ok: true };
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
    if (!(myRoles ?? []).some((r) => r.role === "super_admin")) {
      throw new Response("Forbidden", { status: 403 });
    }
    const { error } = await context.supabase
      .from("pending_invites")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
