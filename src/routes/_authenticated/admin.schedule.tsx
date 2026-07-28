import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ArrowLeft, CalendarClock, Loader2, Save, CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/schedule")({
  head: () => ({
    meta: [
      { title: "Report Schedule — Unify Youth Group" },
      { name: "robots", content: "noindex" },
      { name: "description", content: "Configure the monthly report delivery schedule." },
    ],
  }),
  component: ScheduleSettings,
});

const TIMEZONES = [
  "Africa/Nairobi",
  "Africa/Kampala",
  "Africa/Dar_es_Salaam",
  "Africa/Kigali",
  "Africa/Lagos",
  "Africa/Johannesburg",
  "UTC",
  "Europe/London",
  "America/New_York",
];

type Settings = {
  id: string;
  enabled: boolean;
  day_of_month: number;
  hour: number;
  minute: number;
  timezone: string;
  last_run_at: string | null;
  last_run_status: string | null;
  updated_at: string;
};

function ScheduleSettings() {
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: role, isLoading: roleLoading } = useQuery({
    queryKey: ["my-roles"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return { admin: false, super: false };
      const { data } = await supabase.from("user_roles").select("role").eq("user_id", u.user.id);
      const roles = (data ?? []).map((r) => r.role as string);
      return {
        admin: roles.some((r) => ["super_admin", "treasurer", "secretary", "project_manager"].includes(r)),
        super: roles.includes("super_admin"),
      };
    },
  });

  useEffect(() => {
    if (!roleLoading && role && !role.admin) navigate({ to: "/dashboard" });
  }, [role, roleLoading, navigate]);

  const { data: settings, isLoading } = useQuery({
    queryKey: ["report-schedule"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("report_schedule_settings")
        .select("*")
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as Settings | null;
    },
    enabled: !!role?.admin,
  });

  const [form, setForm] = useState<Settings | null>(null);
  useEffect(() => {
    if (settings) setForm(settings);
  }, [settings]);

  const canEdit = !!role?.super;

  const save = useMutation({
    mutationFn: async () => {
      if (!form) return;
      const { data: u } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("report_schedule_settings")
        .update({
          enabled: form.enabled,
          day_of_month: form.day_of_month,
          hour: form.hour,
          minute: form.minute,
          timezone: form.timezone,
          updated_by: u.user?.id ?? null,
        })
        .eq("id", form.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Schedule saved");
      qc.invalidateQueries({ queryKey: ["report-schedule"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Failed to save"),
  });

  if (roleLoading || isLoading || !form) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  const nextRun = describeNext(form);

  return (
    <div className="container mx-auto px-4 py-10 max-w-3xl">
      <Link to="/admin" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to admin
      </Link>

      <div className="mt-4 flex items-start gap-3">
        <div className="rounded-xl bg-primary/10 p-3 text-primary">
          <CalendarClock className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-3xl font-display font-bold">Monthly report schedule</h1>
          <p className="text-muted-foreground mt-1">
            Configure the exact day and time each month the branded PDF report is generated and emailed to all admins.
          </p>
        </div>
      </div>

      {!canEdit && (
        <div className="mt-6 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm">
          You can view the schedule. Only super admins can change it.
        </div>
      )}

      <div className="mt-6 rounded-xl border bg-card p-6 space-y-6">
        <label className="flex items-center justify-between gap-4">
          <div>
            <div className="font-medium">Enable monthly delivery</div>
            <div className="text-sm text-muted-foreground">
              When on, admins receive the PDF report at the configured time each month.
            </div>
          </div>
          <input
            type="checkbox"
            className="h-5 w-5"
            checked={form.enabled}
            disabled={!canEdit}
            onChange={(e) => setForm({ ...form, enabled: e.target.checked })}
          />
        </label>

        <div className="grid gap-4 md:grid-cols-3">
          <Field label="Day of month">
            <select
              className="w-full rounded-md border bg-background px-3 py-2"
              value={form.day_of_month}
              disabled={!canEdit}
              onChange={(e) => setForm({ ...form, day_of_month: Number(e.target.value) })}
            >
              {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
            <p className="mt-1 text-xs text-muted-foreground">1–28 to cover every month.</p>
          </Field>

          <Field label="Hour (24h)">
            <select
              className="w-full rounded-md border bg-background px-3 py-2"
              value={form.hour}
              disabled={!canEdit}
              onChange={(e) => setForm({ ...form, hour: Number(e.target.value) })}
            >
              {Array.from({ length: 24 }, (_, i) => i).map((h) => (
                <option key={h} value={h}>{String(h).padStart(2, "0")}</option>
              ))}
            </select>
          </Field>

          <Field label="Minute">
            <select
              className="w-full rounded-md border bg-background px-3 py-2"
              value={form.minute}
              disabled={!canEdit}
              onChange={(e) => setForm({ ...form, minute: Number(e.target.value) })}
            >
              {[0, 5, 10, 15, 20, 30, 45].map((m) => (
                <option key={m} value={m}>{String(m).padStart(2, "0")}</option>
              ))}
            </select>
          </Field>
        </div>

        <Field label="Timezone">
          <select
            className="w-full rounded-md border bg-background px-3 py-2"
            value={form.timezone}
            disabled={!canEdit}
            onChange={(e) => setForm({ ...form, timezone: e.target.value })}
          >
            {TIMEZONES.map((tz) => (
              <option key={tz} value={tz}>{tz}</option>
            ))}
          </select>
        </Field>

        <div className="rounded-lg bg-muted/50 p-4 text-sm">
          <div className="font-medium">Next scheduled run</div>
          <div className="text-muted-foreground mt-1">{nextRun}</div>
          {form.last_run_at && (
            <div className="text-muted-foreground mt-2">
              Last run: {new Date(form.last_run_at).toLocaleString()} — {form.last_run_status ?? "unknown"}
            </div>
          )}
        </div>

        {canEdit && (
          <div className="flex justify-end">
            <button
              onClick={() => save.mutate()}
              disabled={save.isPending}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 text-primary-foreground font-medium hover:opacity-90 disabled:opacity-60"
            >
              {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save schedule
            </button>
          </div>
        )}
      </div>

      <div className="mt-6 rounded-xl border bg-card p-6 text-sm">
        <div className="flex items-center gap-2 font-medium">
          <CheckCircle2 className="h-4 w-4 text-primary" /> How it works
        </div>
        <ul className="mt-2 space-y-1.5 text-muted-foreground list-disc list-inside">
          <li>On the chosen day and time, the system generates the branded PDF monthly report.</li>
          <li>The PDF is emailed to every user with an admin role (super admin, treasurer, secretary, project manager).</li>
          <li>Email delivery activates once your sender domain is verified in Cloud → Emails.</li>
        </ul>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="text-sm font-medium mb-1.5">{label}</div>
      {children}
    </label>
  );
}

function describeNext(s: Settings): string {
  if (!s.enabled) return "Disabled — enable to schedule monthly delivery.";
  const now = new Date();
  const target = new Date(now.getFullYear(), now.getMonth(), s.day_of_month, s.hour, s.minute, 0);
  if (target <= now) target.setMonth(target.getMonth() + 1);
  const time = `${String(s.hour).padStart(2, "0")}:${String(s.minute).padStart(2, "0")}`;
  return `Day ${s.day_of_month} of each month at ${time} (${s.timezone}). Next: ${target.toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" })} ~ ${time}.`;
}
