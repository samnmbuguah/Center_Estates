import type { Candidate } from "./types";

const escapeHtml = (value: unknown) => String(value ?? "")
  .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;").replaceAll("'", "&#039;");

const formatMoney = (value: unknown) => new Intl.NumberFormat("en-KE", {
  style: "currency", currency: "KES", minimumFractionDigits: 2,
}).format(Number(value ?? 0));

const formatDate = (value: string) => {
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("en-KE", { day: "2-digit", month: "short", year: "numeric" });
};

export function invoiceDraftHtml(candidate: Candidate, brand: { name: string; logoUrl?: string; primaryColor?: string }) {
  const reference = candidate.invoice_number || `DRAFT-${candidate.unit_code}-${candidate.due_date?.slice(0, 7) || "AUTO"}`;
  const total = Number(candidate.total || 0);
  const rows = candidate.billing_items.map((item, index) => `
    <tr><td>${index + 1}</td><td><strong>${escapeHtml(item.description || item.code)}</strong><small>Recurring tenancy schedule charge</small></td><td>${escapeHtml(String(item.code || "charge").replaceAll("_", " ").toUpperCase())}</td><td>${formatMoney(item.total ?? item.amount)}</td></tr>
  `).join("");
  const logo = brand.logoUrl ? `<img src="${escapeHtml(brand.logoUrl)}" alt="${escapeHtml(brand.name)} logo" />` : "";
  const accent = /^#[0-9a-f]{6}$/i.test(brand.primaryColor ?? "") ? brand.primaryColor : "#dc2626";

  return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(reference)} · Draft invoice</title><style>
    @page{size:A4;margin:14mm}*{box-sizing:border-box}body{color:#132238;font:12px/1.45 Arial,sans-serif;margin:0;background:#fff}.document{max-width:182mm;margin:auto}.masthead{display:flex;justify-content:space-between;gap:24px;align-items:flex-start;padding-bottom:16px;border-bottom:4px solid ${accent}}.brand{display:flex;gap:12px;align-items:center}.brand img{max-height:52px;max-width:130px;object-fit:contain}.brand h1{font-size:19px;margin:0}.brand p,.meta p{color:#52637a;margin:2px 0}.meta{text-align:right}.meta h2{font-size:20px;letter-spacing:.04em;margin:0}.draft{display:inline-block;margin-top:7px;padding:4px 9px;border:1px solid #d97706;color:#9a5400;background:#fff7e6;border-radius:999px;font-weight:700}.parties{display:grid;grid-template-columns:1fr 1fr;gap:18px;margin:22px 0}.label{color:#607087;font-size:10px;font-weight:700;letter-spacing:.08em;text-transform:uppercase}.parties h3{font-size:16px;margin:4px 0}.parties p{margin:2px 0}table{border-collapse:collapse;width:100%}th{background:#14263f;color:#fff;font-size:10px;letter-spacing:.055em;padding:10px;text-align:left;text-transform:uppercase}td{border-bottom:1px solid #dce3ec;padding:11px 10px;vertical-align:top}td:last-child,th:last-child{text-align:right}td:first-child{width:34px}small{color:#65758b;display:block;margin-top:2px}.summary{display:flex;justify-content:flex-end;margin-top:15px}.summary div{background:#f3f6fa;border:1px solid #dce3ec;border-radius:8px;display:flex;justify-content:space-between;min-width:280px;padding:13px 15px}.summary strong:last-child{color:${accent};font-size:16px}.notice{border-left:4px solid ${accent};background:#fff8f8;margin-top:24px;padding:12px 14px}.footer{border-top:1px solid #dce3ec;color:#607087;margin-top:30px;padding-top:12px;text-align:center;font-size:10px}.screen-actions{display:flex;justify-content:center;gap:10px;margin:20px}.screen-actions button{border:0;border-radius:7px;background:${accent};color:#fff;font-weight:700;padding:10px 18px;cursor:pointer}.screen-actions button.secondary{background:#fff;border:1px solid #b9c5d4;color:#132238}@media print{.screen-actions{display:none}.document{max-width:none}}
  </style></head><body><main class="document"><header class="masthead"><div class="brand">${logo}<div><h1>${escapeHtml(brand.name)}</h1><p>Property and estate management</p></div></div><div class="meta"><h2>DRAFT INVOICE</h2><p><strong>${escapeHtml(reference)}</strong></p><span class="draft">Not yet issued</span></div></header><section class="parties"><div><span class="label">Bill to</span><h3>${escapeHtml(candidate.tenant_name)}</h3><p>Lease: ${escapeHtml(candidate.lease_reference)}</p></div><div><span class="label">Property</span><h3>${escapeHtml(candidate.property_name)}</h3><p>Unit: ${escapeHtml(candidate.unit_code)}</p><p>Payment due: <strong>${escapeHtml(formatDate(candidate.due_date))}</strong></p></div></section><table><thead><tr><th>#</th><th>Description</th><th>Category</th><th>Amount</th></tr></thead><tbody>${rows || '<tr><td colspan="4">No billing items have been prepared.</td></tr>'}</tbody></table><section class="summary"><div><strong>Total payable</strong><strong>${formatMoney(total)}</strong></div></section><aside class="notice"><strong>Draft for review</strong><br>This document is a billing preview and is not an issued tax invoice. Generate and dispatch the invoice to assign its official invoice number and make it available in the tenant portal.</aside><footer class="footer">Generated from CeEst ERP · ${escapeHtml(candidate.property_name)} · ${escapeHtml(new Date().toLocaleString("en-KE"))}</footer></main><div class="screen-actions"><button class="secondary" onclick="window.close()">Close</button><button onclick="window.print()">Print / Save PDF</button></div></body></html>`;
}

export function printInvoiceDraft(candidate: Candidate, brand: { name: string; logoUrl?: string; primaryColor?: string }) {
  const popup = window.open("", "_blank", "width=920,height=760");
  if (!popup) throw new Error("Your browser blocked the print preview. Allow pop-ups for this site and try again.");
  popup.opener = null;
  popup.document.open();
  popup.document.write(invoiceDraftHtml(candidate, brand));
  popup.document.close();
}
