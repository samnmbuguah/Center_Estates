import { fireEvent, render, screen } from "@testing-library/react";
import { BillingHeader } from "@/components/billing/BillingHeader";

const cycles = [
  { id: "rent", label: "Rent", frequency: "quarterly" as const },
  { id: "service_charge", label: "Service charge", frequency: "monthly" as const },
];

function renderHeader(overrides: Partial<Parameters<typeof BillingHeader>[0]> = {}) {
  return render(
    <BillingHeader
      formattedPeriod="October 2026"
      runStatus="review"
      cycles={cycles}
      cycle="rent"
      onPrev={jest.fn()}
      onNext={jest.fn()}
      {...overrides}
    />,
  );
}

describe("BillingHeader", () => {
  it("lets finance switch between charge cycles", () => {
    const onCycleChange = jest.fn();
    renderHeader({ onCycleChange });

    fireEvent.click(screen.getByRole("button", { name: "Service charge cycle" }));

    expect(onCycleChange).toHaveBeenCalledWith("service_charge");
  });

  it("shows the custom period range only when custom period is enabled", () => {
    const { rerender } = renderHeader({ customPeriod: false });
    expect(screen.queryByLabelText("Custom billing period start")).not.toBeInTheDocument();

    rerender(
      <BillingHeader
        formattedPeriod="October 2026"
        runStatus="review"
        cycles={cycles}
        cycle="rent"
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
