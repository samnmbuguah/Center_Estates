import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NotificationCenter } from "@/components/notification-center";
import { apiFetch } from "@/lib/api";

jest.mock("next/navigation", () => ({ useRouter: () => ({ push: jest.fn() }) }));
jest.mock("@/components/auth-provider", () => ({
  useAuth: () => ({ session: { activeOrganizationId: "org-1" } }),
}));
jest.mock("@/lib/api", () => ({
  apiFetch: jest.fn(),
  apiErrorMessage: jest.fn(async () => "This notification could not be marked as read."),
}));
jest.mock("@/lib/toast", () => ({ toast: { error: jest.fn() } }));

const mockedApiFetch = apiFetch as jest.MockedFunction<typeof apiFetch>;
const item = {
  id: "notice-1",
  title: "Lease review",
  message: "A lease requires attention.",
  level: "warning" as const,
  read_at: null,
  created_at: new Date().toISOString(),
};
const response = (body: unknown, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: jest.fn(async () => body),
}) as unknown as Response;

describe("NotificationCenter read persistence", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockedApiFetch.mockReset();
    mockedApiFetch.mockResolvedValueOnce(response([item]));
  });

  afterEach(() => jest.useRealTimers());

  async function loadInbox() {
    render(<NotificationCenter />);
    await act(async () => { jest.advanceTimersByTime(3_000); });
    await waitFor(() => expect(mockedApiFetch).toHaveBeenCalledWith("/notifications/", {}, "org-1"));
    fireEvent.click(screen.getByLabelText(/Notifications/i));
    expect(await screen.findByText("Lease review")).toBeInTheDocument();
  }

  it("persists an individual read action through the API", async () => {
    mockedApiFetch.mockResolvedValueOnce(response({ ...item, read_at: new Date().toISOString() }));
    await loadInbox();
    fireEvent.click(screen.getByRole("button", { name: "Mark as read" }));
    await waitFor(() => expect(mockedApiFetch).toHaveBeenCalledWith(
      "/notifications/notice-1/mark-read/",
      { method: "POST" },
      "org-1",
    ));
    expect(screen.queryByRole("button", { name: "Mark as read" })).not.toBeInTheDocument();
  });

  it("restores unread state when the server rejects the update", async () => {
    mockedApiFetch.mockResolvedValueOnce(response({ detail: "Denied" }, 403));
    await loadInbox();
    fireEvent.click(screen.getByRole("button", { name: "Mark as read" }));
    expect(await screen.findByRole("button", { name: "Mark as read" })).toBeInTheDocument();
  });
});
