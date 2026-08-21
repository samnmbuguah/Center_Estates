"use client";

import { useCallback, useRef, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { apiFetch, csrfFromCookie } from "@/lib/api";

type ParsedRow = {
  name: string; tenant_type: string; email: string; phone: string;
  tax_id: string; registration_number: string; unit_code: string;
  lease_start: string; lease_term_months: string;
  monthly_rent: string; rent_rate_per_sqft: string;
  service_charge_rate_per_sqft: string; vat_rate: string;
  security_deposit: string; billing_day: string;
};

type BulkResult = {
  total: number; succeeded_count: number; failed_count: number;
  succeeded: { row: number; tenant_code: string; tenant_name: string; lease_reference: string; unit_code: string }[];
  failed: { row: number; name: string; errors: Record<string, unknown> }[];
};

const TEMPLATE_HEADERS = [
  "name","tenant_type","email","phone","tax_id","registration_number",
  "unit_code","lease_start","lease_term_months","monthly_rent","rent_rate_per_sqft",
  "service_charge_rate_per_sqft","vat_rate","security_deposit","billing_day",
];

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], cell = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"' && quoted && text[i + 1] === '"') { cell += '"'; i++; }
    else if (c === '"') quoted = !quoted;
    else if (c === ',' && !quoted) { row.push(cell.trim()); cell = ''; }
    else if ((c === '\n' || c === '\r') && !quoted) {
      if (c === '\r' && text[i+1] === '\n') i++;
      row.push(cell.trim());
      if (row.some(Boolean)) rows.push(row);
      row = []; cell = '';
    } else cell += c;
  }
  row.push(cell.trim());
  if (row.some(Boolean)) rows.push(row);
  return rows;
}

function norm(h: string) {
  return h.replace(/^\uFEFF/,'').trim().toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,'');
}

function col(headers: string[], aliases: string[]): number {
  const a = aliases.map(norm);
  return a.reduce((f, x) => f >= 0 ? f : headers.indexOf(x), -1);
}

function get(row: string[], idx: number) { return idx >= 0 ? (row[idx] ?? '').trim() : ''; }

function csvToRows(text: string): ParsedRow[] {
  const all = parseCsv(text);
  if (all.length < 2) return [];
  const h = all[0].map(norm);
  const cName = col(h,['name','tenant_name','company_name']);
  const cType = col(h,['tenant_type','type']);
  const cEmail = col(h,['email']);
  const cPhone = col(h,['phone','mobile']);
  const cTax = col(h,['tax_id','kra_pin','pin']);
  const cReg = col(h,['registration_number','reg_no','registration']);
  const cUnit = col(h,['unit_code','unit','unit_no']);
  const cStart = col(h,['lease_start','start_date','starts_on']);
  const cTerm = col(h,['lease_term_months','term_months','term']);
  const cMonthlyRent = col(h,['monthly_rent','rent','fixed_rent','rent_amount']);
  const cRent = col(h,['rent_rate_per_sqft','rent_rate','rent_per_sqft']);
  const cSC = col(h,['service_charge_rate_per_sqft','sc_rate','service_charge_rate']);
  const cVat = col(h,['vat_rate','vat']);
  const cDep = col(h,['security_deposit','deposit']);
  const cBill = col(h,['billing_day','bill_day']);
  return all.slice(1).map((row) => ({
    name: get(row,cName), tenant_type: get(row,cType)||'company',
    email: get(row,cEmail), phone: get(row,cPhone),
    tax_id: get(row,cTax), registration_number: get(row,cReg),
    unit_code: get(row,cUnit), lease_start: get(row,cStart),
    lease_term_months: get(row,cTerm)||'12',
    monthly_rent: get(row,cMonthlyRent),
    rent_rate_per_sqft: get(row,cRent),
    service_charge_rate_per_sqft: get(row,cSC)||'0',
    vat_rate: get(row,cVat)||'16',
    security_deposit: get(row,cDep)||'0',
    billing_day: get(row,cBill)||'1',
  })).filter((r) => r.name);
}

