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

async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data, error } = await context.supabase.rpc("is_admin", {
    _user_id: context.userId,
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Response("Forbidden", { status: 403 });
}

/** Create an auth login for an existing member record and link it. */
export const createMemberCredentials = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => CreateInput.parse(data))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
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
    if (linkErr) throw new Error(linkErr.message);

    await supabaseAdmin
      .from("user_roles")
      .upsert({ user_id: userId, role: "member" }, { onConflict: "user_id,role" });

    return { ok: true, email };
  });

/** Reset the password of a member's existing login. */
export const resetMemberPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => ResetInput.parse(data))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);

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
