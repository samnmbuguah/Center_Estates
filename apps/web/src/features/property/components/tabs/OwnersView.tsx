"use client";

import { useState, useEffect } from "react";
import {
  KpiCard, KpiStrip, StatusPill, Panel, EmptyState, LoadingState,
  ErrorBanner, SearchInput, DetailDrawer, Modal, Field, money,
} from "@/components/module-ui";
import { OwnerRow, PropertyTab, Row, ID } from "../../types/property.types";
import { apiErrorMessage, apiFetch, csrfFromCookie } from "@/lib/api";
import {
  Users, Building2, Landmark, Plus, DollarSign,
  CheckCircle2, CreditCard, RefreshCw, KeyRound
} from "lucide-react";

export function OwnersView({
  search,
  setSearch,
  setTab,
  onSelectRow,
  canOperate = true,
}: {
  search: string;
  setSearch: (v: string) => void;
  setTab: (t: PropertyTab) => void;
  onSelectRow?: (r: Row) => void;
  canOperate?: boolean;
}) {
  const [owners, setOwners] = useState<OwnerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedOwner, setSelectedOwner] = useState<OwnerRow | null>(null);
  const [financialSummary, setFinancialSummary] = useState<Record<string, any> | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [showAddOwnerModal, setShowAddOwnerModal] = useState(false);
  const [newOwnerForm, setNewOwnerForm] = useState({
    name: "",
    email: "",
    phone: "",
    pin_number: "",
    id_or_registration_number: "",
    settlement_bank_name: "NCBA Bank",
    settlement_bank_account: "",
    settlement_bank_branch: "",
    settlement_paybill_or_till: "",
    notes: "",
  });

  const loadOwners = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await apiFetch("/api/v1/property/owners/");
      if (!res.ok) throw new Error("Failed to load unit owners.");
      const data = await res.json();
      const rows = Array.isArray(data) ? data : (data.results || []);
      setOwners(rows);
    } catch (err: any) {
      setError(err.message || "Failed to load unit owners.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOwners();
  }, []);

  const handleSelectOwner = async (owner: OwnerRow) => {
    setSelectedOwner(owner);
    setSummaryLoading(true);
    try {
      const res = await apiFetch(`/api/v1/property/owners/${owner.id}/financial-summary/`);
      if (res.ok) {
        const data = await res.json();
        setFinancialSummary(data);
      }
    } catch {
      // Ignore
    } finally {
      setSummaryLoading(false);
    }
  };

  const handleCreateOwner = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await apiFetch("/api/v1/property/owners/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRFToken": csrfFromCookie(),
        },
        body: JSON.stringify(newOwnerForm),
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        const msg = await apiErrorMessage(errJson, "Failed to create landlord profile.");
        throw new Error(msg);
      }
      setShowAddOwnerModal(false);
      setNewOwnerForm({
        name: "",
        email: "",
        phone: "",
        pin_number: "",
        id_or_registration_number: "",
        settlement_bank_name: "NCBA Bank",
        settlement_bank_account: "",
        settlement_bank_branch: "",
        settlement_paybill_or_till: "",
        notes: "",
      });
      loadOwners();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const filteredOwners = owners.filter((o) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      (o.name ?? "").toLowerCase().includes(q) ||
      (o.code ?? "").toLowerCase().includes(q) ||
      (o.email ?? "").toLowerCase().includes(q) ||
      (o.phone ?? "").toLowerCase().includes(q) ||
      (o.pin_number ?? "").toLowerCase().includes(q)
    );
  });

  const totalUnits = owners.reduce((s, o) => s + (Number(o.units_count) || 0), 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* KPI Cards */}
      <KpiStrip cols={3}>
        <KpiCard
          icon={<Users size={16} />}
          label="Registered Landlords"
          value={owners.length}
          sub="Sectional Title Unit Owners"
          iconBg="rgba(99, 102, 241, 0.12)"
          iconColor="#6366f1"
          borderColor="#6366f1"
        />
        <KpiCard
          icon={<Building2 size={16} />}
          label="Units Under Ownership"
          value={totalUnits}
          sub="Allocated to Landlords"
          iconBg="rgba(16, 185, 129, 0.12)"
          iconColor="#10b981"
          borderColor="#10b981"
        />
        <KpiCard
          icon={<Landmark size={16} />}
          label="Active Payout Routes"
          value={owners.filter((o) => o.settlement_bank_account || o.settlement_paybill_or_till).length}
          sub="Bank & M-Pesa Remittance Routes"
          iconBg="rgba(59, 130, 246, 0.12)"
          iconColor="#3b82f6"
          borderColor="#3b82f6"
        />
      </KpiStrip>

      {/* Toolbar */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 240, maxWidth: 400 }}>
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search by Landlord Name, Code, PIN, Phone..."
          />
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" className="btn ghost sm" onClick={loadOwners}>
            <RefreshCw size={14} style={{ marginRight: 6 }} /> Refresh
          </button>
          {canOperate && (
            <button
              type="button"
              className="btn primary sm"
              onClick={() => setShowAddOwnerModal(true)}
            >
              <Plus size={14} style={{ marginRight: 6 }} /> Add Landlord / Owner
            </button>
          )}
        </div>
      </div>

      {error && <ErrorBanner message={error} />}

      {/* Table */}
      <Panel>
        {loading ? (
          <LoadingState rows={6} />
        ) : filteredOwners.length === 0 ? (
          <EmptyState
            title="No Landlords or Unit Owners Found"
            description="Register sectional title unit owners to configure per-unit management mandates and settlement bank routing."
            action={
              canOperate ? (
                <button
                  type="button"
                  className="btn primary sm"
                  onClick={() => setShowAddOwnerModal(true)}
                >
                  <Plus size={14} style={{ marginRight: 6 }} /> Add First Landlord
                </button>
              ) : undefined
            }
          />
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="table" style={{ width: "100%", fontSize: 13 }}>
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Landlord / Owner</th>
                  <th>Contact Details</th>
                  <th>KRA PIN / Reg No</th>
                  <th>Units Owned</th>
                  <th>Settlement Destination</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredOwners.map((o) => (
                  <tr
                    key={o.id}
                    onClick={() => handleSelectOwner(o)}
                    style={{ cursor: "pointer" }}
                  >
                    <td>
                      <span style={{ fontWeight: 600, color: "#818cf8" }}>{o.code || "—"}</span>
                    </td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{o.name}</div>
                    </td>
                    <td>
                      <div style={{ fontSize: 12 }}>{o.email || "—"}</div>
                      <div style={{ fontSize: 11, color: "var(--muted)" }}>{o.phone || "—"}</div>
                    </td>
                    <td>
                      <div style={{ fontFamily: "monospace", fontSize: 12 }}>{o.pin_number || "—"}</div>
                      <div style={{ fontSize: 11, color: "var(--muted)" }}>{o.id_or_registration_number || ""}</div>
                    </td>
                    <td>
                      <span className="badge badge-purple">{o.units_count ?? (o.units_list?.length ?? 0)} Units</span>
                    </td>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
                        <Landmark size={14} color="#60a5fa" />
                        <span>{o.settlement_bank_name || "—"}</span>
                      </div>
                      <div style={{ fontSize: 11, color: "var(--muted)", fontFamily: "monospace" }}>
                        {o.settlement_bank_account || o.settlement_paybill_or_till || "Not Configured"}
                      </div>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="btn ghost sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSelectOwner(o);
                        }}
                      >
                        Financial Summary
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {/* Owner Detail Drawer */}
      {selectedOwner && (
        <DetailDrawer
          title={
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{
                background: "rgba(99, 102, 241, 0.15)",
                color: "#818cf8",
                borderRadius: 8,
                width: 32,
                height: 32,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}>
                <Users size={18} />
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15 }}>{selectedOwner.name}</div>
                <div style={{ fontSize: 12, color: "var(--muted)" }}>{selectedOwner.code} • Landlord Profile</div>
              </div>
            </div>
          }
          onClose={() => {
            setSelectedOwner(null);
            setFinancialSummary(null);
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            {/* Financial Overview Card */}
            <div style={{
              padding: "16px",
              borderRadius: 10,
              background: "radial-gradient(ellipse at top, rgba(99, 102, 241, 0.12) 0%, rgba(15, 23, 42, 0.6) 100%)",
              border: "1px solid rgba(99, 102, 241, 0.25)",
              display: "flex",
              flexDirection: "column",
              gap: 12,
            }}>
              <div style={{ fontWeight: 600, fontSize: 13, color: "#a5b4fc", display: "flex", alignItems: "center", gap: 6 }}>
                <DollarSign size={15} /> Landlord Ledger & Financial Summary
              </div>

              {summaryLoading ? (
                <div style={{ fontSize: 12, color: "var(--muted)" }}>Loading financial ledgers...</div>
              ) : financialSummary ? (
                <div className="grid-2" style={{ gap: 10 }}>
                  <div style={{ padding: "10px", borderRadius: 8, background: "rgba(255,255,255,0.03)" }}>
                    <div style={{ fontSize: 11, color: "var(--muted)" }}>Active Rent Roll</div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: "#34d399" }}>
                      {money.format(financialSummary.active_rent_roll ?? 0)}
                    </div>
                  </div>
                  <div style={{ padding: "10px", borderRadius: 8, background: "rgba(255,255,255,0.03)" }}>
                    <div style={{ fontSize: 11, color: "var(--muted)" }}>Outstanding Balance</div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: Number(financialSummary.outstanding_balance ?? 0) > 0 ? "#f87171" : "#10b981" }}>
                      {money.format(financialSummary.outstanding_balance ?? 0)}
                    </div>
                  </div>
                </div>
              ) : null}
            </div>

            {/* Profile & Settlement Info */}
            <div style={{
              padding: "14px",
              borderRadius: 8,
              background: "var(--surface)",
              border: "1px solid var(--border)",
              display: "flex",
              flexDirection: "column",
              gap: 10,
              fontSize: 13,
            }}>
              <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4, display: "flex", alignItems: "center", gap: 6 }}>
                <Landmark size={15} color="#60a5fa" /> Settlement / Remittance Details
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--muted)" }}>Bank Name:</span>
                <span style={{ fontWeight: 500 }}>{selectedOwner.settlement_bank_name || "—"}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--muted)" }}>Account Number:</span>
                <span style={{ fontWeight: 500, fontFamily: "monospace" }}>{selectedOwner.settlement_bank_account || "—"}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--muted)" }}>Branch:</span>
                <span style={{ fontWeight: 500 }}>{selectedOwner.settlement_bank_branch || "—"}</span>
              </div>
              {selectedOwner.settlement_paybill_or_till && (
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "var(--muted)" }}>Paybill / Till:</span>
                  <span style={{ fontWeight: 500 }}>{selectedOwner.settlement_paybill_or_till}</span>
                </div>
              )}
            </div>

            {/* Owned Units List */}
            <div>
              <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
                <KeyRound size={15} color="#818cf8" /> Units Owned ({selectedOwner.units_list?.length ?? selectedOwner.units_count ?? 0})
              </div>
              {selectedOwner.units_list && selectedOwner.units_list.length > 0 ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {selectedOwner.units_list.map((u) => (
                    <div
                      key={u.id}
                      style={{
                        padding: "10px 12px",
                        borderRadius: 8,
                        background: "var(--surface)",
                        border: "1px solid var(--border)",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        fontSize: 12,
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 600 }}>Unit {u.code}</div>
                        <div style={{ fontSize: 11, color: "var(--muted)" }}>
                          {u.property_name} • {u.sectional_title_number || "No Deed Number"}
                        </div>
                      </div>
                      <span className="badge badge-purple">{u.management_mandate || "both"}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ fontSize: 12, color: "var(--muted)", padding: 8 }}>
                  No units currently assigned to this landlord.
                </div>
              )}
            </div>
          </div>
        </DetailDrawer>
      )}

      {/* Add Owner Modal */}
      {showAddOwnerModal && (
        <Modal
          title="Add Landlord / Unit Owner"
          onClose={() => setShowAddOwnerModal(false)}
          maxWidth="md"
        >
          <form onSubmit={handleCreateOwner} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <Field label="Landlord / Entity Name" required>
              <input
                value={newOwnerForm.name}
                onChange={(e) => setNewOwnerForm({ ...newOwnerForm, name: e.target.value })}
                placeholder="e.g. Dr. James Kariuki"
                required
              />
            </Field>

            <div className="grid-2">
              <Field label="Email Address">
                <input
                  type="email"
                  value={newOwnerForm.email}
                  onChange={(e) => setNewOwnerForm({ ...newOwnerForm, email: e.target.value })}
                  placeholder="e.g. jkariuki@example.com"
                />
              </Field>
              <Field label="Phone Number">
                <input
                  value={newOwnerForm.phone}
                  onChange={(e) => setNewOwnerForm({ ...newOwnerForm, phone: e.target.value })}
                  placeholder="e.g. +254711223344"
                />
              </Field>
            </div>

            <div className="grid-2">
              <Field label="National ID / Registration No.">
                <input
                  value={newOwnerForm.id_or_registration_number}
                  onChange={(e) => setNewOwnerForm({ ...newOwnerForm, id_or_registration_number: e.target.value })}
                  placeholder="e.g. 22334455"
                />
              </Field>
              <Field label="KRA PIN">
                <input
                  value={newOwnerForm.pin_number}
                  onChange={(e) => setNewOwnerForm({ ...newOwnerForm, pin_number: e.target.value })}
                  placeholder="e.g. A001234567Z"
                />
              </Field>
            </div>

            <div style={{
              padding: "12px 14px",
              borderRadius: 8,
              background: "rgba(255,255,255,0.02)",
              border: "1px dashed var(--border)",
              marginTop: 4,
            }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "#818cf8", marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
                <Landmark size={14} /> Settlement / Payout Destination
              </div>
              <div className="grid-2">
                <Field label="Settlement Bank">
                  <input
                    value={newOwnerForm.settlement_bank_name}
                    onChange={(e) => setNewOwnerForm({ ...newOwnerForm, settlement_bank_name: e.target.value })}
                    placeholder="e.g. NCBA / KCB"
                  />
                </Field>
                <Field label="Bank Account No.">
                  <input
                    value={newOwnerForm.settlement_bank_account}
                    onChange={(e) => setNewOwnerForm({ ...newOwnerForm, settlement_bank_account: e.target.value })}
                    placeholder="e.g. 1122334455"
                  />
                </Field>
              </div>
              <div className="grid-2" style={{ marginTop: 8 }}>
                <Field label="Branch">
                  <input
                    value={newOwnerForm.settlement_bank_branch}
                    onChange={(e) => setNewOwnerForm({ ...newOwnerForm, settlement_bank_branch: e.target.value })}
                    placeholder="e.g. Kilimani"
                  />
                </Field>
                <Field label="Paybill / Till (Optional)">
                  <input
                    value={newOwnerForm.settlement_paybill_or_till}
                    onChange={(e) => setNewOwnerForm({ ...newOwnerForm, settlement_paybill_or_till: e.target.value })}
                    placeholder="e.g. 522522"
                  />
                </Field>
              </div>
            </div>

            <div className="row" style={{ justifyContent: "flex-end", gap: 8, marginTop: 12 }}>
              <button type="button" className="btn ghost" onClick={() => setShowAddOwnerModal(false)}>
                Cancel
              </button>
              <button type="submit" className="btn primary">
                Save Landlord Profile
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
