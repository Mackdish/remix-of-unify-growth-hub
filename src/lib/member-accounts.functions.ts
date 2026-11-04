import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { callAdminRpc } from "@/lib/admin-rpc";
import { createPublicSupabaseClient } from "@/lib/supabase-public";

/**
 * None of these functions use a Supabase service/secret key.
 *
 * - They run as the signed-in user (requireSupabaseAuth gives a client that
 *   carries the caller's JWT).
 * - Anything privileged is done by SECURITY DEFINER database functions that
 *   re-check the caller's role from auth.uid() (see
 *   supabase/migrations/20261104100000_admin_rpcs_without_service_key.sql).
 * - New logins are created with the normal public sign-up call.
 */

const CreateInput = z.object({
  memberId: z.string().uuid(),
  email: z.string().trim().email().max(255),
  password: z.string().min(8).max(72),
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

async function errorMessage(err: unknown): Promise<string> {
  if (err instanceof Response) return (await err.text()) || `Request failed (${err.status})`;
  if (err instanceof Error) return err.message;
  return "Unknown error";
}

/**
 * Create the Supabase Auth login with the public sign-up call (publishable key
 * only). Returns the new auth user id. Linking it to the member, and confirming
 * the email, is done afterwards by admin_link_member_account.
 */
async function signUpMemberLogin(email: string, password: string, fullName: string) {
  const anon = createPublicSupabaseClient();
  const { data, error } = await anon.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName } },
  });

  if (error) throw new Error(error.message);
  const user = data.user;
  if (!user) throw new Error("Could not create the member login");

  // Supabase hides existing accounts by returning a user with no identities.
  if (!user.identities || user.identities.length === 0) {
    throw new Error(
      "An account with this email already exists. Use \"Approve accounts\" to link it to the member, or send an invite instead.",
    );
  }

  return user.id;
}

/**
 * Create a real Supabase Auth account for an existing member.
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

    const userId = await signUpMemberLogin(email, data.password, member.full_name);

    try {
      await callAdminRpc(context.supabase, "admin_link_member_account", {
        p_member_id: member.id,
        p_user_id: userId,
        p_role: "member",
        p_confirm_email: true,
        p_overwrite_email: true,
      });
    } catch (err) {
      throw new Error(
        `The login for ${email} was created but could not be linked to the member: ${await errorMessage(err)}. Use "Approve accounts" to link it.`,
      );
    }

    return {
      ok: true,
      email,
      userId,
      loginCreated: true,
    };
  });

/**
 * Permanently delete a member and their login. Only a super admin can do this
 * (enforced inside the database function). Members with financial transactions
 * cannot be deleted so the ledger remains intact.
 */
export const deleteMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ memberId: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const result = await callAdminRpc<{ full_name?: string }>(
      context.supabase,
      "admin_delete_member",
      { p_member_id: data.memberId },
    );

    return { ok: true, memberId: data.memberId, fullName: result.full_name ?? "" };
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
  password: z.string().min(8).max(72).optional(),
  redirectTo: z.string().trim().url().max(500).optional().or(z.literal("")),
});

/**
 * Add a member and, when requested, create their real Supabase Auth login.
 * The password is used only on the server and is never stored in the database.
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
      throw new Error("An email is required to create a login");
    }
    if (data.access === "email" && !data.password) {
      throw new Error("A password is required to create a login");
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
        status: "pending",
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
      };
    }

    let userId: string;
    try {
      userId = await signUpMemberLogin(email, data.password!, data.fullName);
    } catch (err) {
      // Nothing was created in Auth, so remove the member record we just added.
      await context.supabase.from("members").delete().eq("id", member.id);
      throw err;
    }

    try {
      await callAdminRpc(context.supabase, "admin_link_member_account", {
        p_member_id: member.id,
        p_user_id: userId,
        p_role: data.role,
        p_confirm_email: true,
      });
    } catch (err) {
      // The login exists in Auth now, so keep the member record and let an admin
      // finish the link from "Approve accounts" instead of orphaning the login.
      throw new Error(
        `Member saved and the login for ${email} was created, but linking failed: ${await errorMessage(err)}. Use "Approve accounts" to link it.`,
      );
    }

    return {
      ok: true,
      memberId: member.id,
      loginCreated: true,
      emailSent: false,
      existingAccount: false,
      email,
    };
  });

const LinkMemberInput = z.object({
  memberId: z.string().uuid(),
  userId: z.string().uuid(),
});

/**
 * Link an existing Supabase Auth user to an existing member record.
 * The database function checks that the caller is an admin, that the member is
 * not already linked, and that the login is not attached elsewhere.
 */
export const linkMemberAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => LinkMemberInput.parse(data))
  .handler(async ({ data, context }) => {
    const callerRoles = await assertCanManageMembers(context);

    await callAdminRpc(context.supabase, "admin_link_member_account", {
      p_member_id: data.memberId,
      p_user_id: data.userId,
    });

    return {
      ok: true,
      memberId: data.memberId,
      userId: data.userId,
      roles: callerRoles,
    };
  });
