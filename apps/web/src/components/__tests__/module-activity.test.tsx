import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ModuleTicketsView } from "@/components/module-activity";
import { apiFetch } from "@/lib/api";

jest.mock("next/navigation", () => ({ useRouter: () => ({ push: jest.fn() }) }));
jest.mock("@/lib/property-context", () => ({
  usePropertyContext: () => ({ activeProperty: { id: "property-1", name: "Blue Shield Towers" } }),
}));
jest.mock("@/lib/api", () => ({
  apiFetch: jest.fn(),
  apiErrorMessage: jest.fn(async () => "Request failed"),
  csrfFromCookie: jest.fn(() => "csrf-token"),
}));

const mockedApiFetch = apiFetch as jest.MockedFunction<typeof apiFetch>;

function jsonResponse(body: unknown) {
  return { ok: true, json: async () => body, headers: new Headers({ "content-type": "application/json" }) } as Response;
}

describe("ModuleTicketsView", () => {
  beforeEach(() => mockedApiFetch.mockReset());

  it("shows facility tickets in Companion and opens their shared detail workflow", async () => {
    mockedApiFetch
      .mockResolvedValueOnce(jsonResponse({ results: [{
        id: "feedback:ticket-1", reference: "TT-92652", title: "Cleaning request",
        module: "facility", status: "open", priority: "urgent", raised_by: "Albin",
      }] }))
      .mockResolvedValueOnce(jsonResponse({
        id: "ticket-1", reference: "TT-92652", title: "Cleaning request", status: "open",
        priority: "urgent", requester_name: "Albin", property_name: "Blue Shield Towers",
        messages: [{ id: "message-1", message: "Please clean the office", sender_name: "Albin", created_at: "2026-08-24T08:00:00Z" }],
      }));

    render(<ModuleTicketsView moduleName="Companion" />);

    expect(await screen.findByText("TT-92652")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Open" }));

    expect(await screen.findByText("Please clean the office")).toBeInTheDocument();
    expect(screen.getByText("Blue Shield Towers")).toBeInTheDocument();
    await waitFor(() => expect(mockedApiFetch).toHaveBeenCalledWith("/companion/feedback/ticket-1/"));
  });
});
