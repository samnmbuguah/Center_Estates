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
  it("navigates monthly periods and exposes a custom period option", () => {
    const onNext = jest.fn();
    renderHeader({ onNext });

    expect(screen.getByText("October 2026")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Next billing period" }));
    expect(onNext).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Custom period" })).toBeInTheDocument();
  });

  it("shows the custom period range only when custom period is enabled", () => {
    const { rerender } = renderHeader({ customPeriod: false });
    expect(screen.queryByLabelText("Custom billing period start")).not.toBeInTheDocument();

    rerender(
      <BillingHeader
        formattedPeriod="October 2026"
        runStatus="review"
        customPeriod
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
