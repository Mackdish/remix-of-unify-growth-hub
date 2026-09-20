import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const CreateInput = z.object({
  memberId: z.string().uuid(),
  email: z.string().trim().email().max(255),
});

const ResetInput = z.object({
  memberId: z.string().uuid(),
  redirectTo: z.string().trim().url().max(500).optional(),
});

async function getCallerRoles(context: { supabase: any; userId: string }) {
  const { data, error } = await context.supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", context.userId);
  if (error) throw new Error(error.message);
  return (data ?? []).map((row: { role: string }) => row.role);
}

async function assertCanManageMembers(context: { supabase: any; userId: string }) {
  const roles = await getCallerRoles(context);
  if (!roles.some((role: string) => ["super_admin", "secretary"].includes(role))) {
    throw new Response("Forbidden", { status: 403 });
  }
  return roles;
}

function newToken() {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Prepare activation for an existing member.
 *
 * Authentication is deliberately created by the member with supabase.auth.signUp().
 * This keeps Cloudflare deployments independent of the Supabase secret/service-role key.
 */
export const createMemberCredentials = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => CreateInput.parse(data))
  .handler(async ({ data, context }) => {
    await assertCanManageMembers(context);
    const email = data.email.toLowerCase();

    const { data: member, error: memberError } = await context.supabase
      .from("members")
      .select("id, full_name, user_id")
      .eq("id", data.memberId)
      .maybeSingle();

    if (memberError) throw new Error(memberError.message);
    if (!member) throw new Error("Member not found");
    if (member.user_id) throw new Error("This member already has a login");

    const token = newToken();
    const { data: invite, error: inviteError } = await context.supabase
      .from("member_invites")
      .insert({
        member_id: member.id,
        full_name: member.full_name,
        email,
        role: "member",
        token,
        invited_by: context.userId,
      })
      .select("token")
      .single();

    if (inviteError || !invite) {
      throw new Error(inviteError?.message ?? "Could not create the activation link");
    }

    const { error: updateError } = await context.supabase
      .from("members")
      .update({ email, status: "pending" })
      .eq("id", member.id);

    if (updateError) throw new Error(updateError.message);

    return { ok: true, email, inviteToken: invite.token };
  });

/**
 * Password reset is user-controlled. Admins can request the normal Supabase
 * recovery email, but never set or read another user's password.
 */
export const resetMemberPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => ResetInput.parse(data))
  .handler(async ({ data, context }) => {
    await assertCanManageMembers(context);

    const { data: member, error } = await context.supabase
      .from("members")
      .select("email, user_id")
      .eq("id", data.memberId)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!member?.user_id || !member.email) {
      throw new Error("This member does not have an email-linked login");
    }

    const { error: resetError } = await context.supabase.auth.resetPasswordForEmail(
      member.email,
      { redirectTo: data.redirectTo },
    );

    if (resetError) throw new Error(resetError.message);
    return { ok: true, email: member.email };
  });

const AddMemberInput = z.object({
  memberCode: z.string().trim().min(1).max(40),
  fullName: z.string().trim().min(2).max(120),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  email: z.string().trim().max(255).optional().or(z.literal("")),
  notes: z.string().trim().max(500).optional().or(z.literal("")),
  role: z.enum([
    "member",
    "treasurer",
    "secretary",
    "project_manager",
    "super_admin",
  ]),
  access: z.enum(["none", "email"]).default("email"),
  redirectTo: z.string().trim().url().max(500).optional().or(z.literal("")),
});

/**
 * Add a member record and optionally create a one-time activation link.
 * No Auth Admin API is used here; the member creates their Auth account with
 * the public Supabase signUp flow.
 */
export const addMemberWithAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => AddMemberInput.parse(data))
  .handler(async ({ data, context }) => {
    const callerRoles = await assertCanManageMembers(context);

    if (data.role !== "member" && !callerRoles.includes("super_admin")) {
      throw new Response(
        "Only a super admin can assign an administrative role.",
        { status: 403 },
      );
    }

    const email = (data.email ?? "").trim().toLowerCase();
    if (data.access === "email" && !email) {
      throw new Error("An email is required to create an activation link");
    }

    const { data: existingCode, error: codeError } = await context.supabase
      .from("members")
      .select("id")
      .eq("member_code", data.memberCode)
      .maybeSingle();

    if (codeError) throw new Error(codeError.message);
    if (existingCode) throw new Error(`Member code ${data.memberCode} is already taken`);

    if (email) {
      const { data: existingEmail, error: emailError } = await context.supabase
        .from("members")
        .select("id")
        .eq("email", email)
        .maybeSingle();

      if (emailError) throw new Error(emailError.message);
      if (existingEmail) throw new Error("A member already uses this email address");
    }

    const { data: member, error: insertError } = await context.supabase
      .from("members")
      .insert({
        member_code: data.memberCode,
        full_name: data.fullName,
        phone: (data.phone ?? "").trim() || null,
        email: email || null,
        notes: (data.notes ?? "").trim() || null,
        status: data.access === "email" ? "pending" : "pending",
      })
      .select("id")
      .single();

    if (insertError || !member) {
      throw new Error(insertError?.message ?? "Could not save the member");
    }

    if (data.access === "none") {
      return {
        ok: true,
        memberId: member.id,
        loginCreated: false,
        emailSent: false,
        existingAccount: false,
        email: null as string | null,
        inviteToken: null as string | null,
      };
    }

    const token = newToken();
    const { data: invite, error: inviteError } = await context.supabase
      .from("member_invites")
      .insert({
        member_id: member.id,
        full_name: data.fullName,
        member_code: data.memberCode,
        email,
        phone: (data.phone ?? "").trim() || null,
        role: data.role,
        token,
        invited_by: context.userId,
      })
      .select("token")
      .single();

    if (inviteError || !invite) {
      await context.supabase.from("members").delete().eq("id", member.id);
      throw new Error(inviteError?.message ?? "Could not create the activation link");
    }

    return {
      ok: true,
      memberId: member.id,
      loginCreated: false,
      emailSent: false,
      existingAccount: false,
      email,
      inviteToken: invite.token,
    };
  });
