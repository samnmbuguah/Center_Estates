import { fireEvent, render, screen } from "@testing-library/react";
import { FcStatus, HealthBar, ListState, PriorityBadge, ViewToolbar } from "./FacilityToolbar";

describe("FacilityToolbar", () => {
  test("supports searching the active property records", () => {
    const onSearch = jest.fn();
    render(<ViewToolbar title="Assets" subtitle="Current property" search="" onSearch={onSearch} searchTestid="asset-search" />);
    fireEvent.change(screen.getByTestId("asset-search"), { target: { value: "Lift" } });
    expect(onSearch).toHaveBeenCalledWith("Lift");
  });

  test("maps operational values to visible status treatments", () => {
    const { container } = render(<><FcStatus value="in_progress" /><PriorityBadge priority="emergency" /><HealthBar pct={84} /></>);
    expect(screen.getByText("in progress")).toHaveClass("fc-status-in-progress");
    expect(screen.getByText("emergency")).toHaveClass("pill-danger");
    expect(screen.getByText("84%")).toBeInTheDocument();
    expect(container.querySelector(".fc-health-fill")).toHaveClass("good");
  });

  test("uses a clear empty state instead of exposing implementation errors", () => {
    render(<ListState loading={false} empty emptyTitle="No consumables" emptyDesc="Add or import consumables to begin.">Rows</ListState>);
    expect(screen.getByText("No consumables")).toBeInTheDocument();
    expect(screen.getByText("Add or import consumables to begin.")).toBeInTheDocument();
    expect(screen.queryByText("Rows")).not.toBeInTheDocument();
  });
});
