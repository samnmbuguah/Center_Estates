import { fireEvent, render, screen } from "@testing-library/react";
import { EnhancedDataTable } from "./enhanced-data-table";

type TestRow = {
  id: string;
  name: string;
};

const rows: TestRow[] = [
  { id: "SR-001", name: "Leaking tap" },
  { id: "SR-002", name: "Lift inspection" },
];

describe("EnhancedDataTable exports", () => {
  test("exports the visible rows when no selection is made", () => {
    const onExport = jest.fn();

    render(
      <EnhancedDataTable
        data={rows}
        columns={[{ id: "name", label: "Request" }]}
        onExport={onExport}
        pagination={false}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Export" }));
    expect(onExport).toHaveBeenCalledWith(rows);
  });

  test("exports only selected rows and communicates the selection scope", () => {
    const onExport = jest.fn();

    render(
      <EnhancedDataTable
        data={rows}
        columns={[{ id: "name", label: "Request" }]}
        onExport={onExport}
        pagination={false}
      />,
    );

    const checkboxes = screen.getAllByRole("checkbox");
    fireEvent.click(checkboxes[1]);
    fireEvent.click(screen.getByRole("button", { name: "Export selected" }));

    expect(onExport).toHaveBeenCalledWith([rows[0]]);
  });
});
