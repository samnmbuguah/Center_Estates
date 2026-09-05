"use client";

import { useCallback, useRef, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { apiFetch, csrfFromCookie } from "@/lib/api";
import { csvCell as get, csvColumn as col, normalizeCsvHeader as norm, parseCsv } from "@/lib/csv";

type ParsedRow = {
  unit_code: string;
  name: string;
  tenant_type: string;
  address_1?: string;
  address_2?: string;
  city?: string;
  phone: string;
  email: string;
  tax_id: string;
  registration_number: string;
  contact_name?: string;
  contact_phone?: string;
  contact_email?: string;
  rent_type?: string;
  rent_collection_mode?: string;
  monthly_rent: string;
  rent_rate_per_sqft: string;
  lease_term_months: string;
  lease_start: string;
  service_charge_rate_per_sqft: string;
  vat_rate: string;
  billing_day: string;
  escalation_percent?: string;
  escalation_interval_months?: string;
  parking_bay?: string;
  parking_monthly_fee?: string;
  opening_balance_amount?: string;
  area?: string;
};

/** A zero rent explicitly represents a direct-to-landlord tenancy.  Do not
 * infer that from an empty value: an area-rate tenancy has no monthly total
 * until its selected unit is known. */
function isDirectLandlordRow(row: ParsedRow) {
  const rentType = (row.rent_type || "").trim().toLowerCase();
  const collectionMode = (row.rent_collection_mode || "").trim().toLowerCase();
  if (
    rentType === "direct_landlord" ||
    rentType === "landlord_managed" ||
    collectionMode === "direct_landlord" ||
    collectionMode === "landlord_direct"
  ) {
    return true;
  }
  return Boolean(String(row.monthly_rent ?? "").trim())
    && Number(row.monthly_rent) === 0
    && !String(row.rent_rate_per_sqft ?? "").trim();
}

type BulkResult = {
  total: number; succeeded_count: number; failed_count: number;
  succeeded: { row: number; tenant_code: string; tenant_name: string; lease_reference: string; unit_code: string }[];
  failed: { row: number; name: string; unit_code?: string; errors: Record<string, unknown> }[];
};

// Mirrored strictly from Tenant Application & Onboarding Card, with Unit Number as 1st column
const TEMPLATE_HEADERS = [
  "unit_code",
  "name",
  "tenant_type",
  "address_1",
  "address_2",
  "city",
  "phone",
  "email",
  "tax_id",
  "registration_number",
  "contact_name",
  "contact_phone",
  "contact_email",
  "rent_type",
  "rent_collection_mode",
  "monthly_rent",
  "rent_rate_per_sqft",
  "lease_term_months",
  "lease_start",
  "service_charge_rate_per_sqft",
  "vat_rate",
  "billing_day",
  "escalation_percent",
  "escalation_interval_months",
  "parking_bay",
  "parking_monthly_fee",
  "opening_balance_amount",
];

export function normalizeDateString(raw: string | number | null | undefined): string {
  if (!raw) return "";
  const str = String(raw).trim();
  if (!str) return "";

  // 1. ISO YYYY-MM-DD (or YYYY/MM/DD, YYYY.MM.DD)
  const isoMatch = str.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (isoMatch) {
    const y = isoMatch[1];
    const m = isoMatch[2].padStart(2, "0");
    const d = isoMatch[3].padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  // 2. Day-first: DD/MM/YYYY, DD-MM-YYYY, DD.MM.YYYY (or D/M/YYYY)
  const dmyMatch = str.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  if (dmyMatch) {
    const d = dmyMatch[1].padStart(2, "0");
    const m = dmyMatch[2].padStart(2, "0");
    const y = dmyMatch[3];
    return `${y}-${m}-${d}`;
  }

  // 3. Short year: DD/MM/YY, DD-MM-YY
  const dmyShortMatch = str.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2})$/);
  if (dmyShortMatch) {
    const d = dmyShortMatch[1].padStart(2, "0");
    const m = dmyShortMatch[2].padStart(2, "0");
    const y = Number(dmyShortMatch[3]) > 50 ? `19${dmyShortMatch[3]}` : `20${dmyShortMatch[3]}`;
    return `${y}-${m}-${d}`;
  }

  // 4. Excel integer serial date numbers (e.g. 45321)
  if (/^\d{5}$/.test(str)) {
    const serial = Number(str);
    const utcDays = serial - 25569;
    const utcValue = utcDays * 86400;
    const dateInfo = new Date(utcValue * 1000);
    if (!isNaN(dateInfo.getTime())) {
      return dateInfo.toISOString().split("T")[0];
    }
  }

  // 5. JavaScript natural language date parser (e.g., "1 Jan 2026", "August 1, 2026")
  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
    const y = parsed.getFullYear();
    const m = String(parsed.getMonth() + 1).padStart(2, "0");
    const d = String(parsed.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  return str;
}

