import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useNavigate } from "@tanstack/react-router";
import {
  ShieldCheck,
  ArrowLeft,
  Download,
  FileBarChart,
  Wallet,
  AlertTriangle,
  TrendingUp,
  Users,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/reports")({
  head: () => ({
    meta: [
      { title: "Reports — Unify Youth Group" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ReportsPage,
});

const CAT_LABEL: Record<string, string> = {
  monthly_contribution: "Monthly contribution",
  account_boosting: "Account boosting",
  fine: "Fine",
  loan_disbursement: "Loan disbursement",
  loan_repayment: "Loan repayment",
  shirts_loan: "Shirts loan",
  interest: "Interest",
  due: "Due",
  penalty: "Penalty",
  other: "Other",
};

const fmt = (n: number) =>
  `KSh ${Number(n).toLocaleString("en-KE", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

type ReportKey =
  | "monthly"
  | "contributions"
  | "loans"
  | "pending_loans"
  | "penalties"
  | "fines"
  | "shirts_loans"
  | "dues"
  | "interest"
  | "boosting"
  | "other"
  | "member_balances";

const REPORTS: { key: ReportKey; label: string; description: string; icon: React.ReactNode }[] = [
  { key: "monthly", label: "Monthly summary", description: "All categories grouped by month", icon: <FileBarChart className="h-4 w-4" /> },
  { key: "contributions", label: "Total contributions", description: "Monthly contributions per member", icon: <Wallet className="h-4 w-4" /> },
  { key: "loans", label: "Loans (all)", description: "Disbursements vs repayments per member", icon: <TrendingUp className="h-4 w-4" /> },
  { key: "pending_loans", label: "Pending loans", description: "Members with outstanding loan balances", icon: <AlertTriangle className="h-4 w-4" /> },
  { key: "penalties", label: "Penalties", description: "Penalty charges per member", icon: <AlertTriangle className="h-4 w-4" /> },
  { key: "fines", label: "Fines", description: "Fines charged per member", icon: <AlertTriangle className="h-4 w-4" /> },
  { key: "shirts_loans", label: "Shirts loans", description: "Shirts loans per member", icon: <Wallet className="h-4 w-4" /> },
  { key: "dues", label: "Dues", description: "Dues per member", icon: <Wallet className="h-4 w-4" /> },
  { key: "interest", label: "Interest", description: "Interest earned/charged per member", icon: <TrendingUp className="h-4 w-4" /> },
  { key: "boosting", label: "Account boosting", description: "Account boosting entries per member", icon: <TrendingUp className="h-4 w-4" /> },
  { key: "other", label: "Other entries", description: "Miscellaneous transactions", icon: <FileBarChart className="h-4 w-4" /> },
  { key: "member_balances", label: "Member balances", description: "Net position across all categories per member", icon: <Users className="h-4 w-4" /> },
];

function ReportsPage() {
  const navigate = useNavigate();
  const [active, setActive] = useState<ReportKey>("monthly");
  const today = new Date();
  const [from, setFrom] = useState(new Date(today.getFullYear(), 0, 1).toISOString().slice(0, 10));
  const [to, setTo] = useState(today.toISOString().slice(0, 10));

  const { data: isAdmin, isLoading: checking } = useQuery({
    queryKey: ["is-admin"],
    queryFn: async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) return false;
      const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", data.user.id);
      return (roles ?? []).some((r: { role: string }) =>
        ["super_admin", "treasurer", "secretary", "project_manager"].includes(r.role),
      );
    },
  });

  useEffect(() => {
    if (!checking && isAdmin === false) {
      toast.error("Admin access required");
      navigate({ to: "/dashboard" });
    }
  }, [isAdmin, checking, navigate]);

  const { data: members } = useQuery({
    queryKey: ["report-members"],
    queryFn: async () => {
      const { data, error } = await supabase.from("members").select("id, member_code, full_name").order("member_code");
      if (error) throw error;
      return data;
    },
    enabled: !!isAdmin,
  });

  const { data: txns } = useQuery({
    queryKey: ["report-txns", from, to],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transactions")
        .select("id, member_id, category, amount, transaction_date, description, reference")
        .gte("transaction_date", from)
        .lte("transaction_date", to)
        .order("transaction_date", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!isAdmin,
  });

  const memberMap = useMemo(
    () => Object.fromEntries((members ?? []).map((m) => [m.id, m])),
    [members],
  );

  const report = useMemo(() => buildReport(active, txns ?? [], memberMap), [active, txns, memberMap]);

  const exportCsv = () => {
    if (!report.rows.length) return toast.error("Nothing to export");
    const headers = report.columns.map((c) => c.label);
    const csv = [
      headers.join(","),
      ...report.rows.map((r) =>
        report.columns
          .map((c) => {
            const v = r[c.key];
            const s = v == null ? "" : String(v);
            return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
          })
          .join(","),
      ),
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `unify-${active}-${from}-to-${to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportPdf = async () => {
    if (!report.rows.length) return toast.error("Nothing to export");
    const { jsPDF } = await import("jspdf");
    const autoTable = (await import("jspdf-autotable")).default;
    const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
    const label = REPORTS.find((r) => r.key === active)?.label ?? "Report";
    doc.setFontSize(16);
    doc.setTextColor(20, 83, 45);
    doc.text("Unify Youth Group", 40, 40);
    doc.setFontSize(12);
    doc.setTextColor(60, 60, 60);
    doc.text(label, 40, 60);
    doc.setFontSize(9);
    doc.text(`Period: ${from} to ${to}`, 40, 76);
    doc.text(`Generated: ${new Date().toLocaleString("en-KE")}`, 40, 90);

    let startY = 110;
    if (report.summary.length) {
      autoTable(doc, {
        startY,
        head: [report.summary.map((s) => s.label)],
        body: [report.summary.map((s) => s.value)],
        styles: { fontSize: 9 },
        headStyles: { fillColor: [20, 83, 45] },
        theme: "grid",
      });
      const anyDoc = doc as unknown as { lastAutoTable?: { finalY: number } };
      startY = (anyDoc.lastAutoTable?.finalY ?? startY) + 16;
    }

    autoTable(doc, {
      startY,
      head: [report.columns.map((c) => c.label)],
      body: report.rows.map((r) =>
        report.columns.map((c) => {
          const v = r[c.key];
          if (c.format === "money") return fmt(Number(v ?? 0));
          return v == null ? "-" : String(v);
        }),
      ),
      styles: { fontSize: 8, cellPadding: 4 },
      headStyles: { fillColor: [20, 83, 45], textColor: 255 },
      alternateRowStyles: { fillColor: [245, 245, 240] },
      theme: "striped",
    });

    doc.save(`unify-${active}-${from}-to-${to}.pdf`);
  };

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
          <h1 className="mt-1 text-3xl md:text-4xl text-foreground">Reports</h1>
          <p className="text-sm text-muted-foreground mt-1">Generate financial and member reports across any date range.</p>
        </div>
        <Link to="/admin" className="btn-outline"><ArrowLeft className="h-4 w-4" /> Admin dashboard</Link>
      </div>

      {/* Report picker */}
      <div className="mt-6 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
        {REPORTS.map((r) => (
          <button
            key={r.key}
            onClick={() => setActive(r.key)}
            className={`text-left rounded-lg border p-3 transition-colors ${
              active === r.key
                ? "border-primary bg-primary/5"
                : "border-border bg-card hover:border-primary/40"
            }`}
          >
            <div className="flex items-center gap-2 text-primary text-sm font-semibold">
              {r.icon} {r.label}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{r.description}</p>
          </button>
        ))}
      </div>

      {/* Filters + Export */}
      <div className="mt-6 flex flex-wrap gap-3 items-end justify-between">
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="text-xs text-muted-foreground">From</label>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="mt-1 rounded-lg border border-input bg-background px-3 py-2 text-sm block" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">To</label>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="mt-1 rounded-lg border border-input bg-background px-3 py-2 text-sm block" />
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={exportCsv} className="btn-outline !py-2 !px-4 text-sm">
            <Download className="h-4 w-4" /> CSV
          </button>
          <button onClick={exportPdf} className="btn-primary !py-2 !px-4 text-sm">
            <Download className="h-4 w-4" /> PDF
          </button>
        </div>
      </div>

      {/* Summary line */}
      {report.summary.length > 0 && (
        <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
          {report.summary.map((s) => (
            <div key={s.label} className="rounded-lg bg-card border border-border p-3 shadow-[var(--shadow-soft)]">
              <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{s.label}</div>
              <div className="mt-1 text-lg font-semibold text-foreground">{s.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Report table */}
      <div className="mt-6 rounded-2xl bg-card border border-border overflow-hidden shadow-[var(--shadow-soft)]">
        <div className="px-5 py-4 border-b border-border">
          <h2 className="text-lg font-semibold text-foreground">
            {REPORTS.find((r) => r.key === active)?.label}
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {from} → {to} · {report.rows.length} row{report.rows.length === 1 ? "" : "s"}
          </p>
        </div>
        {report.rows.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">No data for this range.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-secondary text-left text-xs uppercase tracking-wide">
                <tr>
                  {report.columns.map((c) => (
                    <th key={c.key} className={`px-4 py-3 ${c.align === "right" ? "text-right" : ""}`}>{c.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {report.rows.map((r, i) => (
                  <tr key={i} className="hover:bg-secondary/40">
                    {report.columns.map((c) => (
                      <td key={c.key} className={`px-4 py-3 ${c.align === "right" ? "text-right font-semibold" : "text-muted-foreground"}`}>
                        {c.format === "money" ? fmt(Number(r[c.key] ?? 0)) : (r[c.key] ?? "—")}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ============ Report builder ============
type Txn = {
  id: string;
  member_id: string;
  category: string;
  amount: number;
  transaction_date: string;
  description: string | null;
  reference: string | null;
};
type Col = { key: string; label: string; align?: "right"; format?: "money" };
type Row = Record<string, string | number | null>;
type Report = { columns: Col[]; rows: Row[]; summary: { label: string; value: string }[] };

function buildReport(
  key: ReportKey,
  txns: Txn[],
  memberMap: Record<string, { member_code: string; full_name: string } | undefined>,
): Report {
  const byCategory = (cat: string) => txns.filter((t) => t.category === cat);
  const perMember = (list: Txn[]) => {
    const map: Record<string, number> = {};
    list.forEach((t) => {
      map[t.member_id] = (map[t.member_id] ?? 0) + Number(t.amount);
    });
    return Object.entries(map)
      .map(([mid, total]) => {
        const m = memberMap[mid];
        return { code: m?.member_code ?? "—", name: m?.full_name ?? "—", total };
      })
      .sort((a, b) => b.total - a.total);
  };
  const memberCols: Col[] = [
    { key: "code", label: "Code" },
    { key: "name", label: "Member" },
    { key: "total", label: "Amount", align: "right", format: "money" },
  ];
  const totalOf = (list: Txn[]) => list.reduce((s, t) => s + Number(t.amount), 0);

  switch (key) {
    case "monthly": {
      const byMonth: Record<string, Record<string, number>> = {};
      txns.forEach((t) => {
        const m = t.transaction_date.slice(0, 7);
        byMonth[m] = byMonth[m] ?? {};
        byMonth[m][t.category] = (byMonth[m][t.category] ?? 0) + Number(t.amount);
      });
      const cats = Array.from(new Set(txns.map((t) => t.category)));
      const columns: Col[] = [
        { key: "month", label: "Month" },
        ...cats.map((c) => ({ key: c, label: CAT_LABEL[c] ?? c, align: "right" as const, format: "money" as const })),
        { key: "total", label: "Total", align: "right", format: "money" },
      ];
      const rows: Row[] = Object.entries(byMonth)
        .sort((a, b) => (a[0] < b[0] ? 1 : -1))
        .map(([month, m]) => {
          const row: Row = { month };
          let total = 0;
          cats.forEach((c) => {
            row[c] = m[c] ?? 0;
            total += m[c] ?? 0;
          });
          row.total = total;
          return row;
        });
      return {
        columns,
        rows,
        summary: [
          { label: "Total value", value: fmt(totalOf(txns)) },
          { label: "Months", value: String(rows.length) },
          { label: "Transactions", value: String(txns.length) },
        ],
      };
    }
    case "contributions": {
      const list = byCategory("monthly_contribution");
      return {
        columns: memberCols,
        rows: perMember(list),
        summary: [{ label: "Total contributions", value: fmt(totalOf(list)) }, { label: "Entries", value: String(list.length) }],
      };
    }
    case "loans": {
      const disb = byCategory("loan_disbursement");
      const rep = byCategory("loan_repayment");
      const map: Record<string, { d: number; r: number }> = {};
      disb.forEach((t) => {
        map[t.member_id] = map[t.member_id] ?? { d: 0, r: 0 };
        map[t.member_id].d += Number(t.amount);
      });
      rep.forEach((t) => {
        map[t.member_id] = map[t.member_id] ?? { d: 0, r: 0 };
        map[t.member_id].r += Number(t.amount);
      });
      const rows: Row[] = Object.entries(map).map(([mid, v]) => {
        const m = memberMap[mid];
        return { code: m?.member_code ?? "—", name: m?.full_name ?? "—", disbursed: v.d, repaid: v.r, outstanding: v.d - v.r };
      }).sort((a, b) => Number(b.outstanding) - Number(a.outstanding));
      return {
        columns: [
          { key: "code", label: "Code" },
          { key: "name", label: "Member" },
          { key: "disbursed", label: "Disbursed", align: "right", format: "money" },
          { key: "repaid", label: "Repaid", align: "right", format: "money" },
          { key: "outstanding", label: "Outstanding", align: "right", format: "money" },
        ],
        rows,
        summary: [
          { label: "Total disbursed", value: fmt(totalOf(disb)) },
          { label: "Total repaid", value: fmt(totalOf(rep)) },
          { label: "Total outstanding", value: fmt(totalOf(disb) - totalOf(rep)) },
        ],
      };
    }
    case "pending_loans": {
      const disb = byCategory("loan_disbursement");
      const rep = byCategory("loan_repayment");
      const map: Record<string, { d: number; r: number }> = {};
      disb.forEach((t) => {
        map[t.member_id] = map[t.member_id] ?? { d: 0, r: 0 };
        map[t.member_id].d += Number(t.amount);
      });
      rep.forEach((t) => {
        map[t.member_id] = map[t.member_id] ?? { d: 0, r: 0 };
        map[t.member_id].r += Number(t.amount);
      });
      const rows: Row[] = Object.entries(map)
        .map(([mid, v]) => {
          const m = memberMap[mid];
          return { code: m?.member_code ?? "—", name: m?.full_name ?? "—", outstanding: v.d - v.r };
        })
        .filter((r) => Number(r.outstanding) > 0)
        .sort((a, b) => Number(b.outstanding) - Number(a.outstanding));
      return {
        columns: [
          { key: "code", label: "Code" },
          { key: "name", label: "Member" },
          { key: "outstanding", label: "Outstanding", align: "right", format: "money" },
        ],
        rows,
        summary: [
          { label: "Members with pending", value: String(rows.length) },
          { label: "Total pending", value: fmt(rows.reduce((s, r) => s + Number(r.outstanding), 0)) },
        ],
      };
    }
    case "penalties":
      return simpleCategory("penalty", txns, memberMap);
    case "fines":
      return simpleCategory("fine", txns, memberMap);
    case "shirts_loans":
      return simpleCategory("shirts_loan", txns, memberMap);
    case "dues":
      return simpleCategory("due", txns, memberMap);
    case "interest":
      return simpleCategory("interest", txns, memberMap);
    case "boosting":
      return simpleCategory("account_boosting", txns, memberMap);
    case "other":
      return simpleCategory("other", txns, memberMap);
    case "member_balances": {
      const map: Record<string, number> = {};
      txns.forEach((t) => {
        map[t.member_id] = (map[t.member_id] ?? 0) + Number(t.amount);
      });
      const rows: Row[] = Object.entries(map)
        .map(([mid, total]) => {
          const m = memberMap[mid];
          return { code: m?.member_code ?? "—", name: m?.full_name ?? "—", total };
        })
        .sort((a, b) => Number(b.total) - Number(a.total));
      return {
        columns: memberCols,
        rows,
        summary: [{ label: "Group total", value: fmt(totalOf(txns)) }, { label: "Members", value: String(rows.length) }],
      };
    }
  }
}

function simpleCategory(
  cat: string,
  txns: Txn[],
  memberMap: Record<string, { member_code: string; full_name: string } | undefined>,
): Report {
  const list = txns.filter((t) => t.category === cat);
  const map: Record<string, number> = {};
  list.forEach((t) => {
    map[t.member_id] = (map[t.member_id] ?? 0) + Number(t.amount);
  });
  const rows: Row[] = Object.entries(map)
    .map(([mid, total]) => {
      const m = memberMap[mid];
      return { code: m?.member_code ?? "—", name: m?.full_name ?? "—", total };
    })
    .sort((a, b) => Number(b.total) - Number(a.total));
  return {
    columns: [
      { key: "code", label: "Code" },
      { key: "name", label: "Member" },
      { key: "total", label: "Amount", align: "right", format: "money" },
    ],
    rows,
    summary: [
      { label: `Total ${CAT_LABEL[cat] ?? cat}`, value: fmt(list.reduce((s, t) => s + Number(t.amount), 0)) },
      { label: "Entries", value: String(list.length) },
    ],
  };
}
