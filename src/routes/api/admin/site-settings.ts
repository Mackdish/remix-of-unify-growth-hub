import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { adminRpc } from "@/lib/admin-rpc";
import { createPublicSupabaseClient } from "@/lib/supabase-public";

const UpdateSiteSettingsSchema = z.object({
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
 * Acts as the signed-in user (their bearer token + the publishable key). The
 * database function admin_update_site_settings verifies the caller is a super
 * admin, so no service/secret key is needed.
 */
export const Route = createFileRoute("/api/admin/site-settings")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const authorization = request.headers.get("Authorization");
        const token = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];

        if (!token) {
          return json({ error: "Authentication required" }, 401);
        }

        let supabase: ReturnType<typeof createPublicSupabaseClient>;
        try {
          supabase = createPublicSupabaseClient(token);
        } catch (err) {
          return json(
            { error: err instanceof Error ? err.message : "Supabase configuration is missing" },
            500,
          );
        }

        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser(token);

        if (userError || !user) {
          return json({ error: "Invalid or expired session" }, 401);
        }

        let payload: unknown;
        try {
          payload = await request.json();
        } catch {
          return json({ error: "Invalid JSON request body" }, 400);
        }

        const parsed = UpdateSiteSettingsSchema.safeParse(payload);
        if (!parsed.success) {
          return json(
            { error: "Invalid site settings", details: parsed.error.flatten() },
            400,
          );
        }

        const s = parsed.data;
        const { error } = await adminRpc(supabase, "admin_update_site_settings", {
          p_id: s.id,
          p_group_name: s.group_name,
          p_tagline: s.tagline,
          p_phone: s.phone,
          p_email: s.email,
          p_location: s.location,
          p_about_intro: s.about_intro,
          p_vision: s.vision,
          p_mission: s.mission,
          p_marquee_enabled: s.marquee_enabled,
        });

        if (error) {
          return json({ error: error.message }, error.code === "42501" ? 403 : 500);
        }

        return json({ ok: true });
      },
    },
  },
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
