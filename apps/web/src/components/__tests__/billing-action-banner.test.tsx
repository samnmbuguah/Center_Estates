import { fireEvent, render, screen } from "@testing-library/react";
import { BillingActionBanner } from "@/components/billing/BillingActionBanner";

describe("BillingActionBanner", () => {
  it("renders scan step and triggers refresh/rescan", () => {
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
        chargeTypeFilter="all"
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

    expect(screen.getByText("1. Scan & Prepare")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Refresh/i }));
    expect(onRecheck).toHaveBeenCalledTimes(1);
  });

  it("lets an authorized manager generate candidate invoices", () => {
    const onGenerate = jest.fn();

    render(
      <BillingActionBanner
        hasRun
        isPreparing={false}
        isReview
        isApproved={false}
        formattedMonth="July 2026"
        ready={3}
        issues={0}
        selectedCount={3}
        chargeTypeFilter="all"
        blockingOpen={false}
        busy=""
        canFinance
        canApprove
        onInitialize={jest.fn()}
        onRecheck={jest.fn()}
        onApprove={jest.fn()}
        onGenerate={onGenerate}
        onSingleInvoice={jest.fn()}
      />,
    );

    expect(screen.getByText("2. Candidates (3 ready)")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Generate 3 Invoices/i }));
    expect(onGenerate).toHaveBeenCalledTimes(1);
  });
});

