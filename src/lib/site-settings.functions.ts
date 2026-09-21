import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const UpdateSiteSettingsInput = z.object({
  id: z.string().uuid(),
  group_name: z.string().trim().min(1).max(160),
  tagline: z.string().trim().max(300),
  phone: z.string().trim().max(60),
  email: z.string().trim().max(255),
  location: z.string().trim().max(255),
  about_intro: z.string().trim().max(5000),
  vision: z.string().trim().max(5000),
  mission: z.string().trim().max(5000),
  marquee_enabled: z.boolean(),
});

export const updateSiteSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => UpdateSiteSettingsInput.parse(data))
  .handler(async ({ data, context }) => {
    const { data: roles, error: rolesError } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);

    if (rolesError) throw new Error(rolesError.message);
    if (!(roles ?? []).some((r: { role: string }) => r.role === "super_admin")) {
      throw new Response("Only a super admin can change site contact information", {
        status: 403,
      });
    }

    const secret =
      process.env["SUPABASE_SECRET_KEY"] ||
      process.env["SUPABASE_SERVICE_ROLE_KEY"];
    const url = process.env["SUPABASE_URL"];

    if (!secret || !url) {
      throw new Error(
        "Server Supabase admin key is not configured. Set SUPABASE_SECRET_KEY in Cloudflare.",
      );
    }

    const admin = createClient<Database>(url, secret, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { error } = await admin
      .from("site_settings")
      .update({
        group_name: data.group_name,
        tagline: data.tagline,
        phone: data.phone,
        email: data.email,
        location: data.location,
        about_intro: data.about_intro,
        vision: data.vision,
        mission: data.mission,
        marquee_enabled: data.marquee_enabled,
        updated_by: context.userId,
      })
      .eq("id", data.id);

    if (error) throw new Error(error.message);

    return { ok: true };
  });
