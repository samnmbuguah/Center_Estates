import { fireEvent, render, screen } from "@testing-library/react";
import { RentSchedulesView } from "../RentSchedulesView";

jest.mock("@/components/auth-provider", () => ({
  useAuth: () => ({ session: { activeOrganizationId: "org-1" } }),
}));
jest.mock("@/lib/api", () => ({
  apiFetch: jest.fn(),
  csrfFromCookie: jest.fn(),
}));

const rows = [
  {
    id: "s1", lease_reference: "LEASE-1", tenant_name: "Tenant One",
    period_start: "2026-01-01", period_end: "2026-02-01", due_on: "2026-01-01",
    base_rent: 1000, escalation_amount: 0, service_charge: 100, total: 1100, status: "invoiced",
  },
  {
    id: "s2", lease_reference: "LEASE-1", tenant_name: "Tenant One",
    period_start: "2026-02-01", period_end: "2026-03-01", due_on: "2026-02-01",
    base_rent: 1000, escalation_amount: 0, service_charge: 100, total: 1100, status: "invoiced",
  },
  {
    id: "s3", lease_reference: "LEASE-1", tenant_name: "Tenant One",
    period_start: "2026-03-01", period_end: "2026-04-01", due_on: "2026-03-01",
    base_rent: 1000, escalation_amount: 0, service_charge: 100, total: 1100, status: "invoiced",
  },
];

describe("RentSchedulesView", () => {
  it("rolls monthly schedule rows into a read-only quarterly view", () => {
    render(
      <RentSchedulesView
        rows={rows}
        loading={false}
        search=""
        setSearch={jest.fn()}
        onGenerateInvoice={jest.fn()}
        onRefresh={jest.fn()}
        canFinance={false}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Quarterly rent roll-up" }));

    expect(screen.getByText("Q1 2026")).toBeInTheDocument();
    expect(screen.getByText("Quarterly view rolls up the monthly schedule rows for reporting only. Switch to Monthly to create drafts.")).toBeInTheDocument();
  });
});
