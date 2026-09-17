import { fireEvent, render, screen } from "@testing-library/react";
import { NewSaleModal, PaymentActionModal } from "./SalesModals";

describe("Sales transaction dialogs", () => {
  test("submits a new sale using the existing API payload names", () => {
    const onSubmit = jest.fn();
    render(
      <NewSaleModal
        open
        onClose={jest.fn()}
        onSubmit={onSubmit}
        error=""
        buyers={[{ id: "buyer-1", full_name: "Test Buyer", reference: "BUY-001" }]}
        listings={[{ id: "listing-1", project_name: "Lynx", unit_code: "A-01", list_price: 12000000 }]}
      />,
    );

    fireEvent.change(screen.getByRole("textbox", { name: "Sale reference" }), { target: { value: "SALE-001" } });
    const selects = screen.getAllByRole("combobox");
    fireEvent.change(selects[0], { target: { value: "buyer-1" } });
    fireEvent.change(selects[1], { target: { value: "listing-1" } });
    fireEvent.change(screen.getByRole("spinbutton", { name: "Agreed price (KES)" }), { target: { value: "11500000" } });
    fireEvent.click(screen.getByRole("button", { name: "Create Sale" }));

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({
      reference: "SALE-001",
      buyer: "buyer-1",
      listing: "listing-1",
      agreed_price: "11500000",
    }));
  });

  test("requires a reason before reversing a verified payment", () => {
    const onAction = jest.fn();
    render(
      <PaymentActionModal
        payment={{ id: "payment-1", reference: "PAY-001", status: "verified", amount: 250000 }}
        onClose={jest.fn()}
        onAction={onAction}
        error=""
      />,
    );

    const reverse = screen.getByRole("button", { name: "Reverse Payment" });
    expect(reverse).toBeDisabled();
    fireEvent.change(screen.getByRole("textbox", { name: "Reversal reason" }), { target: { value: "Duplicate payment" } });
    fireEvent.click(reverse);
    expect(onAction).toHaveBeenCalledWith({ action: "reverse", reason: "Duplicate payment" });
  });
});
