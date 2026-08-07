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

async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data, error } = await context.supabase.rpc("is_admin", {
    _user_id: context.userId,
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Response("Forbidden", { status: 403 });
}

/** Admin: create an invite (email and/or phone) that lets the person set their own password. */
export const createMemberInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => CreateInput.parse(data))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);

    const email = data.email ? data.email.toLowerCase() : null;
    const phone = data.phone || null;
    if (!email && !phone) {
      throw new Error("Provide an email address or a phone number");
    }

    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );

    // Reuse the member record if given, otherwise create a pending one.
    let memberId = data.memberId || null;
    if (!memberId) {
      const code =
        data.memberCode ||
        `UYG-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
      const { data: created, error } = await supabaseAdmin
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
    const { data: invite, error: invErr } = await supabaseAdmin
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
    if (invErr) throw new Error(invErr.message);

    // Pre-authorise the role so it applies as soon as they sign in.
    if (email) {
      await supabaseAdmin
        .from("pending_invites")
        .upsert(
          { email, role: data.role, invited_by: context.userId },
          { onConflict: "email,role" },
        );
    }

    let emailSent = false;
    let emailWarning: string | null = null;
    if (email) {
      const { error } = await supabaseAdmin.auth.admin.inviteUserByEmail(email);
      if (error) emailWarning = error.message;
      else emailSent = true;
    }

    return {
      ok: true,
      token: invite.token,
      expiresAt: invite.expires_at,
      emailSent,
      emailWarning,
    };
  });

export const revokeMemberInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ id: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { error } = await context.supabase
      .from("member_invites")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Public: read the minimal, non-sensitive details of an invite token. */
export const getMemberInvite = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z.object({ token: z.string().min(20).max(120) }).parse(data),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );
    const { data: invite } = await supabaseAdmin
      .from("member_invites")
      .select("full_name, email, expires_at, accepted_at")
      .eq("token", data.token)
      .maybeSingle();

    if (!invite) return { valid: false as const, reason: "not_found" as const };
    if (invite.accepted_at)
      return { valid: false as const, reason: "used" as const };
    if (new Date(invite.expires_at) < new Date())
      return { valid: false as const, reason: "expired" as const };

    return {
      valid: true as const,
      fullName: invite.full_name,
      email: invite.email,
    };
  });

/** Public: the invited person sets their own password and their account is created. */
export const acceptMemberInvite = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        token: z.string().min(20).max(120),
        email: z.string().trim().email().max(255),
        password: z.string().min(8).max(72),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );

    const { data: invite } = await supabaseAdmin
      .from("member_invites")
      .select("id, member_id, full_name, email, role, expires_at, accepted_at")
      .eq("token", data.token)
      .maybeSingle();

    if (!invite) throw new Error("This invite link is not valid");
    if (invite.accepted_at) throw new Error("This invite has already been used");
    if (new Date(invite.expires_at) < new Date())
      throw new Error("This invite link has expired");

    const email = data.email.toLowerCase();
    // If the invite was issued to a specific email, it must match.
    if (invite.email && invite.email.toLowerCase() !== email) {
      throw new Error("Use the email address this invite was sent to");
    }

    const { data: created, error: cErr } =
      await supabaseAdmin.auth.admin.createUser({
        email,
        password: data.password,
        email_confirm: true,
        user_metadata: { full_name: invite.full_name },
      });
    if (cErr || !created?.user) {
      throw new Error(cErr?.message ?? "Could not create your account");
    }
    const userId = created.user.id;

    if (invite.member_id) {
      await supabaseAdmin
        .from("members")
        .update({ user_id: userId, status: "active", email })
        .eq("id", invite.member_id);
    }

    await supabaseAdmin
      .from("user_roles")
      .upsert(
        { user_id: userId, role: invite.role },
        { onConflict: "user_id,role" },
      );

    await supabaseAdmin
      .from("member_invites")
      .update({ accepted_at: new Date().toISOString(), email })
      .eq("id", invite.id);

    return { ok: true, email };
  });
