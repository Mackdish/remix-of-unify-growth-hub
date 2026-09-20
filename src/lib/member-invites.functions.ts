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

const CreateInput = z.object({
  fullName: z.string().trim().min(2).max(120),
  memberCode: z.string().trim().max(30).optional().or(z.literal("")),
  email: z.string().trim().email().max(255).optional().or(z.literal("")),
  phone: z.string().trim().max(30).optional().or(z.literal("")),
  role: AppRole.default("member"),
  memberId: z.string().uuid().optional().or(z.literal("")),
});

function newToken() {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

async function getCallerRoles(context: { supabase: any; userId: string }) {
  const { data, error } = await context.supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", context.userId);
  if (error) throw new Error(error.message);
  return (data ?? []).map((row: { role: string }) => row.role);
}

async function assertCanInviteMembers(context: { supabase: any; userId: string }) {
  const roles = await getCallerRoles(context);
  if (!roles.some((role: string) => ["super_admin", "secretary"].includes(role))) {
    throw new Response("Forbidden", { status: 403 });
  }
  return roles;
}

/**
 * Creates an application-level invitation link.
 *
 * Supabase Auth Admin inviteUserByEmail is intentionally not used because it
 * requires a secret/service-role key. The invited member creates their own
 * Auth account through supabase.auth.signUp().
 */
export const createMemberInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => CreateInput.parse(data))
  .handler(async ({ data, context }) => {
    const callerRoles = await assertCanInviteMembers(context);

    if (!data.email) {
      throw new Error("A member invitation must be tied to an email address.");
    }

    const email = data.email.toLowerCase();
    const phone = data.phone || null;

    if (data.role !== "member" && !callerRoles.includes("super_admin")) {
      throw new Response(
        "Only a super admin can invite an administrative role.",
        { status: 403 },
      );
    }

    let memberId = data.memberId || null;

    if (!memberId) {
      const code =
        data.memberCode ||
        `UYG-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

      const { data: created, error } = await context.supabase
        .from("members")
        .insert({
          member_code: code,
          full_name: data.fullName,
          email,
          phone,
          status: "pending",
        })
        .select("id")
        .single();

      if (error) throw new Error(error.message);
      memberId = created.id;
    }

    const token = newToken();
    const { data: invite, error: invErr } = await context.supabase
      .from("member_invites")
      .insert({
        member_id: memberId,
        full_name: data.fullName,
        member_code: data.memberCode || null,
        email,
        phone,
        role: data.role,
        token,
        invited_by: context.userId,
      })
      .select("id, token, expires_at")
      .single();

    if (invErr || !invite) {
      throw new Error(invErr?.message ?? "Could not create the invitation");
    }

    return {
      ok: true,
      token: invite.token,
      expiresAt: invite.expires_at,
      // Email delivery is deliberately handled outside Supabase Auth Admin.
      emailSent: false,
      emailWarning: "Invite link created. Share the link or deliver it through your email provider.",
    };
  });

export const revokeMemberInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ id: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertCanInviteMembers(context);
    const { error } = await context.supabase
      .from("member_invites")
      .delete()
      .eq("id", data.id);

    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Public: returns only the minimal fields needed by the invitation page. */
export const getMemberInvite = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z.object({ token: z.string().min(20).max(120) }).parse(data),
  )
  .handler(async ({ data }) => {
    const { data: rows, error } = await fetchPublicInvite(data.token);
    const invite = rows?.[0];

    if (error || !invite) {
      return { valid: false as const, reason: "not_found" as const };
    }

    if (invite.accepted_at) {
      return { valid: false as const, reason: "used" as const };
    }

    if (new Date(invite.expires_at) < new Date()) {
      return { valid: false as const, reason: "expired" as const };
    }

    return {
      valid: true as const,
      fullName: invite.full_name,
      email: invite.email,
    };
  });

/**
 * After sign-up/sign-in, the authenticated user claims the invitation.
 * The database function verifies that the invite email matches the JWT email
 * and performs the member/user-role linking without elevated API keys.
 */
export const acceptMemberInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ token: z.string().min(20).max(120) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { data: result, error } = await context.supabase.rpc(
      "claim_member_invite",
      { p_token: data.token },
    );

    if (error) throw new Error(error.message);
    if (!result?.ok) {
      throw new Error(result?.error ?? "Could not activate this invitation");
    }

    return { ok: true };
  });

async function fetchPublicInvite(token: string) {
  const url =
    import.meta.env.VITE_SUPABASE_URL ||
    import.meta.env.SUPABASE_URL;
  const key =
    import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    import.meta.env.SUPABASE_PUBLISHABLE_KEY;

  if (!url || !key) {
    throw new Error("Supabase public configuration is missing");
  }

  const response = await fetch(
    `${url}/rest/v1/rpc/get_member_invite`,
    {
      method: "POST",
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ p_token: token }),
    },
  );

  if (!response.ok) {
    return { data: null, error: new Error(`Invite lookup failed (${response.status})`) };
  }

  return {
    data: (await response.json()) as Array<{
      full_name: string;
      email: string | null;
      expires_at: string;
      accepted_at: string | null;
    }>,
    error: null,
  };
}
