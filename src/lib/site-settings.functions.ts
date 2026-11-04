import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { callAdminRpc } from "@/lib/admin-rpc";

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

/**
 * Runs as the signed-in user. The database function re-checks that the caller
 * is a super admin, so no service/secret key is needed.
 */
export const updateSiteSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => {
    const candidate =
      input &&
      typeof input === "object" &&
      "data" in input &&
      (input as { data?: unknown }).data &&
      typeof (input as { data?: unknown }).data === "object"
        ? (input as { data: unknown }).data
        : input;

    return UpdateSiteSettingsInput.parse(candidate);
  })
  .handler(async ({ data, context }) => {
    await callAdminRpc(context.supabase, "admin_update_site_settings", {
      p_id: data.id,
      p_group_name: data.group_name,
      p_tagline: data.tagline,
      p_phone: data.phone,
      p_email: data.email,
      p_location: data.location,
      p_about_intro: data.about_intro,
      p_vision: data.vision,
      p_mission: data.mission,
      p_marquee_enabled: data.marquee_enabled,
    });

    return { ok: true };
  });
