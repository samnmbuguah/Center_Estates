import { fireEvent, render, screen } from "@testing-library/react";
import { KpiCard, Panel } from "../module-ui";

describe("shared module UI", () => {
  it("renders read-only KPIs as semantic cards instead of fake buttons", () => {
    render(<KpiCard icon={<span aria-hidden="true">#</span>} label="Properties" value="4" sub="2 occupied" />);

    expect(screen.getByText("Properties").closest("article")).toHaveClass("fc-kpi-card");
    expect(screen.queryByRole("button", { name: /properties/i })).not.toBeInTheDocument();
  });

  it("renders actionable KPIs as keyboard-accessible buttons", () => {
    const onClick = jest.fn();
    render(<KpiCard icon={<span aria-hidden="true">#</span>} label="Open work orders" value="3" onClick={onClick} />);

    fireEvent.click(screen.getByRole("button", { name: /open work orders/i }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("groups panel actions consistently", () => {
    render(<Panel title="Register" action={<button type="button">Add record</button>}><p>Rows</p></Panel>);

    expect(screen.getByRole("button", { name: "Add record" }).parentElement).toHaveClass("panel-actions");
  });
});
