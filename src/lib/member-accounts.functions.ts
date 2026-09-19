import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const CreateInput = z.object({
  memberId: z.string().uuid(),
  email: z.string().trim().email().max(255),
  password: z.string().min(8).max(72),
});

const ResetInput = z.object({
  memberId: z.string().uuid(),
  password: z.string().min(8).max(72),
});

async function getCallerRoles(context: { supabase: any; userId: string }) {
  const { data, error } = await context.supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", context.userId);
  if (error) throw new Error(error.message);
  return (data ?? []).map((row: { role: string }) => row.role);
}

async function assertAdmin(context: { supabase: any; userId: string }) {
  const roles = await getCallerRoles(context);
  if (!roles.some((role: string) =>
    ["super_admin", "treasurer", "secretary", "project_manager"].includes(role)
  )) {
    throw new Response("Forbidden", { status: 403 });
  }
  return roles;
}

async function assertCanManageMembers(context: { supabase: any; userId: string }) {
  const roles = await getCallerRoles(context);
  if (!roles.some((role: string) => ["super_admin", "secretary"].includes(role))) {
    throw new Response("Forbidden", { status: 403 });
  }
  return roles;
}

/** Create an auth login for an existing member record and link it. */
export const createMemberCredentials = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => CreateInput.parse(data))
  .handler(async ({ data, context }) => {
    await assertCanManageMembers(context);
    const email = data.email.toLowerCase();

    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );

    const { data: member, error: mErr } = await supabaseAdmin
      .from("members")
      .select("id, full_name, user_id")
      .eq("id", data.memberId)
      .maybeSingle();
    if (mErr) throw new Error(mErr.message);
    if (!member) throw new Error("Member not found");
    if (member.user_id) throw new Error("This member already has a login");

    const { data: created, error: cErr } =
      await supabaseAdmin.auth.admin.createUser({
        email,
        password: data.password,
        email_confirm: true,
        user_metadata: { full_name: member.full_name },
      });

    if (cErr || !created?.user) {
      throw new Error(cErr?.message ?? "Could not create the login");
    }

    const userId = created.user.id;

    const { error: linkErr } = await supabaseAdmin
      .from("members")
      .update({ user_id: userId, status: "active", email })
      .eq("id", member.id);
    if (linkErr) {
      if (createdAuthUser) await supabaseAdmin.auth.admin.deleteUser(userId);
      throw new Error(linkErr.message);
    }

    const { error: roleError } = await supabaseAdmin
      .from("user_roles")
      .upsert({ user_id: userId, role: "member" }, { onConflict: "user_id,role" });
    if (roleError) {
      await supabaseAdmin
        .from("members")
        .update({ user_id: null, status: "pending" })
        .eq("id", member.id);
      if (createdAuthUser) await supabaseAdmin.auth.admin.deleteUser(userId);
      throw new Error("Could not assign member role: " + roleError.message);
    }

    return { ok: true, email };
  });

/** Reset the password of a member's existing login. */
export const resetMemberPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => ResetInput.parse(data))
  .handler(async ({ data, context }) => {
    const callerRoles = await assertCanManageMembers(context);

    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );

    const { data: member, error: mErr } = await supabaseAdmin
      .from("members")
      .select("user_id")
      .eq("id", data.memberId)
      .maybeSingle();
    if (mErr) throw new Error(mErr.message);
    if (!member?.user_id) throw new Error("This member has no login yet");

    const { error } = await supabaseAdmin.auth.admin.updateUserById(
      member.user_id,
      { password: data.password },
    );
    if (error) throw new Error(error.message);

    return { ok: true };
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
  /** none = record only, password = admin sets a temp password, email = emailed set-password link */
  access: z.enum(["none", "password", "email"]).default("email"),
  password: z.string().max(72).optional().or(z.literal("")),
  redirectTo: z.string().trim().url().max(300).optional().or(z.literal("")),
});

