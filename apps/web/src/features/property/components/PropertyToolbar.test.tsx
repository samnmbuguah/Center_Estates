import { fireEvent, render, screen } from "@testing-library/react";
import { ListState, SubTabs, ViewToolbar } from "./PropertyToolbar";

describe("PropertyToolbar", () => {
  test("exposes a labelled workflow search and reports changes", () => {
    const onSearch = jest.fn();
    render(
      <ViewToolbar
        title="Tenant register"
        subtitle="Manage tenants"
        search="Coastal"
        onSearch={onSearch}
        placeholder="Search tenants"
        searchTestid="tenant-search"
      />,
    );
    expect(screen.getByText("Tenant register")).toBeInTheDocument();
    expect(screen.getByText("Manage tenants")).toBeInTheDocument();
    fireEvent.change(screen.getByTestId("tenant-search"), { target: { value: "Legend" } });
    expect(onSearch).toHaveBeenCalledWith("Legend");
  });

  test("renders loading, empty and populated list states", () => {
    const { rerender } = render(<ListState loading empty={false}>Loaded</ListState>);
    expect(screen.queryByText("Loaded")).not.toBeInTheDocument();
    rerender(<ListState loading={false} empty emptyTitle="No tenants" emptyDesc="Create the first tenant">Loaded</ListState>);
    expect(screen.getByText("No tenants")).toBeInTheDocument();
    rerender(<ListState loading={false} empty={false}>Loaded</ListState>);
    expect(screen.getByText("Loaded")).toBeInTheDocument();
  });

  test("changes report sub-sections without navigation", () => {
    const onChange = jest.fn();
    render(<SubTabs tabs={[{ id: "summary", label: "Summary" }, { id: "arrears", label: "Arrears" }]} active="summary" onChange={onChange} />);
    fireEvent.click(screen.getByRole("tab", { name: "Arrears" }));
    expect(onChange).toHaveBeenCalledWith("arrears");
  });
});
