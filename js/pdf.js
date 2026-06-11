/* pdf.js — builds a polished A4 PDF from parsed invoice data.
 * Dependency-injected jsPDF so the same code runs in browser (UMD) and node (tests). */

import {
  L, TIPO_DOCUMENTO, REGIME_FISCALE, MODALITA_PAGAMENTO,
  CONDIZIONI_PAGAMENTO, NATURA, ESIGIBILITA, codeLabel,
} from "./i18n.js";

const INK = [22, 36, 46];
const TEAL = [14, 124, 102];
const TEAL_SOFT = [232, 242, 239];
const GRAY = [104, 119, 126];
const HAIR = [205, 214, 212];
const PAPER_ROW = [244, 248, 246];

const M = 16;            // page margin (mm)
const PW = 210, PH = 297; // A4

function fmtMoney(v, lang, currency) {
  if (v === null || v === undefined) return "";
  try {
    return new Intl.NumberFormat(lang === "it" ? "it-IT" : "en-GB", {
      style: "currency", currency: currency || "EUR",
    }).format(v);
  } catch {
    return v.toFixed(2);
  }
}

function fmtNum(v, lang) {
  if (v === null || v === undefined) return "";
  return new Intl.NumberFormat(lang === "it" ? "it-IT" : "en-GB", {
    maximumFractionDigits: 4,
  }).format(v);
}

function fmtDate(iso, lang) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return lang === "it" ? `${d}/${m}/${y}` : `${d} ${["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][+m - 1]} ${y}`;
}

function partyBlock(doc, x, y, w, title, party, lang) {
  const t = L[lang];
  // Card: soft background + teal left bar
  const lines = [];
  if (party.name) lines.push({ text: party.name, bold: true, size: 10.5 });
  if (party.address) {
    const a = party.address;
    if (a.street) lines.push({ text: a.street });
    const cityLine = [a.zip, a.city, a.province ? `(${a.province})` : "", a.country !== "IT" ? a.country : ""]
      .filter(Boolean).join(" ");
    if (cityLine) lines.push({ text: cityLine });
  }
  if (party.vat) lines.push({ text: `${t.vatNumber}: ${party.vat}` });
  if (party.fiscalCode && party.fiscalCode !== party.vat.replace(/^IT/, ""))
    lines.push({ text: `${t.fiscalCode}: ${party.fiscalCode}` });
  if (party.taxRegime)
    lines.push({ text: `${t.taxRegime}: ${codeLabel(REGIME_FISCALE, party.taxRegime, lang)}`, wrap: true });
  if (party.rea) lines.push({ text: `${t.rea}: ${party.rea}` });
  if (party.phone) lines.push({ text: `${t.phone}: ${party.phone}` });
  if (party.email) lines.push({ text: `${t.email}: ${party.email}` });

  // Measure height
  doc.setFont("helvetica", "normal");
  let h = 9; // title strip + padding
  const wrapped = lines.map((ln) => {
    doc.setFontSize(ln.size || 8.5);
    const parts = doc.splitTextToSize(ln.text, w - 9);
    h += parts.length * (ln.bold ? 4.6 : 4.0) + (ln.bold ? 1 : 0);
    return { ...ln, parts };
  });
  h += 3;

  doc.setFillColor(...TEAL_SOFT);
  doc.roundedRect(x, y, w, h, 1.2, 1.2, "F");
  doc.setFillColor(...TEAL);
  doc.rect(x, y, 1.4, h, "F");

  // Title eyebrow
  doc.setTextColor(...TEAL);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.text(title.toUpperCase(), x + 5, y + 5.4, { charSpace: 0.6 });

  let cy = y + 10.6;
  for (const ln of wrapped) {
    doc.setFont("helvetica", ln.bold ? "bold" : "normal");
    doc.setFontSize(ln.size || 8.5);
    doc.setTextColor(...(ln.bold ? INK : GRAY));
    for (const p of ln.parts) {
      doc.text(p, x + 5, cy);
      cy += ln.bold ? 4.6 : 4.0;
    }
    if (ln.bold) cy += 1;
  }
  return h;
}