/**
 * Add a member record and, optionally, an auth login + role in one step.
 * Runs privileged so RLS/grant surprises can't silently block admins.
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

    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );

    const email = (data.email ?? "").trim().toLowerCase();
    const wantsLogin = data.access !== "none";
    if (wantsLogin && !email) {
      throw new Error("An email is required to give this member a login");
    }
    if (data.access === "password" && (!data.password || data.password.length < 8)) {
      throw new Error("Password must be at least 8 characters");
    }

    const { data: existingCode, error: existingCodeError } = await supabaseAdmin
      .from("members")
      .select("id")
      .eq("member_code", data.memberCode)
      .maybeSingle();
    if (existingCodeError) throw new Error(existingCodeError.message);
    if (existingCode) throw new Error(`Member code ${data.memberCode} is already taken`);

    if (email) {
      const { data: existingEmail, error: existingEmailError } = await supabaseAdmin
        .from("members")
        .select("id")
        .eq("email", email)
        .maybeSingle();
      if (existingEmailError) throw new Error(existingEmailError.message);
      if (existingEmail) throw new Error("A member already uses this email address");
    }

    if (!wantsLogin) {
      const { data: member, error: insertError } = await supabaseAdmin
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
      return {
        ok: true,
        memberId: member.id,
        loginCreated: false,
        emailSent: false,
        existingAccount: false,
        email: null as string | null,
      };
    }

    const redirectTo = (data.redirectTo ?? "").trim() || undefined;
    let userId = "";
    let emailSent = false;
    let existingAccount = false;
    let createdAuthUser = false;

    const { data: authUsers, error: listUsersError } =
      await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (listUsersError) throw new Error(listUsersError.message);
    const existingAuthUser = authUsers.users.find(
      (user) => user.email?.toLowerCase() === email,
    );

    if (existingAuthUser) {
      const { data: linkedMember, error: linkedMemberError } = await supabaseAdmin
        .from("members")
        .select("id")
        .eq("user_id", existingAuthUser.id)
        .maybeSingle();
      if (linkedMemberError) throw new Error(linkedMemberError.message);
      if (linkedMember) throw new Error("This email is already linked to a member account");
      if (data.access === "password") {
        throw new Error("This email already has a login. Choose email activation to link it safely.");
      }
      userId = existingAuthUser.id;
      existingAccount = true;
    } else if (data.access === "email") {
      const { data: invited, error: iErr } =
        await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
          data: { full_name: data.fullName },
          ...(redirectTo ? { redirectTo } : {}),
        });
      if (iErr || !invited?.user) {
        throw new Error(
          `Member saved, but the invitation email failed: ${iErr?.message ?? "unknown error"}`,
        );
      }
      userId = invited.user.id;
      emailSent = true;
      createdAuthUser = true;
    } else {
      const password = data.password;
      if (!password || password.length < 8) {
        throw new Error("Password must be at least 8 characters");
      }
      const { data: created, error: cErr } =
        await supabaseAdmin.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: { full_name: data.fullName },
        });
      if (cErr || !created?.user) {
        // Keep the member record; report why the login failed.
        throw new Error(
          `Member saved, but the login failed: ${cErr?.message ?? "unknown error"}`,
        );
      }
      userId = created.user.id;
      createdAuthUser = true;
    }

    const { data: member, error: insertError } = await supabaseAdmin
      .from("members")
      .insert({
        member_code: data.memberCode,
        full_name: data.fullName,
        phone: (data.phone ?? "").trim() || null,
        email,
        notes: (data.notes ?? "").trim() || null,
        status: "active",
        user_id: userId,
      })
      .select("id")
      .single();
    if (insertError || !member) {
      if (createdAuthUser) await supabaseAdmin.auth.admin.deleteUser(userId);
      throw new Error(insertError?.message ?? "Could not save the member");
    }

    const { error: roleError } = await supabaseAdmin
      .from("user_roles")
      .upsert(
        { user_id: userId, role: data.role },
        { onConflict: "user_id,role" },
      );
    if (roleError) {
      await supabaseAdmin.from("members").delete().eq("id", member.id);
      if (createdAuthUser) await supabaseAdmin.auth.admin.deleteUser(userId);
      throw new Error(`Could not assign the selected role: ${roleError.message}`);
    }

    return {
      ok: true,
      memberId: member.id,
      loginCreated: true,
      emailSent,
      existingAccount,
      email,
    };
  });
