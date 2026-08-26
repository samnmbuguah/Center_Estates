import { fireEvent, render, screen } from "@testing-library/react";
import { BillingActionBanner } from "@/components/billing/BillingActionBanner";

describe("BillingActionBanner", () => {
  it("lets a user resume a saved billing run that has not been scanned", () => {
    const onRecheck = jest.fn();

    render(
      <BillingActionBanner
        hasRun
        isPreparing
        isReview={false}
        isApproved={false}
        formattedMonth="July 2026"
        ready={0}
        issues={0}
        selectedCount={0}
        blockingOpen={false}
        busy=""
        canFinance
        canApprove
        onInitialize={jest.fn()}
        onRecheck={onRecheck}
        onApprove={jest.fn()}
        onGenerate={jest.fn()}
        onSingleInvoice={jest.fn()}
      />,
    );

    expect(screen.getByText("Complete the readiness scan for July 2026")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Scan leases & prepare invoices" }));
    expect(onRecheck).toHaveBeenCalledTimes(1);
  });
});
