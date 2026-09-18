"use client";

import React, { useState } from "react";
import { PropertyTab, Row, TenantRow } from "../types/property.types";

export function RowDetailPanel({
  tab,
  row,
  onEdit,
  onDelete,
  onActivate,
  onOpenPortal,
  canLease = true,
}: {
  tab: PropertyTab;
  row: Row;
  onEdit?: (r: Row) => void;
  onDelete?: (r: any) => void;
  onActivate?: (r: any) => void;
  onOpenPortal?: (r: Row) => void;
  canLease?: boolean;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [activating, setActivating] = useState(false);
  const isTenant = tab === "tenants" || Boolean((row as TenantRow).tenant_type || (row as TenantRow).lease_start);
  const isProspect = (row as TenantRow).status === "prospect";

  const handleActivate = async () => {
    if (!onActivate) return;
    setActivating(true);
    try {
      await onActivate(row);
    } finally {
      setActivating(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Top Action Bar for Tenant Drawer */}
      {isTenant && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {/* Health & Status Badges */}
          <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
            {isProspect ? (
              <span style={{ background: "var(--color-amber-bg)", color: "var(--color-amber-strong)", padding: "2px 8px", borderRadius: 12, fontSize: 11, fontWeight: 800 }}>
                ◌ Pending Activation
              </span>
            ) : (
              <span style={{ background: "var(--color-green-bg)", color: "var(--color-green-text)", padding: "2px 8px", borderRadius: 12, fontSize: 11, fontWeight: 800 }}>
                ● Lease Active
              </span>
            )}
            <span style={{ background: "var(--color-blue-bg)", color: "var(--color-info-deep)", padding: "2px 8px", borderRadius: 12, fontSize: 11, fontWeight: 800 }}>
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
            {isProspect && onActivate && canLease && (
              <button
                className="btn primary sm"
                onClick={() => void handleActivate()}
                disabled={activating}
                style={{ background: "var(--color-success)", borderColor: "var(--color-success-strong)", fontWeight: 800 }}
              >
                {activating ? "Activating…" : "⚡ Activate Tenancy & Leases"}
              </button>
            )}
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
                  color: "var(--color-danger)",
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
            background: "var(--color-red-bg)",
            border: "1px solid #f87171",
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}
        >
          <strong style={{ color: "var(--color-danger-deep)", fontSize: 13 }}>
            {tab === "leases" ? "Are you sure you want to delete this lease agreement?" : "Are you sure you want to delete this tenant?"}
          </strong>
          <p style={{ margin: 0, fontSize: 11, color: "#7f1d1d" }}>
            {tab === "leases"
              ? "The unit will be freed up and reset to Available so you can recreate a new lease. (Leases with posted invoices must be Terminated instead)."
              : "This will permanently remove the record if no active invoices/receipts exist."}
          </p>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button
              className="btn ghost sm"
              onClick={() => setConfirmDelete(false)}
              style={{ background: "var(--surface)", color: "#333" }}
            >
              Cancel
            </button>
            <button
              className="btn primary sm"
              onClick={() => {
                onDelete(row);
                setConfirmDelete(false);
              }}
              style={{ background: "var(--color-danger)", color: "#fff", fontWeight: 800 }}
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
                      <span style={{ fontSize: 10, background: "var(--color-indigo-bg)", color: "#4338ca", padding: "1px 5px", borderRadius: 4, fontWeight: 700 }}>
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

      {/* Property Service Providers & Service Lines */}
      {Array.isArray((row as any).metadata?.service_providers) && (row as any).metadata.service_providers.length > 0 && (
        <div style={{ padding: "12px", background: "var(--surface-2)", borderRadius: 8, border: "1px solid var(--border)" }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: "var(--text-primary)", marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span>🛠️ Service Providers &amp; Service Lines</span>
            <span style={{ fontSize: 11, background: "rgba(37, 99, 235, 0.1)", color: "var(--color-info)", padding: "1px 6px", borderRadius: 4 }}>
              {(row as any).metadata.service_providers.length} registered
            </span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {(row as any).metadata.service_providers.map((sp: any, idx: number) => (
              <div key={idx} style={{ padding: "8px 10px", background: "var(--surface)", borderRadius: 6, border: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontWeight: 800, fontSize: 12 }}>{sp.service || sp.name || "Service Line"}</span>
                    <span style={{ fontSize: 10, background: "var(--color-indigo-bg)", color: "#4338ca", padding: "1px 5px", borderRadius: 4, fontWeight: 700 }}>
                      {sp.category || "General Maintenance"}
                    </span>
                  </div>
                  <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 2 }}>
                    <strong>{sp.name || "Unassigned"}</strong> {sp.contact ? `· ${sp.contact}` : ""} {sp.phone ? `· ${sp.phone}` : ""}
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  {Number(sp.monthly_cost) > 0 && (
                    <div style={{ fontSize: 12, fontWeight: 800 }}>
                      KES {Number(sp.monthly_cost).toLocaleString()}
                    </div>
                  )}
                  <div style={{ fontSize: 10, color: "var(--muted)", textTransform: "capitalize" }}>
                    {sp.frequency || "Monthly"}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Property Utilities & Meters */}
      {Array.isArray((row as any).metadata?.utilities) && (row as any).metadata.utilities.length > 0 && (
        <div style={{ padding: "12px", background: "var(--surface-2)", borderRadius: 8, border: "1px solid var(--border)" }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: "var(--text-primary)", marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span>⚡ Utility Accounts &amp; Meters</span>
            <span style={{ fontSize: 11, background: "rgba(22, 163, 74, 0.1)", color: "var(--color-success)", padding: "1px 6px", borderRadius: 4 }}>
              {(row as any).metadata.utilities.length} accounts
            </span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {(row as any).metadata.utilities.map((u: any, idx: number) => (
              <div key={idx} style={{ padding: "8px 10px", background: "var(--surface)", borderRadius: 6, border: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                    <span style={{ fontWeight: 800, fontSize: 12, textTransform: "capitalize" }}>{u.type || "Utility"}</span>
                    {u.unit_code && (
                      <span style={{ fontSize: 10, background: "rgba(79, 70, 229, 0.1)", color: "var(--color-indigo)", padding: "1px 5px", borderRadius: 4, fontWeight: 700 }}>
                        Unit {u.unit_code}
                      </span>
                    )}
                    {u.meter_code && (
                      <span className="mono" style={{ fontSize: 10, background: "var(--color-amber-bg)", color: "var(--color-amber-strong)", padding: "1px 5px", borderRadius: 4, fontWeight: 700 }}>
                        Meter: {u.meter_code}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 2 }}>
                    {u.location ? `📍 ${u.location}` : ""}{u.location && u.account_no ? " · " : ""}{u.account_no ? `Acc: ${u.account_no}` : (!u.location && u.provider ? u.provider : "")}
                  </div>

                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 11, fontWeight: 700 }}>
                    {u.tariff && Number(u.tariff) > 0 ? `KES ${u.tariff} / ${u.unit || 'unit'}` : (u.supply_mode || "Active")}
                  </div>
                  <div style={{ fontSize: 10, color: "var(--muted)" }}>
                    {u.bill_cycle || "Monthly"}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Property Contacts */}
      {Array.isArray((row as any).metadata?.contacts) && (row as any).metadata.contacts.length > 0 && (
        <div style={{ padding: "12px", background: "var(--surface-2)", borderRadius: 8, border: "1px solid var(--border)" }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: "var(--text-primary)", marginBottom: 8 }}>
            👥 Property Directory &amp; Contacts
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {(row as any).metadata.contacts.map((c: any, idx: number) => (
              <div key={idx} style={{ padding: "8px 10px", background: "var(--surface)", borderRadius: 6, border: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 12 }}>{c.name}</div>
                  <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>{c.role || "Contact"}</div>
                </div>
                <div style={{ textAlign: "right", fontSize: 11 }}>
                  {c.phone && <div><a href={`tel:${c.phone}`} style={{ color: "var(--color-info)", textDecoration: "none", fontWeight: 600 }}>{c.phone}</a></div>}
                  {c.email && <div><a href={`mailto:${c.email}`} style={{ color: "var(--muted)", textDecoration: "none", fontSize: 10 }}>{c.email}</a></div>}
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
