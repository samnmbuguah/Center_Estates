import { fireEvent, render, screen } from "@testing-library/react";
import { BillingHeader } from "@/components/billing/BillingHeader";

function renderHeader(overrides: Partial<Parameters<typeof BillingHeader>[0]> = {}) {
  return render(
    <BillingHeader
      formattedPeriod="October 2026"
      runStatus="review"
      onPrev={jest.fn()}
      onNext={jest.fn()}
      {...overrides}
    />,
  );
}

describe("BillingHeader", () => {
  it("lets finance choose a quarterly billing period", () => {
    const onModeChange = jest.fn();
    renderHeader({ mode: "monthly", onModeChange });

    fireEvent.click(screen.getByRole("button", { name: "Quarterly billing" }));

    expect(onModeChange).toHaveBeenCalledWith("quarterly");
  });

  it("shows the custom period range only for multi-month billing", () => {
    const { rerender } = renderHeader({ mode: "monthly" });
    expect(screen.queryByLabelText("Custom billing period start")).not.toBeInTheDocument();

    rerender(
      <BillingHeader
        formattedPeriod="October 2026"
        runStatus="review"
        mode="custom"
        customStart="2026-07"
        customEnd="2026-09"
        onPrev={jest.fn()}
        onNext={jest.fn()}
      />,
    );

    expect(screen.getByLabelText("Custom billing period start")).toHaveValue("2026-07");
    expect(screen.getByLabelText("Custom billing period end")).toHaveValue("2026-09");
  });
});
