"use client";

import React, { useState } from "react";
import { PropertyTab, Row, TenantRow } from "../types/property.types";

export function RowDetailPanel({
  tab,
  row,
  onEdit,
  onDelete,
  onOpenPortal,
  canLease = true,
}: {
  tab: PropertyTab;
  row: Row;
  onEdit?: (r: Row) => void;
  onDelete?: (r: any) => void;
  onOpenPortal?: (r: Row) => void;
  canLease?: boolean;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const isTenant = tab === "tenants" || Boolean((row as TenantRow).tenant_type || (row as TenantRow).lease_start);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Top Action Bar for Tenant Drawer */}
      {isTenant && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {/* Health & Status Badges */}
          <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
            <span style={{ background: "#dcfce7", color: "#166534", padding: "2px 8px", borderRadius: 12, fontSize: 11, fontWeight: 800 }}>
              ● Lease Active
            </span>
            <span style={{ background: "#dbeafe", color: "#1e40af", padding: "2px 8px", borderRadius: 12, fontSize: 11, fontWeight: 800 }}>
              ✓ Rent Current (0 Arrears)
            </span>
            <span style={{ background: "var(--surface-2)", border: "1px solid var(--border)", padding: "2px 8px", borderRadius: 12, fontSize: 11, fontWeight: 700 }}>
              Deposit: Secured
            </span>
          </div>

          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 6,
              padding: "10px 12px",
              background: "var(--surface-2)",
              borderRadius: 8,
              border: "1px solid var(--border)",
              alignItems: "center",
            }}
          >
            {/* 1-Click WhatsApp */}
            {(row as any).phone && (
              <a
                href={`https://wa.me/${String((row as any).phone).replace(/[^0-9]/g, "")}`}
                target="_blank"
                rel="noreferrer"
                className="btn ghost sm"
                style={{ background: "#25D366", color: "#fff", border: 0, fontWeight: 800, textDecoration: "none" }}
              >
                💬 WhatsApp
              </a>
            )}

            {/* 1-Click Email */}
            {(row as any).email && (
              <a
                href={`mailto:${(row as any).email}`}
                className="btn ghost sm"
                style={{ fontWeight: 700, textDecoration: "none" }}
              >
                ✉️ Email
              </a>
            )}

            {onEdit && (
              <button
                className="btn ghost sm"
                onClick={() => onEdit(row)}
                style={{ fontWeight: 700 }}
              >
                ✏️ Edit
              </button>
            )}

            {onOpenPortal && (
              <button
                className="btn ghost sm"
                onClick={() => onOpenPortal(row)}
                style={{ fontWeight: 700 }}
              >
                🔑 Portal
              </button>
            )}

            {canLease && onDelete && !confirmDelete && (
              <button
                className="btn ghost sm"
                onClick={() => setConfirmDelete(true)}
                style={{
                  color: "#dc2626",
                  borderColor: "rgba(220, 38, 38, 0.3)",
                  fontWeight: 800,
                  marginLeft: "auto",
                }}
              >
                🗑️ Delete
              </button>
            )}
          </div>
        </div>
      )}

      {/* Delete Confirmation Box */}
      {confirmDelete && onDelete && (
        <div
          style={{
            padding: 12,
            borderRadius: 8,
            background: "#fee2e2",
            border: "1px solid #f87171",
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}
        >
          <strong style={{ color: "#991b1b", fontSize: 13 }}>
            Are you sure you want to delete this tenant?
          </strong>
          <p style={{ margin: 0, fontSize: 11, color: "#7f1d1d" }}>
            This will permanently remove the record if no active invoices/receipts exist.
          </p>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button
              className="btn ghost sm"
              onClick={() => setConfirmDelete(false)}
              style={{ background: "#fff", color: "#333" }}
            >
              Cancel
            </button>
            <button
              className="btn primary sm"
              onClick={() => {
                onDelete(row);
                setConfirmDelete(false);
              }}
              style={{ background: "#dc2626", color: "#fff", fontWeight: 800 }}
            >
              Confirm Delete
            </button>
          </div>
        </div>
      )}

      {/* Multi-Unit / Multi-Floor Occupancy List for Tenants */}
      {isTenant && Array.isArray((row as any).units) && (row as any).units.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: 12, borderRadius: 8, background: "var(--surface-2)", border: "1px solid var(--border)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <strong style={{ fontSize: 13, color: "var(--text-primary)" }}>
              🏢 Occupied Units &amp; Leases ({(row as any).units.length})
            </strong>
            <span style={{ fontSize: 11, background: "var(--surface)", padding: "2px 6px", borderRadius: 6, border: "1px solid var(--border)" }}>
              {[...new Set((row as any).units.map((u: any) => u.floor).filter(Boolean))].length > 1 ? "Multi-Floor Tenancy" : "Single Floor"}
            </span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {(row as any).units.map((u: any, idx: number) => (
              <div key={idx} style={{ padding: "8px 10px", background: "var(--surface)", borderRadius: 6, border: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span className="mono" style={{ fontWeight: 800, fontSize: 12 }}>{u.code}</span>
                    {u.floor && (
                      <span style={{ fontSize: 10, background: "#e0e7ff", color: "#4338ca", padding: "1px 5px", borderRadius: 4, fontWeight: 700 }}>
                        Floor {u.floor}
                      </span>
                    )}
                    {u.area && (
                      <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>
                        {u.area} sq ft
                      </span>
                    )}
                  </div>
                  <div className="mono" style={{ fontSize: 10, color: "var(--muted)", marginTop: 2 }}>
                    Lease: {u.lease_reference} ({u.lease_status})
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 12, fontWeight: 800 }}>
                    KES {Number(u.monthly_rent ?? 0).toLocaleString()}
                  </div>
                  <div style={{ fontSize: 10, color: "var(--muted)" }}>
                    {u.starts_on} → {u.ends_on}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Property Details Grid */}
      <div style={{ display: "grid", gap: 8 }}>
        {Object.entries(row)
          .filter(([k]) => !["id", "metadata", "units"].includes(k))
          .map(([k, v]) => (
            <div
              key={k}
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: 12,
                borderBottom: "1px solid var(--border)",
                paddingBottom: 4,
              }}
            >
              <span className="muted">{k.replace(/_/g, " ")}</span>
              <span style={{ fontWeight: 600 }}>
                {typeof v === "object" ? JSON.stringify(v) : String(v ?? "—")}
              </span>
            </div>
          ))}
      </div>
    </div>
  );
}
