import { render, screen } from "@testing-library/react";
import { ProcurementView } from "./ProcurementView";
import { FinanceControlView } from "./FinanceControlView";

jest.mock("@/lib/api", () => ({
  apiFetch: jest.fn().mockResolvedValue({ ok: true, json: async () => [] }),
  apiErrorMessage: jest.fn(),
  csrfFromCookie: jest.fn(),
}));

describe("Facility procurement and finance workspaces", () => {
  it("shows the auditable procurement chain and live record", () => {
    render(<ProcurementView rows={[{
      id: "proc-1", code: "PROC-2026-001", requisition_code: "RQR-001",
      requisition_title: "Replace booster pump", property_name: "Blue Shield Towers",
      status: "evaluation", quotations: [],
    }]} organizationId="org-1" reload={jest.fn()} canApprove />);

    expect(screen.getByText("Procurement control centre")).toBeInTheDocument();
    expect(screen.getByText("Replace booster pump")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add quotation" })).toBeInTheDocument();
  });

  it("keeps independent payment requests separate from invoice processing", () => {
    render(<FinanceControlView rows={[{
      id: "pr-1", number: "PR-2026-001", status: "submitted", payee: "County Government",
      amount: "25000.00", description: "Annual business permit", due_date: "2026-09-01",
    }]} organizationId="org-1" reload={jest.fn()} canApprove setTab={jest.fn()} />);

    expect(screen.getByText("Facility Finance workspace")).toBeInTheDocument();
    expect(screen.getByText(/Annual business permit/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Approve" })).toBeInTheDocument();
  });
});
