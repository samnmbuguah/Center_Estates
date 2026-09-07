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

    expect(screen.getByText("Prepare")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Refresh readiness/i }));
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

    expect(screen.getByText("Review (3 ready)")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Generate 3 Invoices/i }));
    expect(onGenerate).toHaveBeenCalledTimes(1);
  });

  it("keeps one-off invoicing available as a secondary action", () => {
    const onSingleInvoice = jest.fn();
    render(
      <BillingActionBanner
        hasRun isPreparing={false} isReview isApproved={false}
        formattedMonth="July 2026" ready={1} issues={0} selectedCount={1}
        blockingOpen={false} busy="" canFinance canApprove
        onInitialize={jest.fn()} onRecheck={jest.fn()} onApprove={jest.fn()}
        onGenerate={jest.fn()} onSingleInvoice={onSingleInvoice}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "More billing actions" }));
    fireEvent.click(screen.getByRole("menuitem", { name: /Create one-off invoice/i }));
    expect(onSingleInvoice).toHaveBeenCalledTimes(1);
  });

  it("exposes agency letting fees directly from the billing workflow", () => {
    const onLettingFeeInvoice = jest.fn();
    render(
      <BillingActionBanner
        hasRun isPreparing={false} isReview isApproved={false}
        formattedMonth="July 2026" ready={0} issues={0} selectedCount={0}
        billingTarget="landlord"
        blockingOpen={false} busy="" canFinance canApprove
        onInitialize={jest.fn()} onRecheck={jest.fn()} onApprove={jest.fn()}
        onGenerate={jest.fn()} onSingleInvoice={jest.fn()}
        onLettingFeeInvoice={onLettingFeeInvoice}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Issue letting-fee invoice/i }));
    expect(onLettingFeeInvoice).toHaveBeenCalledTimes(1);
  });

  it("keeps letting fees out of the tenant billing workflow", () => {
    render(
      <BillingActionBanner
        hasRun isPreparing={false} isReview isApproved={false}
        formattedMonth="July 2026" ready={0} issues={0} selectedCount={0}
        billingTarget="tenant"
        blockingOpen={false} busy="" canFinance canApprove
        onInitialize={jest.fn()} onRecheck={jest.fn()} onApprove={jest.fn()}
        onGenerate={jest.fn()} onSingleInvoice={jest.fn()}
        onLettingFeeInvoice={jest.fn()}
      />,
    );
    expect(screen.queryByRole("button", { name: /letting-fee invoice/i })).not.toBeInTheDocument();
  });
});
