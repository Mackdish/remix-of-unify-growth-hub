import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";

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

export const Route = createFileRoute("/api/admin/site-settings")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const authorization = request.headers.get("Authorization");
        const token = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];

        if (!token) {
          return json({ error: "Authentication required" }, 401);
        }

        const url =
          process.env["SUPABASE_URL"] ||
          import.meta.env.VITE_SUPABASE_URL;
        const secret =
          process.env["SUPABASE_SECRET_KEY"] ||
          process.env["SUPABASE_SERVICE_ROLE_KEY"];

        if (!url || !secret) {
          return json(
            { error: "Server Supabase admin key is not configured" },
            500,
          );
        }

        const admin = createClient<Database>(url, secret, {
          auth: { persistSession: false, autoRefreshToken: false },
        });

        const {
          data: { user },
          error: userError,
        } = await admin.auth.getUser(token);

        if (userError || !user) {
          return json({ error: "Invalid or expired session" }, 401);
        }

        const { data: roles, error: rolesError } = await admin
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id);

        if (rolesError) return json({ error: rolesError.message }, 500);

        if (!(roles ?? []).some((row) => row.role === "super_admin")) {
          return json({ error: "Only a super admin can change site settings" }, 403);
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

        const { id, ...settings } = parsed.data;
        const { error } = await admin
          .from("site_settings")
          .update({
            ...settings,
            updated_by: user.id,
          })
          .eq("id", id);

        if (error) return json({ error: error.message }, 500);

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