function csvToRows(text: string): ParsedRow[] {
  const all = parseCsv(text);
  if (all.length < 2) return [];
  const h = all[0].map(norm);
  const cUnit = col(h, ['unit_code', 'unit', 'unit_no', 'unit_number', 'door_number', 'apartment_no', 'flat_number', 'assigned_unit']);
  const cName = col(h, ['name', 'tenant_name', 'company_name', 'full_name', 'tenant', 'tenant_company_legal_name', 'legal_name']);
  const cType = col(h, ['tenant_type', 'type', 'tenant_classification', 'classification']);
  const cAddr1 = col(h, ['address_1', 'postal_address', 'street_address', 'address_line_1', 'postal_street_address_line_1', 'postal_address_line_1']);
  const cAddr2 = col(h, ['address_2', 'suite_floor', 'suite_floor_address_line_2', 'address_line_2', 'suite', 'floor']);
  const cCity = col(h, ['city', 'town', 'city_town']);
  const cPhone = col(h, ['phone', 'mobile', 'phone_number', 'primary_phone_number', 'mobile_number', 'contact']);
  const cEmail = col(h, ['email', 'email_address', 'billing_email', 'billing_email_address']);
  const cTax = col(h, ['tax_id', 'kra_pin', 'pin', 'pin_number', 'kra_pin_tax_identifier', 'tax_identifier']);
  const cReg = col(h, ['registration_number', 'reg_no', 'registration', 'id_number', 'national_id', 'id_no', 'national_id_number', 'registration_certificate_number', 'certificate_number']);
  const cContactName = col(h, ['contact_name', 'authorized_contact_person', 'contact_person', 'representative']);
  const cContactPhone = col(h, ['contact_phone', 'contact_person_phone', 'contact_mobile']);
  const cContactEmail = col(h, ['contact_email', 'contact_person_email']);
  const cRentType = col(h, ['rent_type', 'rent_pricing_structure', 'pricing_structure']);
  const cRentCollectionMode = col(h, ['rent_collection_mode', 'rent_collection', 'rent_payee', 'rent_route']);
  const cArea = col(h, ['area', 'unit_area', 'sqft', 'square_feet', 'size']);
  const cStart = col(h, ['lease_start', 'start_date', 'starts_on', 'commencement_date', 'lease_commencement']);
  const cTerm = col(h, ['lease_term_months', 'term_months', 'term', 'lease_duration_months', 'lease_term']);
  const cMonthlyRent = col(h, ['monthly_rent', 'rent', 'fixed_rent', 'rent_amount', 'monthly_rent_kes', 'fixed_monthly_rent_kes', 'fixed_monthly_rent']);
  const cRentRate = col(h, ['rent_rate_per_sqft', 'rent_rate', 'rent_per_sqft', 'rate_per_sqft', 'rent_rate_sqft_kes']);
  const cSC = col(h, ['service_charge_rate_per_sqft', 'sc_rate', 'service_charge_rate', 'service_charge']);
  const cVat = col(h, ['vat_rate', 'vat', 'vat_percentage']);
  const cBill = col(h, ['billing_day', 'bill_day', 'rent_due_day', 'due_day', 'invoice_due_day']);
  const cEscPercent = col(h, ['escalation_percent', 'annual_rent_escalation', 'escalation', 'escalation_rate']);
  const cEscInterval = col(h, ['escalation_interval_months', 'escalation_interval', 'interval_months']);
  const cParkingBay = col(h, ['parking_bay', 'parking_space', 'parking_bay_code', 'bay_code']);
  const cParkingFee = col(h, ['parking_monthly_fee', 'parking_fee', 'monthly_parking_fee']);
  const cArrears = col(h, ['opening_balance_amount', 'opening_arrears_amount', 'opening_arrears', 'arrears']);

  return all.slice(1).map((row) => ({
    unit_code: get(row, cUnit),
    name: get(row, cName),
    tenant_type: get(row, cType) || 'individual',
    address_1: get(row, cAddr1),
    address_2: get(row, cAddr2),
    city: get(row, cCity),
    phone: get(row, cPhone),
    email: get(row, cEmail),
    tax_id: get(row, cTax),
    registration_number: get(row, cReg),
    contact_name: get(row, cContactName),
    contact_phone: get(row, cContactPhone),
    contact_email: get(row, cContactEmail),
    rent_type: get(row, cRentType) || 'fixed',
    rent_collection_mode: get(row, cRentCollectionMode),
    area: get(row, cArea),
    lease_start: normalizeDateString(get(row, cStart)),
    lease_term_months: get(row, cTerm) || '12',
    monthly_rent: get(row, cMonthlyRent),
    rent_rate_per_sqft: get(row, cRentRate),
    service_charge_rate_per_sqft: get(row, cSC) || '0',
    vat_rate: get(row, cVat) || '0',
    billing_day: get(row, cBill) || '1',
    escalation_percent: get(row, cEscPercent) || '0',
    escalation_interval_months: get(row, cEscInterval) || '12',
    parking_bay: get(row, cParkingBay),
    parking_monthly_fee: get(row, cParkingFee) || '0',
    opening_balance_amount: get(row, cArrears) || '0',
  })).filter((r) => r.name || r.unit_code);
}

