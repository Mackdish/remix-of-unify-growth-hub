import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useRequirePermission } from "@/hooks/use-permissions";
import { toast } from "sonner";
import { ShieldCheck, ArrowLeft, Download, RefreshCw, FileText, Loader2 } from "lucide-react";
import { buildMonthlyReportPdf, monthRange, monthLabel } from "@/lib/report-pdf";

export const Route = createFileRoute("/_authenticated/admin/report-preview")({
  head: () => ({
    meta: [
      { title: "Monthly report preview — Unify Youth Group" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ReportPreviewPage,
});

function defaultMonth() {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - 1);
  return d.toISOString().slice(0, 7);
}

function ReportPreviewPage() {
  const navigate = useNavigate();
  const [month, setMonth] = useState(defaultMonth());
  const [url, setUrl] = useState<string | null>(null);
  const [building, setBuilding] = useState(false);

  const { can, allowed, loading: checking } = useRequirePermission("view_reports");
  const isAdmin = allowed;

  const generate = async () => {
    setBuilding(true);
    try {
      const { from, to } = monthRange(month);
      const [{ data: txns, error: te }, { data: members, error: me }] = await Promise.all([
        supabase
          .from("transactions")
          .select("member_id, category, amount, transaction_date")
          .gte("transaction_date", from)
          .lte("transaction_date", to),
        supabase.from("members").select("id, member_code, full_name").order("member_code"),
      ]);
      if (te) throw te;
      if (me) throw me;
      const doc = await buildMonthlyReportPdf({
        month,
        txns: (txns ?? []).map((t) => ({ ...t, amount: Number(t.amount) })),
        members: members ?? [],
      });
      const blob = doc.output("blob");
      setUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return URL.createObjectURL(blob);
      });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBuilding(false);
    }
  };

  useEffect(() => {
    if (isAdmin) void generate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, month]);

  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);

  if (checking || !isAdmin) {
    return <div className="container-page py-24 text-center text-muted-foreground">Checking access…</div>;
  }

  return (
    <div className="container-page py-10">
      <div className="flex flex-wrap justify-between items-center gap-3">
        <div>
          <div className="flex items-center gap-2 text-xs text-primary-glow font-semibold uppercase tracking-widest">
            <ShieldCheck className="h-4 w-4" /> Admin
          </div>
          <h1 className="mt-1 text-3xl md:text-4xl text-foreground">Monthly report preview</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Exactly what admins receive by email — review it before it goes out.
          </p>
        </div>
        <Link to="/admin" className="btn-outline"><ArrowLeft className="h-4 w-4" /> Admin dashboard</Link>
      </div>

      <div className="mt-6 flex flex-wrap items-end gap-3 justify-between">
        <div>
          <label className="text-xs text-muted-foreground">Report month</label>
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="mt-1 block rounded-lg border border-input bg-background px-3 py-2 text-sm"
          />
        </div>
        <div className="flex gap-2">
          <button onClick={() => void generate()} disabled={building} className="btn-outline !py-2 !px-4 text-sm disabled:opacity-60">
            {building ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Rebuild
          </button>
          <a
            href={url ?? "#"}
            download={`unify-monthly-report-${month}.pdf`}
            aria-disabled={!url}
            className={`btn-primary !py-2 !px-4 text-sm ${url ? "" : "pointer-events-none opacity-60"}`}
          >
            <Download className="h-4 w-4" /> Download PDF
          </a>
        </div>
      </div>

      <div className="mt-6 rounded-2xl bg-card border border-border overflow-hidden shadow-[var(--shadow-soft)]">
        <div className="px-5 py-4 border-b border-border flex items-center gap-2">
          <FileText className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold text-foreground">{monthLabel(month)} report</h2>
        </div>
        {building && !url ? (
          <div className="p-16 text-center text-sm text-muted-foreground">Building preview…</div>
        ) : url ? (
          <iframe title="Monthly report preview" src={url} className="w-full h-[80vh] bg-muted" />
        ) : (
          <div className="p-16 text-center text-sm text-muted-foreground">No preview yet.</div>
        )}
      </div>

      <p className="mt-3 text-xs text-muted-foreground">
        If the embedded viewer is blocked on your device, use “Download PDF” to open it locally.
      </p>
    </div>
  );
}