function sectionTitle(doc, y, label) {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(...TEAL);
  doc.text(label.toUpperCase(), M, y, { charSpace: 0.8 });
  doc.setDrawColor(...HAIR);
  doc.setLineWidth(0.2);
  const tw = doc.getTextWidth(label.toUpperCase()) + label.length * 0.8 + 4;
  doc.line(M + tw + 2, y - 1, PW - M, y - 1);
  return y + 4;
}

function ensureSpace(doc, y, needed) {
  if (y + needed > PH - 26) {
    doc.addPage();
    return 18;
  }
  return y;
}

/** Build the PDF for one parsed FatturaPA file. Returns the jsPDF doc. */
export function buildPdf(data, lang, jsPDF) {
  const t = L[lang];
  const doc = new jsPDF({ unit: "mm", format: "a4" });

  data.invoices.forEach((inv, idx) => {
    if (idx > 0) doc.addPage();
    let y = renderInvoice(doc, data, inv, lang, t);
    void y;
  });

  // Footer on every page
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setDrawColor(...HAIR);
    doc.setLineWidth(0.2);
    doc.line(M, PH - 14, PW - M, PH - 14);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.8);
    doc.setTextColor(...GRAY);
    doc.text(t.generatedBy, M, PH - 9.5);
    doc.text(`${t.page} ${p} ${t.of} ${pages}`, PW - M, PH - 9.5, { align: "right" });
  }
  return doc;
}