function downloadTemplate() {
  const sample = [
    TEMPLATE_HEADERS,
    [
      'Acme East Africa Ltd', 'company', 'accounts@acme.co.ke', '0712345678', 'P051234567X', 'CPR/2020/12345',
      'FL1-UNIT-A', '2026-01-01', '24', '100000', '', '15', '16', '100000', '1',
    ],
    [
      'Acme East Africa Ltd', 'company', 'accounts@acme.co.ke', '0712345678', 'P051234567X', 'CPR/2020/12345',
      'FL2-UNIT-B', '2026-03-01', '12', '120000', '', '15', '16', '120000', '1',
    ],
    [
      'Kilima Tech Ventures', 'individual', 'info@kilimatech.co.ke', '0722000111', 'A009876543Z', 'BN-2023-887',
      'FL3-SUITE-1', '2026-02-01', '12', '45000', '', '10', '16', '45000', '5',
    ],
  ];
  const csv = sample.map(r => r.map(v => `"${String(v).replaceAll('"','""')}"`).join(',')).join('\r\n');
  const url = URL.createObjectURL(new Blob([csv], {type:'text/csv;charset=utf-8'}));
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
      const payload = { rows: rows.map(r => ({
        tenant: { name:r.name, tenant_type:r.tenant_type, email:r.email, phone:r.phone, tax_id:r.tax_id, registration_number:r.registration_number },
        lease: { unit_code:r.unit_code, starts_on:r.lease_start, term_months:Number(r.lease_term_months)||12,
          monthly_rent:r.monthly_rent || '', rent_rate_per_sqft:r.rent_rate_per_sqft, service_charge_rate_per_sqft:r.service_charge_rate_per_sqft,
          vat_rate:r.vat_rate, security_deposit:r.security_deposit, billing_day:Number(r.billing_day)||1 },
      })) };
      const res = await apiFetch('/property/tenants/bulk-onboard/', {
        method:'POST',
        headers:{'Content-Type':'application/json','X-CSRFToken':csrfFromCookie()},
        body:JSON.stringify(payload),
      }, organizationId);
      
      const data = await res.json().catch(() => null);
      if (data && typeof data === 'object' && ('succeeded' in data || 'failed' in data)) {
        setResult(data as BulkResult);
      } else if (!res.ok) {
        setSubmitError(data?.detail || data?.rows || `Upload failed with HTTP ${res.status}.`);
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
      {result.succeeded.length > 0 && (
        <div>
          <div style={{fontSize:13,fontWeight:700,marginBottom:8,color:'#166534'}}>✅ Successful imports</div>
          <div style={{overflowX:'auto'}}>
            <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
              <thead><tr style={{background:'#f0fdf4',borderBottom:'1px solid #bbf7d0'}}>
                {['Row','Code','Name','Lease Ref','Unit'].map(h=><th key={h} style={{padding:'8px 10px',textAlign:'left',color:'#166534'}}>{h}</th>)}
              </tr></thead>
              <tbody>{result.succeeded.map(s=><tr key={s.row} style={{borderBottom:'1px solid #e7fde8'}}>
                <td style={{padding:'6px 10px'}}>{s.row}</td>
                <td style={{padding:'6px 10px',fontFamily:'monospace'}}>{s.tenant_code}</td>
                <td style={{padding:'6px 10px'}}>{s.tenant_name}</td>
                <td style={{padding:'6px 10px',fontFamily:'monospace'}}>{s.lease_reference}</td>
                <td style={{padding:'6px 10px',fontFamily:'monospace'}}>{s.unit_code}</td>
              </tr>)}</tbody>
            </table>
          </div>
        </div>
      )}
      {result.failed.length > 0 && (
        <div>
          <div style={{fontSize:13,fontWeight:700,marginBottom:8,color:'#991b1b'}}>❌ Failed rows — fix and re-upload</div>
          <div style={{overflowX:'auto'}}>
            <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
              <thead><tr style={{background:'#fff7f7',borderBottom:'1px solid #fecaca'}}>
                {['Row','Name','Error'].map(h=><th key={h} style={{padding:'8px 10px',textAlign:'left',color:'#991b1b'}}>{h}</th>)}
              </tr></thead>
              <tbody>{result.failed.map(f=><tr key={f.row} style={{borderBottom:'1px solid #fee2e2'}}>
                <td style={{padding:'6px 10px'}}>{f.row}</td>
                <td style={{padding:'6px 10px'}}>{f.name}</td>
                <td style={{padding:'6px 10px',color:'#dc2626'}}>
                  {typeof f.errors === 'object' ? Object.entries(f.errors).map(([k,v])=>`${k}: ${String(v)}`).join(' | ') : String(f.errors)}
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
          <h3 style={{margin:0,fontSize:16,fontWeight:800}}>Bulk Tenant Upload via CSV</h3>
          <p style={{margin:'4px 0 0',fontSize:13,color:'var(--muted)'}}>Upload up to 500 tenants at once. Each row creates a tenant profile and a draft lease.</p>
        </div>
        <button className="btn ghost sm" onClick={downloadTemplate} style={{display:'flex',alignItems:'center',gap:6,fontSize:12}}>
          ⬇ Download CSV template
        </button>
      </div>
      <div style={{background:'var(--surface-2,#f8fafc)',border:'1px solid var(--border)',borderRadius:8,padding:'10px 14px',fontSize:12}}>
        <strong>Required:</strong> <span style={{color:'var(--muted)'}}>name, unit_code, lease_start, and either monthly_rent or rent_rate_per_sqft</span>
        <span style={{margin:'0 8px',color:'var(--border)'}}>|</span>
        <strong>Optional:</strong> <span style={{color:'var(--muted)'}}>tenant_type, email, phone, tax_id, registration_number, lease_term_months, service_charge_rate_per_sqft, vat_rate, security_deposit, billing_day</span>
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
          if (!r.name) issues.push("Missing name");
          if (!r.unit_code) issues.push("Missing unit code");
          if (!r.lease_start || !/^\d{4}-\d{2}-\d{2}$/.test(r.lease_start)) issues.push("Invalid date (YYYY-MM-DD)");
          if (!r.monthly_rent && !r.rent_rate_per_sqft) issues.push("Missing rent or rate");
          return { row: i + 1, issues };
        });
        const hasErrors = validationIssues.some(v => v.issues.length > 0);
        const multiUnitTenants = Object.entries(
          rows.reduce((acc, r) => {
            if (r.name) acc[r.name] = (acc[r.name] || 0) + 1;
            return acc;
          }, {} as Record<string, number>)
        ).filter(([, count]) => count > 1);

        return (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
              <div style={{ fontSize: 13, fontWeight: 700 }}>Preview — {rows.length} tenant row{rows.length !== 1 ? 's' : ''} parsed</div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
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

            <div style={{ overflowX: 'auto', maxHeight: 280, border: '1px solid var(--border)', borderRadius: 8 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead style={{ position: 'sticky', top: 0 }}>
                  <tr style={{ background: 'var(--surface,#fff)', borderBottom: '2px solid var(--border)' }}>
                    {['#', 'Validation', 'Name', 'Type', 'Unit Code', 'Lease Start', 'Term', 'Rent'].map(h => (
                      <th key={h} style={{ padding: '8px 10px', textAlign: 'left', color: 'var(--text-secondary)', fontWeight: 700, whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => {
                    const rowIssues = validationIssues[i]?.issues || [];
                    const isValid = rowIssues.length === 0;
                    return (
                      <tr key={i} style={{ borderBottom: '1px solid var(--border)', background: isValid ? 'transparent' : 'rgba(239, 68, 68, 0.04)' }}>
                        <td style={{ padding: '6px 10px', color: 'var(--muted)' }}>{i + 1}</td>
                        <td style={{ padding: '6px 10px' }}>
                          {isValid ? (
                            <span style={{ color: "#16a34a", fontWeight: 700, fontSize: 11 }}>✓ Ready</span>
                          ) : (
                            <span style={{ color: "#dc2626", fontWeight: 700, fontSize: 11 }} title={rowIssues.join(", ")}>
                              ⚠️ {rowIssues[0]}
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '6px 10px', fontWeight: 600 }}>{r.name || <span style={{ color: '#dc2626' }}>MISSING</span>}</td>
                        <td style={{ padding: '6px 10px' }}>{r.tenant_type}</td>
                        <td style={{ padding: '6px 10px', fontFamily: 'monospace' }}>{r.unit_code || <span style={{ color: '#dc2626' }}>MISSING</span>}</td>
                        <td style={{ padding: '6px 10px', fontFamily: 'monospace' }}>{r.lease_start || <span style={{ color: '#dc2626' }}>MISSING</span>}</td>
                        <td style={{ padding: '6px 10px' }}>{r.lease_term_months} mo</td>
                        <td style={{ padding: '6px 10px', fontFamily: 'monospace' }}>{r.monthly_rent ? `KES ${Number(r.monthly_rent).toLocaleString()}/mo` : r.rent_rate_per_sqft ? `KES ${r.rent_rate_per_sqft}/sqft` : <span style={{ color: '#dc2626' }}>MISSING</span>}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
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
