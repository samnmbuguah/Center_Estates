"use client";

import { Panel, StatusPill } from "@/components/module-ui";
import { Row, Tone } from "../../types/sales.types";
import { fmtDate, fmtMoney } from "../../utils/sales.utils";
import { DField, ProgressBar, RefText } from "../SalesUiComponents";

function toneForSale(s: string): Tone {
  if (s === "completed") return "green";
  if (s === "contracted") return "blue";
  if (s === "reserved") return "yellow";
  if (s === "draft") return "gray";
  if (s === "cancelled") return "red";
  return "gray";
}

export function SaleAgreementView({
  sale,
  onBack,
}: {
  sale: Row;
  onBack: () => void;
}) {
  const price = Number(sale.agreed_price ?? 0);
  const paid = Number(sale.paid_amount ?? 0);
  const balance = price - paid;
  const deposit = Number(sale.reservation_fee ?? 0);

  const docs = [
    { label: "Offer Letter", checked: true },
    { label: "Sale Agreement", checked: String(sale.status) === "contracted" || String(sale.status) === "completed" },
    { label: "Buyer ID Copy", checked: true },
    { label: "KRA PIN Certificate", checked: true },
  ];

  function downloadAgreement() {
    const html = `<!DOCTYPE html>
<html><head><title>Sale Agreement - ${String(sale.reference ?? "")}</title>
<style>body{font-family:Arial,sans-serif;max-width:800px;margin:40px auto;color:#222;line-height:1.6}
h1{font-size:20px;border-bottom:2px solid #ea580c;padding-bottom:8px}
table{width:100%;border-collapse:collapse;margin:16px 0}
td{padding:8px 12px;border-bottom:1px solid #eee}
td:first-child{font-weight:600;width:40%;color:#555}
.label{color:#888;font-size:12px;text-transform:uppercase;letter-spacing:0.05em}
</style></head><body>
<h1>Sale Agreement Summary</h1>
<p class="label">Reference: ${String(sale.reference ?? "—")}</p>
<table>
<tr><td>Buyer</td><td>${String(sale.buyer_name ?? "—")}</td></tr>
<tr><td>Project</td><td>${String(sale.project_name ?? "—")}</td></tr>
<tr><td>Unit</td><td>${String(sale.unit_code ?? "—")}</td></tr>
<tr><td>Agreed Price</td><td>KES ${Number(sale.agreed_price ?? 0).toLocaleString()}</td></tr>
<tr><td>Deposit Paid</td><td>KES ${Number(sale.reservation_fee ?? 0).toLocaleString()}</td></tr>
<tr><td>Total Paid</td><td>KES ${paid.toLocaleString()}</td></tr>
<tr><td>Balance Due</td><td>KES ${balance.toLocaleString()}</td></tr>
<tr><td>Status</td><td>${String(sale.status ?? "—")}</td></tr>
</table>
<h2>Terms &amp; Conditions</h2>
<ol>
<li>The buyer agrees to pay the balance in accordance with the agreed installment schedule.</li>
<li>Transfer of title shall occur upon full payment of the purchase price.</li>
<li>The seller warrants that the property is free from encumbrances at the time of sale.</li>
<li>Any late payment shall attract a penalty of 2% per month on the outstanding amount.</li>
<li>This agreement is governed by the laws of the Republic of Kenya.</li>
</ol>
<h2>Payment Schedule</h2>
<p>Deposit: KES ${deposit.toLocaleString()} (paid)</p>
<p>Balance: KES ${balance.toLocaleString()} — to be paid per installment plan.</p>
<hr><p style="font-size:12px;color:#888">Generated on ${new Date().toLocaleDateString("en-GB")} — Center Estates ERP</p>
</body></html>`;
    const w = window.open("", "_blank");
    if (w) {
      w.document.write(html);
      w.document.close();
    }
  }

  return (
    <>
      <button className="btn ghost sm" onClick={onBack} style={{ marginBottom: 14 }}>← Back to Sales</button>

      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18 }}>
        <span className="fc-detail-thumb-placeholder" style={{ height: 48, width: 48, fontSize: 22 }}>📄</span>
        <div className="fc-detail-meta">
          <strong style={{ fontSize: 16 }}>Sale Agreement — {String(sale.reference ?? "—")}</strong>
          <small className="mono" style={{ fontSize: 12 }}>{String(sale.buyer_name ?? "—")} · {String(sale.unit_code ?? "—")}</small>
        </div>
        <StatusPill value={String(sale.status ?? "")} tone={toneForSale(String(sale.status ?? ""))} />
      </div>

      <div className="grid-2" style={{ gap: 18 }}>
        <Panel title="Sale Header">
          <div className="fc-detail-grid">
            <DField label="Sale Reference" value={<RefText value={sale.reference} />} />
            <DField label="Buyer" value={String(sale.buyer_name ?? "—")} />
            <DField label="Unit" value={String(sale.unit_code ?? "—")} />
            <DField label="Project" value={String(sale.project_name ?? "—")} />
            <DField label="Status" value={<StatusPill value={String(sale.status ?? "")} tone={toneForSale(String(sale.status ?? ""))} />} />
            <DField label="Contracted On" value={sale.contracted_on ? fmtDate(sale.contracted_on) : "—"} />
          </div>
        </Panel>

        <Panel title="Financial Summary">
          <div className="fc-detail-grid">
            <DField label="Agreed Price" value={<span className="mono" style={{ fontWeight: 700 }}>{fmtMoney(price)}</span>} />
            <DField label="Deposit" value={<span className="mono">{fmtMoney(deposit)}</span>} />
            <DField label="Paid to Date" value={<span className="mono" style={{ color: "var(--color-success)" }}>{fmtMoney(paid)}</span>} />
            <DField label="Balance Due" value={<span className="mono" style={{ color: balance > 0 ? "var(--color-danger-strong)" : "var(--color-success)", fontWeight: 700 }}>{fmtMoney(balance)}</span>} />
          </div>
          <div style={{ padding: "12px 18px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
              <span>Payment Progress</span>
              <span className="mono" style={{ fontWeight: 700 }}>{price > 0 ? Math.round((paid / price) * 100) : 0}%</span>
            </div>
            <ProgressBar pct={price > 0 ? (paid / price) * 100 : 0} />
          </div>
        </Panel>
      </div>

      <div className="grid-2" style={{ gap: 18, marginTop: 18 }}>
        <Panel title="Terms &amp; Conditions">
          <div style={{ padding: 18, fontSize: 13, lineHeight: 1.7 }}>
            <ol style={{ margin: 0, paddingLeft: 18 }}>
              <li>The buyer agrees to pay the balance in accordance with the agreed installment schedule.</li>
              <li>Transfer of title shall occur upon full payment of the purchase price.</li>
              <li>The seller warrants that the property is free from encumbrances at the time of sale.</li>
              <li>Any late payment shall attract a penalty of 2% per month on the outstanding amount.</li>
              <li>This agreement is governed by the laws of the Republic of Kenya.</li>
            </ol>
          </div>
        </Panel>

        <Panel title="Documents Checklist">
          <div style={{ padding: 18 }}>
            {docs.map((d) => (
              <div key={d.label} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: "1px solid var(--border)" }}>
                <span style={{ fontSize: 16 }}>{d.checked ? "✅" : "⬜"}</span>
                <span style={{ fontSize: 13, fontWeight: d.checked ? 600 : 400 }}>{d.label}</span>
              </div>
            ))}
            <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
              <button className="btn primary sm" onClick={downloadAgreement}>↓ Download Agreement</button>
              <button className="btn ghost sm" disabled title="Email integration coming soon">✉ Send to Buyer</button>
            </div>
          </div>
        </Panel>
      </div>
    </>
  );
}
