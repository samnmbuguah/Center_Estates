import { fireEvent, render, screen } from "@testing-library/react";
import { FacilityModals } from "./FacilityModals";

describe("FacilityModals", () => {
  test("submits the MUI work-order form with the existing field contract", () => {
    const createWorkOrder = jest.fn((event: React.FormEvent<HTMLFormElement>) => event.preventDefault());

    render(
      <FacilityModals
        showCreate
        setShowCreate={jest.fn()}
        createWorkOrder={createWorkOrder}
        actionModal={null}
        setActionModal={jest.fn()}
        submitActionModal={jest.fn()}
        createModal={null}
        setCreateModal={jest.fn()}
        handleCreate={jest.fn(async () => true)}
        properties={[{ id: "property-1", name: "Westlands Business Centre" }]}
        assets={[]}
        createError=""
        creating={false}
        assetKind="asset"
      />,
    );

    fireEvent.change(screen.getByTestId("wo-title-input"), { target: { value: "Repair the lift" } });
    fireEvent.change(screen.getByTestId("wo-priority-select"), { target: { value: "high" } });
    fireEvent.change(screen.getByTestId("wo-category-input"), { target: { value: "Mechanical" } });
    fireEvent.change(screen.getByTestId("wo-property-select"), { target: { value: "property-1" } });
    fireEvent.click(screen.getByTestId("wo-submit-btn"));

    expect(createWorkOrder).toHaveBeenCalledTimes(1);
  });

  test("uses an explicit destructive action for rejecting a service request", () => {
    render(
      <FacilityModals
        showCreate={false}
        setShowCreate={jest.fn()}
        createWorkOrder={jest.fn()}
        actionModal={{ type: "request-decision", decision: "reject", row: { id: "1", reference: "SR-001" } }}
        setActionModal={jest.fn()}
        submitActionModal={jest.fn()}
        createModal={null}
        setCreateModal={jest.fn()}
        handleCreate={jest.fn(async () => true)}
        properties={[]}
        assets={[]}
        createError=""
        creating={false}
        assetKind="asset"
      />,
    );

    expect(screen.getByRole("button", { name: "Reject Request" })).toHaveClass("MuiButton-colorError");
    expect(screen.getByRole("textbox", { name: "Rejection reason" })).toBeRequired();
  });
});
