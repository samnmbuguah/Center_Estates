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
  CheckCircle2, CreditCard, RefreshCw, KeyRound, Download, Upload, FileText,
} from "lucide-react";
import { csvCell, csvColumn, normalizeCsvHeader, parseCsv } from "@/lib/csv";
import { exportCsv } from "../../utils/property.utils";


type OwnerImportRow = Record<string, any> & { row: number; errors?: Record<string, string> };

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
  const [showBulkOwnerModal, setShowBulkOwnerModal] = useState(false);
  const [remittanceOwner, setRemittanceOwner] = useState<OwnerRow | null>(null);
  const [remittancePeriod, setRemittancePeriod] = useState({
    month: new Date().getMonth() + 1,
    year: new Date().getFullYear(),
  });
  const [remittanceData, setRemittanceData] = useState<Record<string, any> | null>(null);
  const [remittanceLoading, setRemittanceLoading] = useState(false);
  const [remittanceError, setRemittanceError] = useState("");
  const [ownerImportRows, setOwnerImportRows] = useState<OwnerImportRow[]>([]);
  const [ownerImportFile, setOwnerImportFile] = useState("");
  const [ownerImportBusy, setOwnerImportBusy] = useState(false);
  const [ownerImportError, setOwnerImportError] = useState("");
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
    engaged_for_unit_management: false,
    engaged_for_letting: false,
    is_management_company: false,
    notes: "",
  });

  const loadOwners = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await apiFetch("/property/owners/");
      if (!res.ok) throw new Error(await apiErrorMessage(res, "Landlords and owners could not be loaded."));
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
      const res = await apiFetch(`/property/owners/${owner.id}/financial-summary/`);
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

  const fetchRemittanceStatement = async (owner: OwnerRow, m?: number, y?: number) => {
    const targetMonth = m ?? remittancePeriod.month;
    const targetYear = y ?? remittancePeriod.year;
    setRemittanceOwner(owner);
    setRemittancePeriod({ month: targetMonth, year: targetYear });
    setRemittanceLoading(true);
    setRemittanceError("");
    try {
      const res = await apiFetch(`/property/owners/${owner.id}/remittance-statement/?month=${targetMonth}&year=${targetYear}`);
      if (!res.ok) throw new Error(await apiErrorMessage(res, "Remittance statement could not be loaded."));
      const data = await res.json();
      setRemittanceData(data);
    } catch (err: any) {
      setRemittanceError(err.message || "Failed to load remittance statement.");
    } finally {
      setRemittanceLoading(false);
    }
  };


  const handleCreateOwner = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await apiFetch("/property/owners/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRFToken": csrfFromCookie(),
        },
        body: JSON.stringify(newOwnerForm),
      });
      if (!res.ok) {
        const msg = await apiErrorMessage(res, "Landlord profile could not be created.");
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
        engaged_for_unit_management: false,
        engaged_for_letting: false,
        is_management_company: false,
        notes: "",
      });
      loadOwners();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const downloadOwnerTemplate = () => {
    const rows = [
      ["name", "email", "phone", "pin_number", "id_or_registration_number", "settlement_bank_name", "settlement_bank_account", "settlement_bank_branch", "settlement_paybill_or_till", "unit_codes", "engaged_for_unit_management", "engaged_for_letting", "is_management_company"],
      ["ABC Holdings Ltd", "accounts@abc.example", "+254700000000", "P012345678X", "C.12345", "NCBA Bank", "010123456789", "Westlands", "", "A-101;A-102", "yes", "no", "no"],
    ];
    const csv = rows.map((row) => row.map((value) => `\"${value.replaceAll('\"', '\"\"')}\"`).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a"); link.href = url; link.download = "center-estates-landlord-owner-template.csv"; link.click(); URL.revokeObjectURL(url);
  };

  const parseOwnerFile = async (file?: File) => {
    if (!file) return;
    setOwnerImportError("");
    try {
      const rows = parseCsv(await file.text());
      if (rows.length < 2) throw new Error("The CSV needs a header row and at least one owner row.");
      const headers = rows[0].map(normalizeCsvHeader);
      const nameIndex = csvColumn(headers, ["name", "owner_name", "landlord_name"]);
      if (nameIndex < 0) throw new Error("The CSV needs a Name, Owner Name, or Landlord Name column.");
      if (rows.length - 1 > 500) throw new Error("Upload a maximum of 500 owners at a time.");
      setOwnerImportFile(file.name);
      setOwnerImportRows(rows.slice(1).map((row, index) => Object.fromEntries(headers.map((header, column) => [header, csvCell(row, column)])) as OwnerImportRow & { row: number }).map((row, index) => ({ ...row, row: index + 2, errors: (row.name || row.owner_name || row.landlord_name ? {} : { name: "Owner name is required." }) as Record<string, string> })));
    } catch (err) {
      setOwnerImportRows([]);
      setOwnerImportError(err instanceof Error ? err.message : "The CSV could not be read.");
    }
  };

  const importOwners = async () => {
    if (!ownerImportRows.length) return;
    setOwnerImportBusy(true); setOwnerImportError("");
    try {
      const res = await apiFetch("/property/owners/bulk-import/", { method: "POST", headers: { "Content-Type": "application/json", "X-CSRFToken": csrfFromCookie() }, body: JSON.stringify({ mode: "commit", rows: ownerImportRows.map(({ row, errors, ...data }) => data) }) });
      if (!res.ok) throw new Error(await apiErrorMessage(res, "The owner import could not be completed."));
      const payload = await res.json();
      const processed = payload.rows as Array<{ row: number; errors: Record<string, string> }>;
      const failed = processed.filter((entry) => Object.keys(entry.errors || {}).length);
      if (failed.length) {
        setOwnerImportRows((current) => current.map((entry) => ({ ...entry, errors: failed.find((failure) => failure.row === entry.row)?.errors || {} })));
        setOwnerImportError(`${failed.length} row(s) need attention. Correct the CSV and upload again; valid rows were saved.`);
      } else {
        setShowBulkOwnerModal(false); setOwnerImportRows([]); setOwnerImportFile("");
        await loadOwners();
      }
    } catch (err) {
      setOwnerImportError(err instanceof Error ? err.message : "The owner import could not be completed.");
    } finally { setOwnerImportBusy(false); }
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
            <button type="button" className="btn ghost sm" onClick={() => setShowBulkOwnerModal(true)}>
              <Upload size={14} style={{ marginRight: 6 }} /> Upload owners CSV
            </button>
          )}
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
                      <div style={{ display: "flex", gap: 6 }}>
                        <button
                          type="button"
                          className="btn ghost sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSelectOwner(o);
                          }}
                        >
                          Ledger
                        </button>
                        <button
                          type="button"
                          className="btn primary sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            void fetchRemittanceStatement(o);
                          }}
                          title="Generate Landlord Remittance Statement"
                        >
                          <DollarSign size={13} style={{ marginRight: 3 }} /> Statement
                        </button>
                      </div>
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
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                <div style={{ fontWeight: 600, fontSize: 13, color: "#a5b4fc", display: "flex", alignItems: "center", gap: 6 }}>
                  <DollarSign size={15} /> Landlord Ledger & Financial Summary
                </div>
                <button
                  type="button"
                  className="btn primary sm"
                  onClick={() => selectedOwner && void fetchRemittanceStatement(selectedOwner)}
                  style={{ fontSize: 11, height: 26, padding: "2px 10px" }}
                >
                  <DollarSign size={12} style={{ marginRight: 2 }} /> Remittance Statement
                </button>
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

            <div style={{ padding: "12px 14px", borderRadius: 8, background: "var(--surface)", border: "1px solid var(--border)", fontSize: 13 }}>
              <div style={{ fontWeight: 600, marginBottom: 8 }}>Sectional-title engagement</div>
              <label style={{ display: "block", marginBottom: 8 }}><input type="checkbox" checked={newOwnerForm.engaged_for_unit_management} onChange={(event) => setNewOwnerForm({ ...newOwnerForm, engaged_for_unit_management: event.target.checked })} /> Engaged for individual unit management</label>
              <label style={{ display: "block", marginBottom: 8 }}><input type="checkbox" checked={newOwnerForm.engaged_for_letting} onChange={(event) => setNewOwnerForm({ ...newOwnerForm, engaged_for_letting: event.target.checked })} /> Engaged for letting / agency</label>
              <label style={{ display: "block" }}><input type="checkbox" checked={newOwnerForm.is_management_company} onChange={(event) => setNewOwnerForm({ ...newOwnerForm, is_management_company: event.target.checked })} /> This is the property management company</label>
              <div style={{ color: "var(--muted)", marginTop: 8, fontSize: 12 }}>Service charge is billed to the unit owner. These flags only make an owner eligible for optional management or letting fees.</div>
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

      {showBulkOwnerModal && (
        <Modal title="Bulk onboard landlords & owners" onClose={() => !ownerImportBusy && setShowBulkOwnerModal(false)} maxWidth="lg">
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ color: "var(--muted)", fontSize: 13 }}>Upload up to 500 owners. Optionally map their units using a semicolon-separated <strong>unit_codes</strong> value. Existing owners are safely updated by PIN, email, or exact name.</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button type="button" className="btn ghost sm" onClick={downloadOwnerTemplate}><Download size={14} style={{ marginRight: 6 }} /> Download CSV template</button>
              <label className="btn primary sm" style={{ cursor: "pointer" }}><Upload size={14} style={{ marginRight: 6 }} /> Choose CSV<input hidden type="file" accept=".csv,text/csv" onChange={(event) => { void parseOwnerFile(event.target.files?.[0]); event.target.value = ""; }} /></label>
            </div>
            {ownerImportFile && <div style={{ fontSize: 13, fontWeight: 600 }}>Preview: {ownerImportFile} · {ownerImportRows.length} row(s)</div>}
            {ownerImportError && <ErrorBanner message={ownerImportError} />}
            {ownerImportRows.length > 0 && <div style={{ overflowX: "auto", maxHeight: 360, border: "1px solid var(--border)", borderRadius: 8 }}><table className="table" style={{ minWidth: 780 }}><thead><tr><th>Row</th><th>Owner</th><th>PIN</th><th>Units</th><th>Engagements</th><th>Status</th></tr></thead><tbody>{ownerImportRows.map((row) => <tr key={row.row}><td>{row.row}</td><td>{row.name || row.owner_name || row.landlord_name}</td><td>{row.pin_number || row.kra_pin || "—"}</td><td>{row.unit_codes || row.unit_code || "—"}</td><td>{row.engaged_for_unit_management === "yes" ? "Unit management " : ""}{row.engaged_for_letting === "yes" ? "Letting" : "—"}</td><td>{Object.keys(row.errors || {}).length ? <span className="badge badge-red">{Object.values(row.errors || {}).join(" ")}</span> : <span className="badge badge-green">Ready</span>}</td></tr>)}</tbody></table></div>}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button type="button" className="btn ghost" onClick={() => setShowBulkOwnerModal(false)}>Cancel</button>
              <button type="button" className="btn primary" disabled={!ownerImportRows.length || ownerImportRows.some((row) => Object.keys(row.errors || {}).length > 0) || ownerImportBusy} onClick={() => void importOwners()}>{ownerImportBusy ? "Importing…" : `Import ${ownerImportRows.length} owner(s)`}</button>
            </div>
          </div>
        </Modal>
      )}

      {/* Remittance Statement Preview Modal */}

      {remittanceOwner && (
        <Modal
          title={
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", paddingRight: 24 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Landmark size={18} color="#6366f1" />
                <span>Landlord Remittance Statement · {remittanceOwner.name}</span>
              </div>
              <span className="badge badge-purple" style={{ fontSize: 11 }}>
                {remittanceData?.reference_code || `REMIT-${remittanceOwner.code}-${String(remittancePeriod.month).padStart(2, "0")}-${remittancePeriod.year}`}
              </span>
            </div>
          }
          onClose={() => {
            setRemittanceOwner(null);
            setRemittanceData(null);
          }}
          maxWidth="lg"
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Period Navigation Toolbar */}
            <div style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 10,
              padding: "10px 14px",
              background: "var(--surface)",
              borderRadius: 8,
              border: "1px solid var(--border)",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: "var(--muted)" }}>Billing Period:</span>
                <select
                  value={remittancePeriod.month}
                  onChange={(e) => void fetchRemittanceStatement(remittanceOwner, Number(e.target.value), remittancePeriod.year)}
                  style={{ padding: "4px 8px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--surface-2)", fontSize: 12 }}
                >
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                    <option key={m} value={m}>
                      {new Date(2000, m - 1, 1).toLocaleString("default", { month: "long" })}
                    </option>
                  ))}
                </select>
                <select
                  value={remittancePeriod.year}
                  onChange={(e) => void fetchRemittanceStatement(remittanceOwner, remittancePeriod.month, Number(e.target.value))}
                  style={{ padding: "4px 8px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--surface-2)", fontSize: 12 }}
                >
                  {[2025, 2026, 2027, 2028].map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
                <button
                  type="button"
                  className="btn ghost sm"
                  onClick={() => void fetchRemittanceStatement(remittanceOwner, remittancePeriod.month, remittancePeriod.year)}
                  style={{ fontSize: 11, height: 26 }}
                >
                  <RefreshCw size={11} style={{ marginRight: 3 }} /> Refresh
                </button>
              </div>

              {/* Settlement Payout Destination */}
              <div style={{ fontSize: 12, display: "flex", alignItems: "center", gap: 6, color: "#818cf8" }}>
                <Landmark size={13} />
                <span>
                  Payout Route: <strong>{remittanceOwner.settlement_bank_name || "Bank"}</strong> · Acc: <strong className="mono">{remittanceOwner.settlement_bank_account || remittanceOwner.settlement_paybill_or_till || "Not Configured"}</strong>
                </span>
              </div>
            </div>

            {remittanceLoading ? (
              <LoadingState rows={4} />
            ) : remittanceError ? (

              <ErrorBanner message={remittanceError} />
            ) : remittanceData ? (
              <>
                {/* Executive Summary Metric Strip */}
                <div style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                  gap: 10,
                }}>
                  <div style={{ padding: "12px", borderRadius: 8, background: "rgba(16, 185, 129, 0.08)", border: "1px solid rgba(16, 185, 129, 0.2)" }}>
                    <div style={{ fontSize: 11, color: "var(--muted)", fontWeight: 600 }}>Gross Collections</div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: "#10b981", marginTop: 2 }}>
                      {money.format(remittanceData.total_gross_collected ?? 0)}
                    </div>
                  </div>

                  <div style={{ padding: "12px", borderRadius: 8, background: "rgba(245, 158, 11, 0.08)", border: "1px solid rgba(245, 158, 11, 0.2)" }}>
                    <div style={{ fontSize: 11, color: "var(--muted)", fontWeight: 600 }}>Agency Commission</div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: "#f59e0b", marginTop: 2 }}>
                      - {money.format(remittanceData.total_commission_deducted ?? 0)}
                    </div>
                  </div>

                  <div style={{ padding: "12px", borderRadius: 8, background: "rgba(139, 92, 246, 0.08)", border: "1px solid rgba(139, 92, 246, 0.2)" }}>
                    <div style={{ fontSize: 11, color: "var(--muted)", fontWeight: 600 }}>Service Charge Offset</div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: "#8b5cf6", marginTop: 2 }}>
                      - {money.format(remittanceData.total_service_charge_deducted ?? 0)}
                    </div>
                  </div>

                  <div style={{ padding: "12px", borderRadius: 8, background: "linear-gradient(135deg, rgba(99, 102, 241, 0.2) 0%, rgba(59, 130, 246, 0.2) 100%)", border: "1px solid rgba(99, 102, 241, 0.4)" }}>
                    <div style={{ fontSize: 11, color: "#a5b4fc", fontWeight: 700 }}>NET REMITTANCE PAYABLE</div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: "#38bdf8", marginTop: 2 }}>
                      {money.format(remittanceData.net_remittance_payable ?? 0)}
                    </div>
                  </div>
                </div>

                {/* Per-Unit Breakdown Table */}
                <div style={{ border: "1px solid var(--border)", borderRadius: 8, overflowX: "auto" }}>
                  <table className="table" style={{ width: "100%", minWidth: 700, fontSize: 12 }}>
                    <thead>
                      <tr>
                        <th>Unit Code</th>
                        <th>Property</th>
                        <th>Tenant</th>
                        <th style={{ textAlign: "right" }}>Monthly Rent</th>
                        <th style={{ textAlign: "right" }}>Gross Collected</th>
                        <th style={{ textAlign: "right" }}>Commission</th>
                        <th style={{ textAlign: "right" }}>SC Deducted</th>
                        <th style={{ textAlign: "right" }}>Net Payout</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(remittanceData.units || []).length > 0 ? (
                        remittanceData.units.map((u: any) => (
                          <tr key={u.unit_id}>
                            <td className="mono" style={{ fontWeight: 700, color: "#818cf8" }}>{u.unit_code}</td>
                            <td>{u.property_name || "—"}</td>
                            <td><strong>{u.tenant_name}</strong></td>
                            <td className="mono" style={{ textAlign: "right" }}>{money.format(u.monthly_rent)}</td>
                            <td className="mono" style={{ textAlign: "right", color: "#10b981", fontWeight: 600 }}>{money.format(u.gross_collected)}</td>
                            <td className="mono" style={{ textAlign: "right", color: "#f59e0b" }}>
                              {money.format(u.commission_deducted)} <span style={{ fontSize: 10, opacity: 0.7 }}>({u.commission_rate}%)</span>
                            </td>
                            <td className="mono" style={{ textAlign: "right", color: "#8b5cf6" }}>{money.format(u.service_charge_deducted)}</td>
                            <td className="mono" style={{ textAlign: "right", fontWeight: 700, color: "var(--text)" }}>{money.format(u.net_payout)}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={8} style={{ textAlign: "center", padding: 16, color: "var(--muted)" }}>
                            No active units recorded for this landlord in the selected billing period.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Modal Footer Actions */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
                  <div style={{ fontSize: 11, color: "var(--muted)" }}>
                    Generated on {new Date().toLocaleDateString("en-KE", { dateStyle: "long" })} • Authoritative Sectional Title Remittance
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      type="button"
                      className="btn ghost sm"
                      onClick={() => {
                        const rows = (remittanceData.units || []).map((u: any) => ({
                          unit_code: u.unit_code,
                          property: u.property_name,
                          tenant: u.tenant_name,
                          monthly_rent: u.monthly_rent,
                          gross_collected: u.gross_collected,
                          commission_deducted: u.commission_deducted,
                          service_charge_deducted: u.service_charge_deducted,
                          net_payout: u.net_payout,
                        }));
                        exportCsv(
                          rows,
                          [
                            { key: "unit_code", label: "Unit" },
                            { key: "property", label: "Property" },
                            { key: "tenant", label: "Tenant" },
                            { key: "monthly_rent", label: "Monthly Rent" },
                            { key: "gross_collected", label: "Gross Collected" },
                            { key: "commission_deducted", label: "Commission Deducted" },
                            { key: "service_charge_deducted", label: "SC Deducted" },
                            { key: "net_payout", label: "Net Payout" },
                          ],
                          `remittance-${remittanceOwner.code}-${remittancePeriod.month}-${remittancePeriod.year}.csv`
                        );
                      }}
                    >
                      <Download size={13} style={{ marginRight: 4 }} /> Export Statement CSV
                    </button>
                    <button
                      type="button"
                      className="btn primary sm"
                      onClick={() => window.print()}
                    >
                      <FileText size={13} style={{ marginRight: 4 }} /> Print / Save PDF
                    </button>
                  </div>
                </div>
              </>
            ) : null}
          </div>
        </Modal>
      )}
    </div>
  );
}