function downloadTemplate() {
  const sample = [
    TEMPLATE_HEADERS,
    [
      'A-101', 'Grace Mwangi', 'individual', 'P.O. Box 45123', 'Ngong Road', 'Nairobi',
      '+254722123456', 'grace.mwangi@example.com', 'A001234567Z', '28456789',
      'Grace Mwangi', '+254722123456', 'grace.mwangi@example.com',
      'fixed', 'estate_managed', '25000', '', '12', '2026-09-01', '0', '0', '1', '0', '12', 'P-101', '2500', '0',
    ],
    [
      'A-102', 'Brian Kiprono', 'individual', 'P.O. Box 12890', 'Kilimani', 'Nairobi',
      '+254733987654', 'brian.kiprono@example.com', 'A009876543W', '31234567',
      'Brian Kiprono', '+254733987654', 'brian.kiprono@example.com',
      'fixed', 'estate_managed', '35000', '', '12', '01/09/2026', '0', '0', '1', '0', '12', 'P-102', '2500', '0',
    ],
    [
      'B-201', 'Faith Njeri Ndungu', 'individual', 'P.O. Box 78100', 'Kileleshwa', 'Nairobi',
      '+254711555888', 'faith.njeri@example.com', 'A005556667K', '29876543',
      'Faith Njeri Ndungu', '+254711555888', 'faith.njeri@example.com',
      'fixed', 'estate_managed', '50000', '', '12', '2026-09-01', '0', '0', '1', '5', '12', 'P-201', '3000', '0',
    ],
    [
      'B-202', 'Kevin Otieno & Linda Achieng', 'individual', 'P.O. Box 34500', 'Valley Arcade', 'Nairobi',
      '+254700112233', 'otieno.family@example.com', 'A007778889P', '27654321',
      'Kevin Otieno', '+254700112233', 'otieno.family@example.com',
      'fixed', 'estate_managed', '65000', '', '24', '01/09/2026', '0', '0', '1', '5', '12', 'P-202', '3000', '0',
    ],
    [
      'G-01', 'Savannah Retail Enterprises Ltd', 'company', 'P.O. Box 90210', 'Ground Floor Suite G-01', 'Nairobi',
      '+254722000111', 'accounts@savannahretail.co.ke', 'P051234567X', 'CPR/2022/12345',
      'James Mwangi', '+254722000112', 'jmwangi@savannahretail.co.ke',
      'rate_per_sqft', 'estate_managed', '85000', '100', '24', '2026-09-01', '35', '16', '1', '7.5', '12', 'P-COMM-01', '5000', '0',
    ],
    [
      'C-301', 'David Kamau (Sectional Landlord Unit)', 'individual', 'P.O. Box 55432', 'Kileleshwa', 'Nairobi',
      '+254711223344', 'david.kamau@example.com', 'A003344556L', '34567890',
      'David Kamau', '+254711223344', 'david.kamau@example.com',
      'direct_landlord', 'direct_landlord', '0', '', '12', '2026-09-01', '0', '0', '1', '0', '12', 'P-301', '0', '0',
    ],
  ];
  const csv = sample.map(r => r.map(v => `"${String(v).replaceAll('"', '""')}"`).join(',')).join('\r\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a'); a.href = url; a.download = 'tenant-bulk-upload-template.csv'; a.click();
  URL.revokeObjectURL(url);
}

