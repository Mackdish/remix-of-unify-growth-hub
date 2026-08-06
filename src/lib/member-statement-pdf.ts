import type jsPDF from "jspdf";
import { CAT_LABEL, fmtKsh } from "./report-pdf";

export type StatementTxn = {
  id: string;
  category: string;
  amount: number;
  transaction_date: string;
  description: string | null;
  reference: string | null;
};

export type StatementLoan = {
  amount: number;
  purpose: string;
  status: string;
  due_date: string | null;
  created_at: string;
};

/** Builds a branded personal statement PDF for a single member. */
export async function buildMemberStatementPdf(opts: {
  memberName: string;
  memberCode: string;
  txns: StatementTxn[];
  loans: StatementLoan[];
  groupName?: string;
}): Promise<jsPDF> {
  const { jsPDF: JsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;
  const doc = new JsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
  const green: [number, number, number] = [20, 83, 45];
  const gold: [number, number, number] = [193, 154, 46];
  const name = opts.groupName ?? "Unify Youth Group";

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
  doc.text(`Member Statement — ${opts.memberName} (${opts.memberCode})`, 40, 74);

  doc.setTextColor(70, 70, 70);
  doc.setFontSize(9);
  doc.text(`Generated: ${new Date().toLocaleString("en-KE")}`, 40, 104);
  doc.text(`Entries: ${opts.txns.length}`, 40, 118);

  const totals: Record<string, number> = {};
  opts.txns.forEach((t) => {
    totals[t.category] = (totals[t.category] ?? 0) + Number(t.amount);
  });
  const loanOutstanding = (totals.loan_disbursement ?? 0) - (totals.loan_repayment ?? 0);
  const grand =
    (totals.monthly_contribution ?? 0) +
    (totals.account_boosting ?? 0) +
    (totals.fine ?? 0) +
    loanOutstanding +
    (totals.shirts_loan ?? 0) +
    (totals.interest ?? 0) +
    (totals.due ?? 0) +
    (totals.penalty ?? 0);

  const last = (fallback: number) =>
    (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? fallback;

  let y = 136;
  autoTable(doc, {
    startY: y,
    head: [["Total balance", "Contributions", "Loan outstanding", "Fines", "Penalties", "Dues"]],
    body: [[
      fmtKsh(grand),
      fmtKsh(totals.monthly_contribution ?? 0),
      fmtKsh(loanOutstanding),
      fmtKsh(totals.fine ?? 0),
      fmtKsh(totals.penalty ?? 0),
      fmtKsh(totals.due ?? 0),
    ]],
    styles: { fontSize: 8, halign: "center" },
    headStyles: { fillColor: green, textColor: 255 },
    theme: "grid",
  });
  y = last(y) + 22;

  doc.setFontSize(11);
  doc.setTextColor(...green);
  doc.text("Category breakdown", 40, y);
  y += 8;
  autoTable(doc, {
    startY: y,
    head: [["Category", "Entries", "Amount"]],
    body: Object.keys(CAT_LABEL).map((k) => [
      CAT_LABEL[k],
      String(opts.txns.filter((t) => t.category === k).length),
      fmtKsh(totals[k] ?? 0),
    ]),
    styles: { fontSize: 8 },
    columnStyles: { 1: { halign: "right" }, 2: { halign: "right" } },
    headStyles: { fillColor: green, textColor: 255 },
    alternateRowStyles: { fillColor: [245, 245, 240] },
    theme: "striped",
  });
  y = last(y) + 22;

  if (opts.loans.length) {
    doc.setFontSize(11);
    doc.setTextColor(...green);
    doc.text("Loans", 40, y);
    y += 8;
    autoTable(doc, {
      startY: y,
      head: [["Requested", "Amount", "Purpose", "Status", "Due date"]],
      body: opts.loans.map((l) => [
        l.created_at.slice(0, 10),
        fmtKsh(Number(l.amount)),
        l.purpose,
        l.status,
        l.due_date ?? "—",
      ]),
      styles: { fontSize: 8 },
      columnStyles: { 1: { halign: "right" } },
      headStyles: { fillColor: green, textColor: 255 },
      alternateRowStyles: { fillColor: [245, 245, 240] },
      theme: "striped",
    });
    y = last(y) + 22;
  }

  doc.setFontSize(11);
  doc.setTextColor(...green);
  doc.text("Transaction history", 40, y);
  y += 8;
  autoTable(doc, {
    startY: y,
    head: [["Date", "Category", "Description", "Amount"]],
    body: opts.txns.map((t) => [
      t.transaction_date,
      CAT_LABEL[t.category] ?? t.category,
      t.description ?? "—",
      fmtKsh(Number(t.amount)),
    ]),
    styles: { fontSize: 8 },
    columnStyles: { 3: { halign: "right" } },
    headStyles: { fillColor: green, textColor: 255 },
    alternateRowStyles: { fillColor: [245, 245, 240] },
    theme: "striped",
    didDrawPage: () => {
      const h = doc.internal.pageSize.getHeight();
      doc.setFontSize(8);
      doc.setTextColor(140, 140, 140);
      doc.text(`${name} · Personal statement — confidential`, 40, h - 20);
    },
  });

  return doc;
}
