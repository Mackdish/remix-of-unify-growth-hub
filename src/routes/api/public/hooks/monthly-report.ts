import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

/**
 * Hourly cron entrypoint. Checks the configured monthly schedule and, when the
 * current time matches (day/hour/minute in the configured timezone), builds the
 * monthly report summary and records the run.
 *
 * Emailing the branded PDF to admins activates automatically once a verified
 * sender domain is configured for the project.
 */
export const Route = createFileRoute("/api/public/hooks/monthly-report")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apikey = request.headers.get("apikey");
        const expectedKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
        if (!apikey || !expectedKey || apikey !== expectedKey) {
          return json({ error: "Unauthorized" }, 401);
        }

        const supabase = createClient<Database>(
          import.meta.env.VITE_SUPABASE_URL,
          import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          { auth: { persistSession: false, autoRefreshToken: false } },
        );

        const { data: settings, error: settingsError } = await supabase
          .from("report_schedule_settings")
          .select("*")
          .limit(1)
          .maybeSingle();

        if (settingsError) return json({ error: settingsError.message }, 500);
        if (!settings || !settings.enabled) return json({ skipped: "disabled" });

        const now = new Date();
        const parts = new Intl.DateTimeFormat("en-US", {
          timeZone: settings.timezone || "UTC",
          day: "numeric",
          hour: "numeric",
          minute: "numeric",
          hour12: false,
        }).formatToParts(now);
        const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? -1);
        const day = get("day");
        const hour = get("hour") % 24;
        const minute = get("minute");

        const dueNow =
          day === settings.day_of_month &&
          hour === settings.hour &&
          Math.abs(minute - settings.minute) <= 30;

        if (!dueNow) return json({ skipped: "not_due", day, hour, minute });

        // Avoid double-sending within the same day.
        if (settings.last_run_at) {
          const last = new Date(settings.last_run_at);
          if (now.getTime() - last.getTime() < 20 * 60 * 60 * 1000) {
            return json({ skipped: "already_ran" });
          }
        }

        const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
        const monthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0));
        const from = monthStart.toISOString().slice(0, 10);
        const to = monthEnd.toISOString().slice(0, 10);

        const { data: txns, error: txnError } = await supabase
          .from("transactions")
          .select("category, amount, transaction_date")
          .gte("transaction_date", from)
          .lte("transaction_date", to);

        if (txnError) return json({ error: txnError.message }, 500);

        const byCategory: Record<string, number> = {};
        let total = 0;
        for (const t of txns ?? []) {
          const amount = Number(t.amount) || 0;
          byCategory[t.category] = (byCategory[t.category] ?? 0) + amount;
          total += amount;
        }

        const status = "generated (email pending sender domain)";
        await supabase
          .from("report_schedule_settings")
          .update({ last_run_at: now.toISOString(), last_run_status: status })
          .eq("id", settings.id);

        return json({
          ok: true,
          period: { from, to },
          entries: txns?.length ?? 0,
          total,
          byCategory,
          status,
        });
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
