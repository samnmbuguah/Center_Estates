import { fireEvent, render, screen } from "@testing-library/react";
import { IpcPrintModal } from "../monitoring/components/IpcPrintModal";
import { InteractiveSCurve, SCurvePoint } from "../monitoring/components/InteractiveSCurve";

describe("Construction Valuation & EVM Components", () => {
  describe("IpcPrintModal", () => {
    const mockMilestone = {
      id: "m-101",
      milestone_id: "Substructure Foundation Casting",
      percent_complete: 75,
    };

    const mockData = {
      milestone_id: "Substructure Foundation Casting",
      percent_complete: 75,
      items: [
        {
          id: 1,
          boq_item: {
            item_number: "1.1",
            section: "Substructure",
            description: "Excavation and foundation blinding",
            unit: "m3",
            rate: 4500,
          },
          allocated_quantity: 100,
        },
      ],
      valuation: {
        current_gross: 337500,
        retention_percent: 5,
        retention_amount: 16875,
        advance_recovery_percent: 10,
        advance_recovery: 33750,
        net_payable: 286875,
        boq_snapshot: [],
      },
    };

    it("renders contractual certificate details, statutory deductions, and net payable", () => {
      render(
        <IpcPrintModal
          open={true}
          milestone={mockMilestone}
          projectName="Riverside Heights Block A"
          projectCode="RSH-A"
          contractorName="Apex Builders Ltd"
          data={mockData}
          onClose={jest.fn()}
        />
      );

      expect(screen.getByText("INTERIM PAYMENT CERTIFICATE")).toBeInTheDocument();
      expect(screen.getByText("Riverside Heights Block A")).toBeInTheDocument();
      expect(screen.getByText("Apex Builders Ltd")).toBeInTheDocument();

      // Check financial deductions and net payable
      expect(screen.getByText("KES 337,500.00")).toBeInTheDocument(); // Gross
      expect(screen.getByText("- KES 16,875.00")).toBeInTheDocument(); // Retention (5%)
      expect(screen.getByText("- KES 33,750.00")).toBeInTheDocument(); // Advance Recovery (10%)
      expect(screen.getByText("KES 286,875.00")).toBeInTheDocument(); // Net Payable

      // Check 3-Party Signatories
      expect(screen.getByText("SITE INSPECTOR / COW")).toBeInTheDocument();
      expect(screen.getByText("QUANTITY SURVEYOR")).toBeInTheDocument();
      expect(screen.getByText("PROJECT MANAGER / CLIENT")).toBeInTheDocument();
    });

    it("triggers onClose when close button is clicked", () => {
      const onClose = jest.fn();
      render(
        <IpcPrintModal
          open={true}
          milestone={mockMilestone}
          data={mockData}
          onClose={onClose}
        />
      );

      const closeBtn = screen.getByRole("button", { name: /close modal/i });
      fireEvent.click(closeBtn);
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  describe("InteractiveSCurve", () => {
    const mockData: SCurvePoint[] = [
      { date: "Jan", planned: 10, actual: 10 },
      { date: "Feb", planned: 25, actual: 20 },
      { date: "Mar", planned: 45, actual: 40 },
      { date: "Apr", planned: 70, actual: 65 },
    ];

    it("renders physical progress mode and allows toggling to financial EVM mode", () => {
      render(<InteractiveSCurve data={mockData} totalBudgetKes={10000000} />);

      // Physical toggle and curve labels
      expect(screen.getByText("Physical (%)")).toBeInTheDocument();
      expect(screen.getByText("Financial (EVM)")).toBeInTheDocument();
      expect(screen.getByText("Interactive Physical S-Curve Analysis")).toBeInTheDocument();

      // Switch to Financial EVM
      fireEvent.click(screen.getByText("Financial (EVM)"));

      expect(screen.getByText("Earned Value Management (EVM) S-Curve")).toBeInTheDocument();
      expect(screen.getAllByText(/Planned.*PV/i).length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText(/Earned.*EV/i).length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText(/Actual Cost.*AC/i).length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText("Cost Index (CPI)")).toBeInTheDocument();
    });
  });
});
