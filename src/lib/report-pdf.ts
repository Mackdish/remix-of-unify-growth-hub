import type { jsPDF } from "jspdf";

export type ReportTxn = {
  member_id: string;
  category: string;
  amount: number;
  transaction_date: string;
};

export type ReportMember = { id: string; member_code: string; full_name: string };

export const CAT_LABEL: Record<string, string> = {
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

export const fmtKsh = (n: number) =>
  `KSh ${Number(n).toLocaleString("en-KE", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

export function monthRange(month: string) {
  // month = "YYYY-MM"
  const [y, m] = month.split("-").map(Number);
  const from = new Date(Date.UTC(y, m - 1, 1)).toISOString().slice(0, 10);
  const to = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
  return { from, to };
}

export function monthLabel(month: string) {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-KE", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** Builds the branded monthly report PDF and returns the jsPDF document. */
export async function buildMonthlyReportPdf(opts: {
  month: string;
  txns: ReportTxn[];
  members: ReportMember[];
  groupName?: string;
}): Promise<jsPDF> {
  const { jsPDF: JsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;
  const doc = new JsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
  const green: [number, number, number] = [20, 83, 45];
  const gold: [number, number, number] = [193, 154, 46];

  const { txns, members, month } = opts;
  const name = opts.groupName ?? "Unify Youth Group";

  // Header band
  doc.setFillColor(...green);
  doc.rect(0, 0, doc.internal.pageSize.getWidth(), 84, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.text(name, 40, 40);
  doc.setFontSize(10);
  doc.setTextColor(232, 226, 205);
  doc.text("Wote · Makueni · Kenya", 40, 58);
  doc.setFontSize(12);
  doc.setTextColor(...gold);
  doc.text(`Monthly Financial Report — ${monthLabel(month)}`, 40, 74);

  doc.setTextColor(70, 70, 70);
  doc.setFontSize(9);
  doc.text(`Generated: ${new Date().toLocaleString("en-KE")}`, 40, 104);
  doc.text(`Transactions: ${txns.length}`, 40, 118);

  const totals: Record<string, number> = {};
  let grand = 0;
  txns.forEach((t) => {
    const amt = Number(t.amount);
    totals[t.category] = (totals[t.category] ?? 0) + amt;
    grand += amt;
  });
  const outstanding = (totals.loan_disbursement ?? 0) - (totals.loan_repayment ?? 0);

  let y = 136;
  autoTable(doc, {
    startY: y,
    head: [["Total value", "Contributions", "Loans disbursed", "Loans repaid", "Net loan movement"]],
    body: [[
      fmtKsh(grand),
      fmtKsh(totals.monthly_contribution ?? 0),
      fmtKsh(totals.loan_disbursement ?? 0),
      fmtKsh(totals.loan_repayment ?? 0),
      fmtKsh(outstanding),
    ]],
    styles: { fontSize: 8, halign: "center" },
    headStyles: { fillColor: green, textColor: 255 },
    theme: "grid",
  });
  const last = () => (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y;
  y = last() + 22;

  // Category breakdown
  doc.setFontSize(11);
  doc.setTextColor(...green);
  doc.text("Category breakdown", 40, y);
  y += 8;
  autoTable(doc, {
    startY: y,
    head: [["Category", "Entries", "Amount"]],
    body: Object.keys(CAT_LABEL).map((k) => [
      CAT_LABEL[k],
      String(txns.filter((t) => t.category === k).length),
      fmtKsh(totals[k] ?? 0),
    ]),
    styles: { fontSize: 8 },
    columnStyles: { 1: { halign: "right" }, 2: { halign: "right" } },
    headStyles: { fillColor: green, textColor: 255 },
    alternateRowStyles: { fillColor: [245, 245, 240] },
    theme: "striped",
  });
  y = last() + 22;

  // Per member
  const memberMap = Object.fromEntries(members.map((m) => [m.id, m]));
  const perMember: Record<string, { contrib: number; loans: number; repaid: number; total: number }> = {};
  txns.forEach((t) => {
    const row = (perMember[t.member_id] ??= { contrib: 0, loans: 0, repaid: 0, total: 0 });
    const amt = Number(t.amount);
    if (t.category === "monthly_contribution") row.contrib += amt;
    if (t.category === "loan_disbursement") row.loans += amt;
    if (t.category === "loan_repayment") row.repaid += amt;
    row.total += amt;
  });

  doc.setFontSize(11);
  doc.setTextColor(...green);
  doc.text("Member activity", 40, y);
  y += 8;
  autoTable(doc, {
    startY: y,
    head: [["Code", "Member", "Contributions", "Loans out", "Repaid", "Total"]],
    body: Object.entries(perMember)
      .sort((a, b) => b[1].total - a[1].total)
      .map(([mid, v]) => [
        memberMap[mid]?.member_code ?? "—",
        memberMap[mid]?.full_name ?? "—",
        fmtKsh(v.contrib),
        fmtKsh(v.loans),
        fmtKsh(v.repaid),
        fmtKsh(v.total),
      ]),
    styles: { fontSize: 8 },
    columnStyles: { 2: { halign: "right" }, 3: { halign: "right" }, 4: { halign: "right" }, 5: { halign: "right" } },
    headStyles: { fillColor: green, textColor: 255 },
    alternateRowStyles: { fillColor: [245, 245, 240] },
    theme: "striped",
    didDrawPage: () => {
      const h = doc.internal.pageSize.getHeight();
      doc.setFontSize(8);
      doc.setTextColor(140, 140, 140);
      doc.text(`${name} · Confidential — for members and officials only`, 40, h - 20);
    },
  });

  return doc;
}
