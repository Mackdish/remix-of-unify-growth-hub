import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

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

function newToken() {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Create a real Supabase Auth account for an existing member.
 *
 * This requires a server-only Supabase secret/service-role key. The key is
 * never sent to the browser and is only used inside this server function.
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

    const secret =
      process.env["SUPABASE_SECRET_KEY"] ||
      process.env["SUPABASE_SERVICE_ROLE_KEY"];

    if (!secret) {
      throw new Error(
        "Server Supabase admin key is not configured. Set SUPABASE_SECRET_KEY in Cloudflare.",
      );
    }

    const admin = createClient<Database>(
      process.env["SUPABASE_URL"]!,
      secret,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );

    const { data: created, error: authError } =
      await admin.auth.admin.createUser({
        email,
        password: data.password,
        email_confirm: true,
        user_metadata: { full_name: member.full_name },
      });

    if (authError || !created.user) {
      throw new Error(authError?.message ?? "Could not create the member login");
    }

    const userId = created.user.id;

    const { error: memberUpdateError } = await context.supabase
      .from("members")
      .update({ email, user_id: userId, status: "active" })
      .eq("id", member.id);

    if (memberUpdateError) {
      await admin.auth.admin.deleteUser(userId);
      throw new Error(memberUpdateError.message);
    }

    const { error: roleError } = await context.supabase
      .from("user_roles")
      .upsert(
        { user_id: userId, role: "member" },
        { onConflict: "user_id,role", ignoreDuplicates: true },
      );

    if (roleError) {
      await context.supabase
        .from("members")
        .update({ email: null, user_id: null, status: "pending" })
        .eq("id", member.id);
      await admin.auth.admin.deleteUser(userId);
      throw new Error(roleError.message);
    }

    return {
      ok: true,
      email,
      userId,
      loginCreated: true,
    };
  });

/**
 * Permanently delete a member and their Supabase Auth account.
 * Only a super admin can perform this destructive operation.
 * Members with financial transactions cannot be deleted so the ledger remains intact.
 */
export const deleteMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ memberId: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const roles = await getCallerRoles(context);
    if (!roles.includes("super_admin")) {
      throw new Response("Only a super admin can delete members", { status: 403 });
    }

    if (data.memberId === context.userId) {
      throw new Error("You cannot delete your own member account");
    }

    const { data: member, error: memberError } = await context.supabase
      .from("members")
      .select("id, full_name, user_id")
      .eq("id", data.memberId)
      .maybeSingle();

    if (memberError) throw new Error(memberError.message);
    if (!member) throw new Error("Member not found");

    const { count, error: txnError } = await context.supabase
      .from("transactions")
      .select("id", { count: "exact", head: true })
      .eq("member_id", data.memberId);

    if (txnError) throw new Error(txnError.message);
    if ((count ?? 0) > 0) {
      throw new Error(
        "This member has financial transactions and cannot be deleted. Remove or archive the financial records first.",
      );
    }

    const secret =
      process.env["SUPABASE_SECRET_KEY"] ||
      process.env["SUPABASE_SERVICE_ROLE_KEY"];

    if (!secret || !process.env["SUPABASE_URL"]) {
      throw new Error(
        "Server Supabase admin key is not configured. Set SUPABASE_SECRET_KEY in Cloudflare.",
      );
    }

    const admin = createClient<Database>(
      process.env["SUPABASE_URL"],
      secret,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );

    // Remove application records first. Auth is removed last so a failed
    // database deletion does not leave a member record without its login.
    const { error: inviteError } = await admin
      .from("member_invites")
      .delete()
      .eq("member_id", data.memberId);
    if (inviteError) throw new Error(inviteError.message);

    if (member.user_id) {
      const { error: roleError } = await admin
        .from("user_roles")
        .delete()
        .eq("user_id", member.user_id);
      if (roleError) throw new Error(roleError.message);
    }

    const { error: deleteMemberError } = await admin
      .from("members")
      .delete()
      .eq("id", data.memberId);
    if (deleteMemberError) throw new Error(deleteMemberError.message);

    if (member.user_id) {
      const { error: authDeleteError } =
        await admin.auth.admin.deleteUser(member.user_id);
      if (authDeleteError) {
        throw new Error(
          `Member record deleted, but the login could not be removed: ${authDeleteError.message}`,
        );
      }
    }

    return { ok: true, memberId: data.memberId, fullName: member.full_name };
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

    const secret =
      process.env["SUPABASE_SECRET_KEY"] ||
      process.env["SUPABASE_SERVICE_ROLE_KEY"];

    if (!secret || !process.env["SUPABASE_URL"]) {
      await context.supabase.from("members").delete().eq("id", member.id);
      throw new Error(
        "Server Supabase admin key is not configured. Set SUPABASE_SECRET_KEY in Cloudflare.",
      );
    }

    const admin = createClient<Database>(
      process.env["SUPABASE_URL"],
      secret,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );

    const { data: created, error: authError } =
      await admin.auth.admin.createUser({
        email,
        password: data.password!,
        email_confirm: true,
        user_metadata: { full_name: data.fullName },
      });

    if (authError || !created.user) {
      await context.supabase.from("members").delete().eq("id", member.id);
      throw new Error(authError?.message ?? "Could not create the member login");
    }

    const userId = created.user.id;

    const { error: memberUpdateError } = await context.supabase
      .from("members")
      .update({ user_id: userId, status: "active" })
      .eq("id", member.id);

    if (memberUpdateError) {
      await admin.auth.admin.deleteUser(userId);
      await context.supabase.from("members").delete().eq("id", member.id);
      throw new Error(memberUpdateError.message);
    }

    const { error: roleError } = await context.supabase
      .from("user_roles")
      .insert({ user_id: userId, role: data.role });

    if (roleError) {
      await admin.auth.admin.deleteUser(userId);
      await context.supabase.from("members").delete().eq("id", member.id);
      throw new Error(roleError.message);
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