export function BulkTenantUploader({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
  const { session } = useAuth();
  const organizationId = session?.activeOrganizationId ?? null;
  const fileRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [fileName, setFileName] = useState('');
  const [parseError, setParseError] = useState('');
  const [dragging, setDragging] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [autoActivate, setAutoActivate] = useState(true);
  const [result, setResult] = useState<BulkResult | null>(null);
  const [submitError, setSubmitError] = useState('');

  const processFile = useCallback((file: File) => {
    setParseError(''); setResult(null); setSubmitError('');
    if (!file.name.toLowerCase().endsWith('.csv')) { setParseError('Please upload a .csv file.'); return; }
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const parsed = csvToRows(text);
      if (!parsed.length) { setParseError('No valid data rows found. Check that the file matches the template headers.'); return; }
      setRows(parsed); setFileName(file.name);
    };
    reader.readAsText(file);
  }, []);

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (file) processFile(file);
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault(); setDragging(false);
    const file = e.dataTransfer.files?.[0]; if (file) processFile(file);
  }

  async function handleSubmit() {
    if (!rows.length || !organizationId) return;
    setSubmitting(true); setSubmitError('');
    try {
      await apiFetch('/auth/csrf/');
      const payload = {
        auto_create_units: true,
        auto_activate: autoActivate,
        rows: rows.map(r => {
          const rentType = (r.rent_type || '').trim().toLowerCase();
          const isDirect = isDirectLandlordRow(r);
          return {
            tenant: {
              name: r.name,
              tenant_type: r.tenant_type,
              email: r.email,
              phone: r.phone,
              tax_id: r.tax_id,
              registration_number: r.registration_number,
              billing_address: [r.address_1, r.address_2, r.city].filter(Boolean).join(", "),
              contact_person: {
                name: r.contact_name || "",
                phone: r.contact_phone || "",
                email: r.contact_email || "",
              },
            },
            lease: {
              unit_code: r.unit_code,
              area: r.area,
              starts_on: r.lease_start,
              term_months: Number(r.lease_term_months) || 12,
              rent_type: isDirect ? 'direct_landlord' : (rentType || 'fixed'),
              rent_collection_mode: isDirect ? 'direct_landlord' : 'estate_managed',
              monthly_rent: isDirect ? '0' : (r.monthly_rent || ''),
              status: autoActivate ? 'active' : 'draft',
              rent_rate_per_sqft: isDirect ? '0' : r.rent_rate_per_sqft,
              service_charge_rate_per_sqft: r.service_charge_rate_per_sqft,
              vat_rate: r.vat_rate,
              billing_day: Number(r.billing_day) || 1,
              escalation_percent: r.escalation_percent || '0',
              escalation_interval_months: Number(r.escalation_interval_months) || 12,
              parking_bay: r.parking_bay || '',
              parking_monthly_fee: r.parking_monthly_fee || '0',
              opening_balance_amount: r.opening_balance_amount || '0',
            },
          };
        })
      };
      const res = await apiFetch('/property/tenants/bulk-onboard/', {
        method:'POST',
        headers:{'Content-Type':'application/json','X-CSRFToken':csrfFromCookie()},
        body:JSON.stringify(payload),
      }, organizationId);
      
      const data = await res.json().catch(() => null);
      if (data && typeof data === 'object' && ('succeeded' in data || 'failed' in data)) {
        setResult(data as BulkResult);
      } else if (res.status === 401) {
        setSubmitError('Your session has expired. Please refresh the page to log in again.');
      } else if (!res.ok) {
        const msg = data?.detail || data?.rows || (typeof data === 'object' ? Object.entries(data).map(([k,v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : String(v)}`).join(' | ') : '') || `Upload failed with HTTP ${res.status}.`;
        setSubmitError(msg);
      } else {
        setSubmitError('Unexpected response from server.');
      }
    } catch(err) {
      setSubmitError(err instanceof Error ? err.message : 'Bulk upload failed.');
    } finally { setSubmitting(false); }
  }

  if (result) return (
    <div style={{padding:24,display:'flex',flexDirection:'column',gap:16}}>
      <div style={{display:'flex',gap:16,flexWrap:'wrap'}}>
        {[{n:result.succeeded_count,label:'Tenants created',bg:'#dcfce7',border:'#bbf7d0',c:'#166534'},
          {n:result.failed_count,label:'Failed rows',bg:result.failed_count?'#fee2e2':'#f0fdf4',border:result.failed_count?'#fecaca':'#bbf7d0',c:result.failed_count?'#991b1b':'#166534'},
          {n:result.total,label:'Total rows',bg:'#f0f9ff',border:'#bae6fd',c:'#0369a1'}
        ].map(({n,label,bg,border,c}) => (
          <div key={label} style={{flex:1,minWidth:110,padding:'14px 18px',background:bg,borderRadius:10,border:`1px solid ${border}`}}>
            <div style={{fontSize:24,fontWeight:900,color:c}}>{n}</div>
            <div style={{fontSize:12,color:c,fontWeight:600}}>{label}</div>
          </div>
        ))}
      </div>

      {result.failed_count > 0 && (
        <div style={{background:'#fff1f2',border:'1px solid #fecdd3',borderRadius:10,padding:'14px 18px',display:'flex',justifyContent:'space-between',alignItems:'center',gap:14,flexWrap:'wrap'}}>
          <div>
            <div style={{fontWeight:800,fontSize:13,color:'#9f1239'}}>💡 How to fix the errors below:</div>
            <div style={{fontSize:12,color:'#be123c',marginTop:3}}>
              If units are missing or have 0 sq ft area, either add the units with their square footage under <strong>Property ➔ Units</strong> or add the <code>area</code> column in your CSV.
            </div>
          </div>
          <div style={{display:'flex',gap:8}}>
            <button className="btn sm" style={{background:'#e11d48',color:'#fff',border:'none',fontWeight:700,fontSize:12}} onClick={() => { onCancel(); window.location.href = '/property?tab=units'; }}>
              🏢 Go to Units Tab &rarr;
            </button>
            <button className="btn ghost sm" style={{fontSize:12}} onClick={downloadTemplate}>
              ⬇ Download Template
            </button>
          </div>
        </div>
      )}

      {result.succeeded.length > 0 && (
        <div>
          <div style={{fontSize:13,fontWeight:700,marginBottom:8,color:'#166534'}}>✅ Successful imports</div>
          <div style={{overflowX:'auto'}}>
            <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
              <thead><tr style={{background:'#f0fdf4',borderBottom:'1px solid #bbf7d0'}}>
                {['Row','Unit','Code','Name','Lease Ref'].map(h=><th key={h} style={{padding:'8px 10px',textAlign:'left',color:'#166534'}}>{h}</th>)}
              </tr></thead>
              <tbody>{result.succeeded.map(s=><tr key={s.row} style={{borderBottom:'1px solid #e7fde8'}}>
                <td style={{padding:'6px 10px'}}>{s.row}</td>
                <td style={{padding:'6px 10px',fontFamily:'monospace',fontWeight:800,color:'#166534'}}>{s.unit_code}</td>
                <td style={{padding:'6px 10px',fontFamily:'monospace'}}>{s.tenant_code}</td>
                <td style={{padding:'6px 10px'}}>{s.tenant_name}</td>
                <td style={{padding:'6px 10px',fontFamily:'monospace'}}>{s.lease_reference}</td>
              </tr>)}</tbody>
            </table>
          </div>
        </div>
      )}

      {result.failed.length > 0 && (
        <div>
          <div style={{fontSize:13,fontWeight:700,marginBottom:8,color:'#991b1b'}}>❌ Validation Issues — Please Review</div>
          <div style={{overflowX:'auto'}}>
            <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
              <thead><tr style={{background:'#fff7f7',borderBottom:'1px solid #fecaca'}}>
                {['Row','Unit','Tenant Name','Error Details','Action'].map(h=><th key={h} style={{padding:'8px 10px',textAlign:'left',color:'#991b1b'}}>{h}</th>)}
              </tr></thead>
              <tbody>{result.failed.map(f=><tr key={f.row} style={{borderBottom:'1px solid #fee2e2'}}>
                <td style={{padding:'6px 10px',fontWeight:700}}>{f.row}</td>
                <td style={{padding:'6px 10px',fontFamily:'monospace',fontWeight:800,color:'#991b1b'}}>{f.unit_code || '—'}</td>
                <td style={{padding:'6px 10px',fontWeight:600}}>{f.name}</td>
                <td style={{padding:'6px 10px',color:'#dc2626'}}>
                  {typeof f.errors === 'object' ? Object.entries(f.errors).map(([k,v])=>`${k}: ${String(v)}`).join(' | ') : String(f.errors)}
                </td>
                <td style={{padding:'6px 10px'}}>
                  <button className="btn sm ghost" style={{fontSize:11,padding:'2px 8px'}} onClick={() => { onCancel(); window.location.href = '/property?tab=units'; }}>
                    Configure Unit
                  </button>
                </td>
              </tr>)}</tbody>
            </table>
          </div>
        </div>
      )}

      <div style={{display:'flex',gap:10,justifyContent:'flex-end',flexWrap:'wrap'}}>
        {result.failed_count > 0 && (
          <button className="btn ghost" onClick={()=>{setResult(null);setRows([]);setFileName('');}}>Upload another file</button>
        )}
        <button className="btn primary" onClick={onDone}>Done — view tenants</button>
      </div>
    </div>
  );

  return (
    <div style={{padding:24,display:'flex',flexDirection:'column',gap:18}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',flexWrap:'wrap',gap:12}}>
        <div>
          <h3 style={{margin:0,fontSize:16,fontWeight:800}}>Bulk Tenant Upload via CSV / Excel</h3>
          <p style={{margin:'4px 0 0',fontSize:13,color:'var(--muted)'}}>
            Mirrors the <strong>Tenant Application &amp; Onboarding Card</strong>. Each row creates a legal tenant profile and signed draft lease.
          </p>
        </div>
        <button className="btn ghost sm" onClick={downloadTemplate} style={{display:'flex',alignItems:'center',gap:6,fontSize:12,fontWeight:700}}>
          ⬇ Download CSV template (Unit First)
        </button>
      </div>
      <div style={{background:'var(--surface-2,#f8fafc)',border:'1px solid var(--border)',borderRadius:8,padding:'12px 14px',fontSize:12,display:'flex',flexDirection:'column',gap:8}}>
        <div>
          <span style={{color:'var(--primary,#0284c7)',fontWeight:800}}>Column 1 (Required):</span> <code>unit_code</code> (e.g. <code>A-101</code>, <code>B-201</code>, <code>G-01</code>)
          <span style={{margin:'0 8px',color:'var(--border)'}}>|</span>
          <strong>Required Profile Fields:</strong> <span style={{color:'var(--muted)'}}>name, lease_start, and either monthly_rent or rent_rate_per_sqft</span>
        </div>
        <div style={{fontSize:11,color:'var(--text-secondary)'}}>
          <strong>Card Mirrored Fields:</strong> <code>address_1</code>, <code>address_2</code>, <code>city</code>, <code>phone</code>, <code>email</code>, <code>tax_id</code>, <code>registration_number</code>, <code>contact_name</code>, <code>contact_phone</code>, <code>contact_email</code>, <code>rent_type</code>, <code>vat_rate</code>, <code>escalation_percent</code>, <code>parking_bay</code>, <code>parking_monthly_fee</code>, <code>opening_balance_amount</code>.
        </div>
        <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap',color:'var(--text-primary)',background:'rgba(16,185,129,0.08)',border:'1px solid rgba(16,185,129,0.25)',borderRadius:6,padding:'6px 10px'}}>
          <span style={{color:'#15803d',fontWeight:800,fontSize:11}}>
            📅 Date Recognition:
          </span>
          <span style={{fontSize:11,color:'var(--text-secondary)'}}>
            Accepts both <strong>YYYY-MM-DD</strong> (e.g. <code>2026-09-01</code>) and <strong>DD/MM/YYYY</strong> (e.g. <code>01/09/2026</code>) automatically.
          </span>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap',color:'var(--text-primary)',background:'rgba(2,132,199,0.08)',border:'1px solid rgba(2,132,199,0.25)',borderRadius:6,padding:'6px 10px'}}>
          <span style={{color:'#0284c7',fontWeight:800,fontSize:11}}>
            🏢 Sectional &amp; Landlord-Owned Units:
          </span>
          <span style={{fontSize:11,color:'var(--text-secondary)'}}>
            For tenant units where rent is paid directly to the unit owner/landlord, set <code>rent_type</code> to <code>direct_landlord</code> (or <code>monthly_rent</code> to <code>0</code>). Estate management will not bill rent, but utilities and meter readings are automatically billed to the occupant.
          </span>
        </div>
      </div>
      <div
        onDragOver={(e)=>{e.preventDefault();setDragging(true);}}
        onDragLeave={()=>setDragging(false)}
        onDrop={onDrop}
        onClick={()=>fileRef.current?.click()}
        style={{
          border:`2px dashed ${dragging?'#e23b3b':'var(--border)'}`,
          borderRadius:12,padding:'32px 24px',textAlign:'center',cursor:'pointer',
          background:dragging?'rgba(226,59,59,0.04)':'var(--surface-2,#f8fafc)',
          transition:'border-color 0.15s,background 0.15s',
        }}
      >
        <div style={{fontSize:36,marginBottom:10}}>📂</div>
        {fileName ? (
          <div>
            <div style={{fontWeight:700,fontSize:14}}>📄 {fileName}</div>
            <div style={{color:'var(--muted)',fontSize:13,marginTop:4}}>{rows.length} tenant rows parsed — click to change file</div>
          </div>
        ) : (
          <div>
            <div style={{fontWeight:600,fontSize:14}}>Drag &amp; drop a CSV here, or click to browse</div>
            <div style={{color:'var(--muted)',fontSize:13,marginTop:4}}>Only .csv files are accepted</div>
          </div>
        )}
        <input ref={fileRef} type="file" accept=".csv" style={{display:'none'}} onChange={onFileChange} />
      </div>
      {parseError && <div style={{background:'#fee2e2',color:'#991b1b',padding:'10px 14px',borderRadius:8,fontSize:13}}>⚠️ {parseError}</div>}
      {submitError && <div style={{background:'#fee2e2',color:'#991b1b',padding:'10px 14px',borderRadius:8,fontSize:13}}>❌ {submitError}</div>}
      {rows.length > 0 && (() => {
        const validationIssues = rows.map((r, i) => {
          const issues: string[] = [];
          if (!r.unit_code) issues.push("Missing unit code (Column 1)");
          if (!r.name) issues.push("Missing tenant name");
          if (!r.lease_start) {
            issues.push("Missing lease start date");
          } else if (!/^\d{4}-\d{2}-\d{2}$/.test(r.lease_start)) {
            issues.push("Invalid date format (use YYYY-MM-DD or DD/MM/YYYY)");
          }
          const isDirect = isDirectLandlordRow(r);
          if (!isDirect && !r.monthly_rent && !r.rent_rate_per_sqft) issues.push("Missing rent or rate");
          return { row: i + 1, issues };
        });
        const hasErrors = validationIssues.some(v => v.issues.length > 0);
        const multiUnitTenants = Object.entries(
          rows.reduce((acc, r) => {
            if (r.name) acc[r.name] = (acc[r.name] || 0) + 1;
            return acc;
          }, {} as Record<string, number>)
        ).filter(([, count]) => count > 1);
        const directLandlordCount = rows.filter((r) => {
          const rentType = (r.rent_type || '').trim().toLowerCase();
          return rentType === 'direct_landlord' || rentType === 'landlord_managed' || Number(r.monthly_rent || 0) === 0;
        }).length;
        const estateManagedCount = rows.length - directLandlordCount;

        return (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
              <div style={{ fontSize: 13, fontWeight: 700 }}>Preview — {rows.length} tenant row{rows.length !== 1 ? 's' : ''} parsed (Mirrors Card)</div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <span style={{ fontSize: 11, background: "#e0f2fe", color: "#075985", padding: "3px 8px", borderRadius: 12, fontWeight: 700 }}>
                  {directLandlordCount} utility-only / direct landlord
                </span>
                <span style={{ fontSize: 11, background: "#dcfce7", color: "#166534", padding: "3px 8px", borderRadius: 12, fontWeight: 700 }}>
                  {estateManagedCount} estate-rent billed
                </span>
                {multiUnitTenants.length > 0 && (
                  <span style={{ fontSize: 11, background: "#e0e7ff", color: "#4338ca", padding: "3px 8px", borderRadius: 12, fontWeight: 700 }}>
                    🏢 {multiUnitTenants.length} Multi-Unit Tenant{multiUnitTenants.length > 1 ? "s" : ""} Detected
                  </span>
                )}
                {hasErrors ? (
                  <span style={{ fontSize: 11, background: "#fee2e2", color: "#991b1b", padding: "3px 8px", borderRadius: 12, fontWeight: 700 }}>
                    ⚠️ Issues detected in some rows
                  </span>
                ) : (
                  <span style={{ fontSize: 11, background: "#dcfce7", color: "#166534", padding: "3px 8px", borderRadius: 12, fontWeight: 700 }}>
                    ✓ All rows valid
                  </span>
                )}
              </div>
            </div>

            <div style={{ overflowX: 'auto', maxHeight: 440, border: '1px solid var(--border)', borderRadius: 10, background: "var(--surface)" }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead style={{ position: 'sticky', top: 0, zIndex: 2 }}>
                  <tr style={{ background: 'var(--surface-sunken, var(--surface-2))', borderBottom: '2px solid var(--border)' }}>
                    {['#', 'Validation', 'Unit Number (Col 1)', 'Tenant Legal Name', 'Classification', 'Address & Contact', 'KRA PIN / Reg', 'Lease Term & Start', 'Rent & Charges', 'Parking & Arrears'].map(h => (
                      <th key={h} style={{ padding: '10px 12px', textAlign: 'left', color: 'var(--text-primary)', fontWeight: 800, whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => {
                    const rowIssues = validationIssues[i]?.issues || [];
                    const isValid = rowIssues.length === 0;
                    return (
                      <tr key={i} style={{ borderBottom: '1px solid var(--border)', background: isValid ? (i % 2 === 0 ? 'transparent' : 'rgba(0,0,0,0.02)') : 'rgba(239, 68, 68, 0.05)' }}>
                        <td style={{ padding: '8px 12px', color: 'var(--muted)', fontWeight: 700 }}>{i + 1}</td>
                        <td style={{ padding: '8px 12px' }}>
                          {isValid ? (
                            <span style={{ color: "#16a34a", background: "#dcfce7", padding: "3px 8px", borderRadius: 10, fontWeight: 800, fontSize: 11 }}>✓ Ready</span>
                          ) : (
                            <span style={{ color: "#991b1b", background: "#fee2e2", padding: "3px 8px", borderRadius: 10, fontWeight: 800, fontSize: 11 }} title={rowIssues.join(", ")}>
                              ⚠️ {rowIssues[0]}
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '8px 12px', fontFamily: 'monospace', fontWeight: 900, color: "var(--primary)" }}>
                          {r.unit_code || <span style={{ color: '#dc2626' }}>MISSING</span>}
                        </td>
                        <td style={{ padding: '8px 12px', fontWeight: 700, color: "var(--text-primary)", maxWidth: 200, whiteSpace: "normal" }}>
                          {r.name || <span style={{ color: '#dc2626', fontWeight: 800 }}>MISSING</span>}
                        </td>
                        <td style={{ padding: '8px 12px', textTransform: 'capitalize' }}>{r.tenant_type}</td>
                        <td style={{ padding: '8px 12px', fontSize: 11, color: "var(--text-secondary)", maxWidth: 220 }}>
                          {r.phone && <div>📞 {r.phone}</div>}
                          {r.email && <div>✉ {r.email}</div>}
                          {r.city && <div style={{ color: "var(--muted)" }}>📍 {[r.address_1, r.city].filter(Boolean).join(", ")}</div>}
                          {r.contact_name && <div style={{ fontSize: 10, color: "var(--primary)" }}>👤 {r.contact_name}</div>}
                          {!r.phone && !r.email && <span>—</span>}
                        </td>
                        <td style={{ padding: '8px 12px', fontFamily: 'monospace', fontSize: 11 }}>
                          {r.tax_id || r.registration_number ? `${r.tax_id || ''} ${r.registration_number ? `(${r.registration_number})` : ''}` : '—'}
                        </td>
                        <td style={{ padding: '8px 12px', fontFamily: 'monospace', fontSize: 11 }}>
                          <div>{r.lease_start || <span style={{ color: '#dc2626' }}>MISSING</span>}</div>
                          <div style={{ color: "var(--text-secondary)" }}>{r.lease_term_months} mo term</div>
                        </td>
                        <td style={{ padding: '8px 12px', fontSize: 11 }}>
                          {(() => {
                            const isDirect = isDirectLandlordRow(r);
                            if (isDirect) {
                              return (
                                <div>
                                  <span style={{ display: 'inline-block', background: '#e0f2fe', color: '#0369a1', padding: '2px 6px', borderRadius: 4, fontWeight: 700, fontSize: 10 }}>
                                    Direct to Landlord
                                  </span>
                                  <div style={{ color: "var(--muted)", fontSize: 10, marginTop: 2 }}>KES 0 Rent to Mgmt</div>
                                </div>
                              );
                            }
                            return (
                              <span style={{ fontFamily: 'monospace', fontWeight: 800, color: "var(--text-primary)" }}>
                                {r.monthly_rent ? `KES ${Number(r.monthly_rent).toLocaleString()}/mo` : r.rent_rate_per_sqft ? `KES ${r.rent_rate_per_sqft}/sqft` : <span style={{ color: '#dc2626' }}>MISSING</span>}
                              </span>
                            );
                          })()}
                          {Number(r.service_charge_rate_per_sqft || 0) > 0 && (
                            <div style={{ color: "var(--text-secondary)", fontSize: 10 }}>SC: KES {r.service_charge_rate_per_sqft}/sqft</div>
                          )}
                          <div style={{ color: "var(--muted)", fontSize: 10 }}>VAT: {r.vat_rate || "0"}%</div>
                        </td>
                        <td style={{ padding: '8px 12px', fontSize: 11 }}>
                          {r.parking_bay && <div>🚗 {r.parking_bay} (KES {r.parking_monthly_fee || '0'})</div>}
                          {Number(r.opening_balance_amount || 0) > 0 && <div style={{ color: '#b45309', fontWeight: 700 }}>Arrears: KES {Number(r.opening_balance_amount).toLocaleString()}</div>}
                          {!r.parking_bay && !Number(r.opening_balance_amount || 0) && <span style={{ color: "var(--muted)" }}>—</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'var(--surface-2, #f8fafc)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              padding: '10px 14px',
              marginTop: 4,
            }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                <input
                  type="checkbox"
                  checked={autoActivate}
                  onChange={(e) => setAutoActivate(e.target.checked)}
                  style={{ width: 16, height: 16 }}
                />
                <span>
                  <strong>Immediately activate leases &amp; mark units as Occupied</strong> (updates stacking plan &amp; occupancy metrics)
                </span>
              </label>
              <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                {autoActivate ? "Units will become 'Occupied'" : "Leases will stay in 'Draft'"}
              </span>
            </div>
          </div>
        );
      })()}
      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
        <button className="btn ghost" onClick={onCancel} disabled={submitting}>Cancel</button>
        <button
          className="btn primary"
          onClick={() => void handleSubmit()}
          disabled={!rows.length || submitting}
          style={{ display: 'flex', alignItems: 'center', gap: 8 }}
        >
          {submitting ? `Uploading ${rows.length} tenants…` : `⬆ Upload ${rows.length} tenant${rows.length !== 1 ? 's' : ''}`}
        </button>
      </div>
    </div>
  );
}
