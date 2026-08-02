import { SubmitButton } from "../../components/FormField";

export interface IngestionDraft {
  boq_items?: any[];
  work_plan_tasks?: any[];
}

export type SetIngestionDraft = React.Dispatch<React.SetStateAction<IngestionDraft | null>>;

export interface IngestionPreviewProps {
  ingestionDraft: IngestionDraft | null;
  setIngestionDraft: SetIngestionDraft;
  committing: boolean;
  onCommit: () => void;
}

export function IngestionPreview({
  ingestionDraft, setIngestionDraft, committing, onCommit,
}: IngestionPreviewProps) {
  if (!ingestionDraft || (!ingestionDraft.boq_items?.length && !ingestionDraft.work_plan_tasks?.length)) {
    return null;
  }

  function updateBoqItem(index: number, field: string, value: any) {
    setIngestionDraft(prev => {
      if (!prev) return prev;
      const next = [...(prev.boq_items ?? [])];
      next[index] = { ...next[index], [field]: value };
      return { ...prev, boq_items: next };
    });
  }

  function updateWorkPlanTask(index: number, field: string, value: any) {
    setIngestionDraft(prev => {
      if (!prev) return prev;
      const next = [...(prev.work_plan_tasks ?? [])];
      next[index] = { ...next[index], [field]: value };
      return { ...prev, work_plan_tasks: next };
    });
  }

  return (
    <>
      {ingestionDraft.boq_items && ingestionDraft.boq_items.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <h4 style={{ fontSize: 14, margin: 0, marginBottom: 6 }}>BoQ Preview ({ingestionDraft.boq_items.length} items) — click to edit</h4>
          <div style={{ maxHeight: 240, overflow: "auto", border: "1px solid var(--border)", borderRadius: 8 }}>
            <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "var(--surface-2)", position: "sticky", top: 0 }}>
                  <th style={{ padding: "4px 6px", textAlign: "left" }}>Item</th>
                  <th style={{ padding: "4px 6px", textAlign: "left" }}>Description</th>
                  <th style={{ padding: "4px 6px", textAlign: "right" }}>Qty</th>
                  <th style={{ padding: "4px 6px", textAlign: "left" }}>Unit</th>
                  <th style={{ padding: "4px 6px", textAlign: "right" }}>Rate</th>
                </tr>
              </thead>
              <tbody>
                {ingestionDraft.boq_items.slice(0, 20).map((item: any, i: number) => (
                  <tr key={i} style={{ borderTop: "1px solid var(--border)" }}>
                    <td style={{ padding: "2px 6px" }}>
                      <input value={item.item_number || ""} onChange={e => updateBoqItem(i, "item_number", e.target.value)}
                        style={{ width: 50, fontSize: 12, padding: "4px 6px" }} />
                    </td>
                    <td style={{ padding: "2px 6px" }}>
                      <input value={item.description || ""} onChange={e => updateBoqItem(i, "description", e.target.value)}
                        style={{ width: 180, fontSize: 12, padding: "4px 6px" }} />
                    </td>
                    <td style={{ padding: "2px 6px" }}>
                      <input value={item.quantity ?? ""} type="number" onChange={e => updateBoqItem(i, "quantity", e.target.value)}
                        style={{ width: 60, fontSize: 12, padding: "4px 6px", textAlign: "right" }} />
                    </td>
                    <td style={{ padding: "2px 6px" }}>
                      <input value={item.unit || ""} onChange={e => updateBoqItem(i, "unit", e.target.value)}
                        style={{ width: 50, fontSize: 12, padding: "4px 6px" }} />
                    </td>
                    <td style={{ padding: "2px 6px" }}>
                      <input value={item.rate ?? ""} type="number" onChange={e => updateBoqItem(i, "rate", e.target.value)}
                        style={{ width: 80, fontSize: 12, padding: "4px 6px", textAlign: "right" }} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {ingestionDraft.boq_items.length > 20 && (
              <p style={{ fontSize: 12, color: "var(--muted)", padding: "4px 8px" }}>Showing 20 of {ingestionDraft.boq_items.length} items</p>
            )}
          </div>
        </div>
      )}

      {ingestionDraft.work_plan_tasks && ingestionDraft.work_plan_tasks.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <h4 style={{ fontSize: 14, margin: 0, marginBottom: 6 }}>Work Plan Preview ({ingestionDraft.work_plan_tasks.length} tasks) — click to edit</h4>
          <div style={{ maxHeight: 240, overflow: "auto", border: "1px solid var(--border)", borderRadius: 8 }}>
            <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "var(--surface-2)", position: "sticky", top: 0 }}>
                  <th style={{ padding: "4px 6px", textAlign: "left" }}>Task</th>
                  <th style={{ padding: "4px 6px", textAlign: "left" }}>Start</th>
                  <th style={{ padding: "4px 6px", textAlign: "left" }}>End</th>
                  <th style={{ padding: "4px 6px", textAlign: "right" }}>Duration</th>
                </tr>
              </thead>
              <tbody>
                {ingestionDraft.work_plan_tasks.slice(0, 20).map((task: any, i: number) => (
                  <tr key={i} style={{ borderTop: "1px solid var(--border)" }}>
                    <td style={{ padding: "2px 6px" }}>
                      <input value={task.task_name || ""} onChange={e => updateWorkPlanTask(i, "task_name", e.target.value)}
                        style={{ width: 160, fontSize: 12, padding: "4px 6px" }} />
                    </td>
                    <td style={{ padding: "2px 6px" }}>
                      <input value={task.start_date || ""} onChange={e => updateWorkPlanTask(i, "start_date", e.target.value)}
                        style={{ width: 90, fontSize: 12, padding: "4px 6px" }} />
                    </td>
                    <td style={{ padding: "2px 6px" }}>
                      <input value={task.end_date || ""} onChange={e => updateWorkPlanTask(i, "end_date", e.target.value)}
                        style={{ width: 90, fontSize: 12, padding: "4px 6px" }} />
                    </td>
                    <td style={{ padding: "2px 6px" }}>
                      <input value={task.duration_days ?? ""} type="number" onChange={e => updateWorkPlanTask(i, "duration_days", e.target.value)}
                        style={{ width: 60, fontSize: 12, padding: "4px 6px", textAlign: "right" }} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {ingestionDraft.work_plan_tasks.length > 20 && (
              <p style={{ fontSize: 12, color: "var(--muted)", padding: "4px 8px" }}>Showing 20 of {ingestionDraft.work_plan_tasks.length} tasks</p>
            )}
          </div>
        </div>
      )}

      <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
        <SubmitButton className="btn primary" loading={committing} disabled={committing}
          onClick={onCommit}>
          Commit {ingestionDraft.boq_items?.length || 0} BoQ items & {ingestionDraft.work_plan_tasks?.length || 0} tasks
        </SubmitButton>
        <button className="btn ghost" onClick={() => setIngestionDraft(null)} disabled={committing}>Discard</button>
      </div>
    </>
  );
}