function renderInvoice(doc, data, inv, lang, t) {
  const isCredit = inv.type === "TD04";
  const accent = isCredit ? [200, 71, 43] : TEAL;
  const cur = inv.currency || "EUR";

  /* ---- Header band ---- */
  doc.setFillColor(...INK);
  doc.rect(0, 0, PW, 34, "F");
  doc.setFillColor(...accent);
  doc.rect(0, 34, PW, 1.2, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.text(t.invoice, M, 11, { charSpace: 1.2 });

  doc.setFontSize(17);
  const docTypeLabel = codeLabel(TIPO_DOCUMENTO, inv.type, lang).split(" - ")[1] || t.invoice;
  const numLabel = lang === "it" ? "n." : "No.";
  doc.text([docTypeLabel, inv.number ? `${numLabel} ${inv.number}` : ""].filter(Boolean).join(" "), M, 21);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(190, 205, 202);
  const meta = [
    inv.type ? codeLabel(TIPO_DOCUMENTO, inv.type, lang) : "",
    `${t.docDate}: ${fmtDate(inv.date, lang)}`,
    `${t.currency}: ${cur}`,
  ].filter(Boolean).join("   ·   ");
  doc.text(meta, M, 28.5);

  // Total "stamp" on the right of the band
  if (inv.total !== null) {
    const totalStr = fmtMoney(inv.total, lang, cur);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(15);
    doc.setTextColor(255, 255, 255);
    doc.text(totalStr, PW - M, 21, { align: "right" });
    doc.setFontSize(6.5);
    doc.setTextColor(190, 205, 202);
    doc.text(t.docTotal, PW - M, 26.5, { align: "right", charSpace: 0.8 });
  }

  let y = 42;

  /* ---- Parties ---- */
  const colW = (PW - 2 * M - 6) / 2;
  const h1 = partyBlock(doc, M, y, colW, t.supplier, data.supplier || {}, lang);
  const h2 = partyBlock(doc, M + colW + 6, y, colW, t.customer, data.customer || {}, lang);
  y += Math.max(h1, h2) + 8;

  /* ---- Causale / order refs ---- */
  if (inv.causale.length || inv.orders.length) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...GRAY);
    const bits = [];
    if (inv.causale.length) bits.push(`${t.causale}: ${inv.causale.join(" ")}`);
    if (inv.orders.length) bits.push(`${t.orderRef}: ${inv.orders.join(", ")}`);
    const wrapped = doc.splitTextToSize(bits.join("   ·   "), PW - 2 * M);
    doc.text(wrapped, M, y);
    y += wrapped.length * 3.8 + 4;
  }

  /* ---- Lines table ---- */
  y = sectionTitle(doc, y, t.lines);
  const lineRows = inv.lines.map((l) => {
    let desc = l.description;
    for (const d of l.discounts || []) {
      const sign = d.type === "MG" ? "+" : "-";
      const what = d.percent !== null ? `${fmtNum(d.percent, lang)}%` : fmtMoney(d.amount, lang, cur);
      desc += `  (${sign}${what})`;
    }
    return [
      l.n,
      desc,
      l.qty !== null ? fmtNum(l.qty, lang) : "",
      l.unit || "",
      l.unitPrice !== null ? fmtMoney(l.unitPrice, lang, cur) : "",
      l.vatRate !== null ? fmtNum(l.vatRate, lang) + "%" : (l.nature || ""),
      l.total !== null ? fmtMoney(l.total, lang, cur) : "",
    ];
  });

  doc.autoTable({
    startY: y,
    margin: { left: M, right: M, bottom: 26 },
    head: [[t.colN, t.colDesc, t.colQty, t.colUm, t.colPrice, t.colVat, t.colTotal]],
    body: lineRows,
    theme: "plain",
    styles: { font: "helvetica", fontSize: 8, textColor: INK, cellPadding: { top: 2.2, bottom: 2.2, left: 2, right: 2 } },
    headStyles: { fontStyle: "bold", fontSize: 7, textColor: GRAY, lineWidth: { bottom: 0.3 }, lineColor: INK },
    alternateRowStyles: { fillColor: PAPER_ROW },
    columnStyles: {
      0: { cellWidth: 8, textColor: GRAY },
      2: { cellWidth: 14, halign: "right" },
      3: { cellWidth: 12 },
      4: { cellWidth: 24, halign: "right" },
      5: { cellWidth: 16, halign: "right" },
      6: { cellWidth: 26, halign: "right", fontStyle: "bold" },
    },
  });
  y = doc.lastAutoTable.finalY + 9;

  /* ---- VAT summary (left) + totals box (right) ---- */
  y = ensureSpace(doc, y, 55);
  y = sectionTitle(doc, y, t.vatSummary);

  const sumW = PW - 2 * M - 66;
  doc.autoTable({
    startY: y,
    margin: { left: M, bottom: 26 },
    tableWidth: sumW,
    head: [[t.colVat, t.colTaxable, t.colTax, t.colChargeability, t.colNature]],
    body: inv.summary.map((s) => [
      s.vatRate !== null ? fmtNum(s.vatRate, lang) + "%" : "",
      fmtMoney(s.taxable, lang, cur),
      fmtMoney(s.tax, lang, cur),
      s.chargeability ? codeLabel(ESIGIBILITA, s.chargeability, lang) : "",
      [s.nature ? codeLabel(NATURA, s.nature, lang) : "", s.legalRef].filter(Boolean).join(" — "),
    ]),
    theme: "plain",
    styles: { font: "helvetica", fontSize: 7.6, textColor: INK, cellPadding: { top: 2, bottom: 2, left: 2, right: 2 } },
    headStyles: { fontStyle: "bold", fontSize: 6.8, textColor: GRAY, lineWidth: { bottom: 0.3 }, lineColor: INK },
    alternateRowStyles: { fillColor: PAPER_ROW },
    columnStyles: { 0: { cellWidth: 12 }, 1: { halign: "right", cellWidth: 26 }, 2: { halign: "right", cellWidth: 22 }, 3: { cellWidth: 22 } },
  });
  const sumEndY = doc.lastAutoTable.finalY;

  // Totals box
  const totTaxable = inv.summary.reduce((a, s) => a + (s.taxable || 0), 0);
  const totVat = inv.summary.reduce((a, s) => a + (s.tax || 0), 0);
  const boxX = PW - M - 60, boxW = 60;
  const rows = [
    [t.totalTaxable, fmtMoney(totTaxable, lang, cur)],
    [t.totalVat, fmtMoney(totVat, lang, cur)],
  ];
  if (inv.stampDuty) rows.push([t.stampDuty, fmtMoney(inv.stampDuty, lang, cur)]);
  const boxH = rows.length * 6 + 19;
  doc.setFillColor(...INK);
  doc.roundedRect(boxX, y, boxW, boxH, 1.2, 1.2, "F");
  let by = y + 7;
  doc.setFontSize(7.8);
  for (const [label, val] of rows) {
    doc.setFont("helvetica", "normal");
    doc.setTextColor(170, 188, 184);
    doc.text(label, boxX + 5, by);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(255, 255, 255);
    doc.text(val, boxX + boxW - 5, by, { align: "right" });
    by += 6;
  }
  doc.setDrawColor(...TEAL);
  doc.setLineWidth(0.4);
  doc.line(boxX + 5, by - 2.5, boxX + boxW - 5, by - 2.5);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.4);
  doc.setTextColor(170, 188, 184);
  doc.text(t.docTotal, boxX + 5, by + 1.6, { charSpace: 0.5 });
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(255, 255, 255);
  doc.text(fmtMoney(inv.total ?? totTaxable + totVat, lang, cur), boxX + boxW - 5, by + 7.4, { align: "right" });

  y = Math.max(sumEndY, y + boxH) + 9;

  /* ---- Payment ---- */
  if (inv.payments.length) {
    y = ensureSpace(doc, y, 30);
    y = sectionTitle(doc, y, t.payment);
    const payRows = [];
    for (const p of inv.payments) {
      for (const d of p.details) {
        payRows.push([
          p.conditions ? codeLabel(CONDIZIONI_PAGAMENTO, p.conditions, lang) : "",
          d.method ? codeLabel(MODALITA_PAGAMENTO, d.method, lang) : "",
          fmtDate(d.dueDate, lang),
          fmtMoney(d.amount, lang, cur),
          [d.iban ? `${t.iban}: ${d.iban}` : "", d.bank ? `${t.bank}: ${d.bank}` : ""].filter(Boolean).join("  "),
        ]);
      }
    }
    doc.autoTable({
      startY: y,
      margin: { left: M, right: M, bottom: 26 },
      head: [[t.payConditions, t.payMethod, t.payDue, t.payAmount, ""]],
      body: payRows,
      theme: "plain",
      styles: { font: "helvetica", fontSize: 7.8, textColor: INK, cellPadding: { top: 2, bottom: 2, left: 2, right: 2 } },
      headStyles: { fontStyle: "bold", fontSize: 6.8, textColor: GRAY, lineWidth: { bottom: 0.3 }, lineColor: INK },
      columnStyles: { 2: { cellWidth: 22 }, 3: { halign: "right", fontStyle: "bold", cellWidth: 26 } },
    });
    y = doc.lastAutoTable.finalY + 8;
  }

  /* ---- SDI transmission footer ---- */
  const tr = data.transmission || {};
  const sdiBits = [
    tr.format ? `${t.sdiFormat}: ${tr.format}` : "",
    tr.progressive ? `${t.sdiProgressive}: ${tr.progressive}` : "",
    tr.recipientCode ? `${t.sdiCode}: ${tr.recipientCode}` : "",
    tr.recipientPec ? `${t.sdiPec}: ${tr.recipientPec}` : "",
  ].filter(Boolean);
  if (sdiBits.length) {
    y = ensureSpace(doc, y, 14);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.5);
    doc.setTextColor(...GRAY);
    doc.text(t.transmission.toUpperCase(), M, y, { charSpace: 0.6 });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.2);
    doc.text(sdiBits.join("   ·   "), M, y + 4);
    y += 10;
  }
  return y;
}
