import React, { act } from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { BillingPolicyModal } from "../billing/BillingPolicyModal";

describe("BillingPolicyModal", () => {
  it("toggles when switch or card is clicked", async () => {
    const onPolicyChange = jest.fn().mockResolvedValue(undefined);
    render(
      <BillingPolicyModal
        open={true}
        onClose={jest.fn()}
        propertyId="test-prop"
        propertyName="Test Property"
        requireUtilityReadings={true}
        onPolicyChange={onPolicyChange}
      />
    );

    const switchInput = screen.getByRole("switch");
    expect(switchInput).toBeChecked();

    // Click the switch input directly
    await act(async () => {
      fireEvent.click(switchInput);
    });
    expect(switchInput).not.toBeChecked();
    expect(onPolicyChange).toHaveBeenCalledWith(false);
  });
});
