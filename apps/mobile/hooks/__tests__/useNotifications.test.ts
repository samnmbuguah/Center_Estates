import { describe, expect, it, vi } from "vitest";

// Mock expo-notifications
vi.mock("expo-notifications", () => ({
  default: {
    setNotificationHandler: vi.fn(),
    getPermissionsAsync: vi.fn(() => Promise.resolve({ status: "granted" })),
    requestPermissionsAsync: vi.fn(() => Promise.resolve({ status: "granted" })),
    getExpoPushTokenAsync: vi.fn(() => Promise.resolve({ data: "ExponentPushToken[test-token]" })),
    setNotificationChannelAsync: vi.fn(() => Promise.resolve()),
    addNotificationResponseReceivedListener: vi.fn(() => ({ remove: vi.fn() })),
  },
  getPermissionsAsync: vi.fn(() => Promise.resolve({ status: "granted" })),
  requestPermissionsAsync: vi.fn(() => Promise.resolve({ status: "granted" })),
  getExpoPushTokenAsync: vi.fn(() => Promise.resolve({ data: "ExponentPushToken[test-token]" })),
  setNotificationChannelAsync: vi.fn(() => Promise.resolve()),
  addNotificationResponseReceivedListener: vi.fn(() => ({ remove: vi.fn() })),
  setNotificationHandler: vi.fn(),
}));

vi.mock("react-native", () => ({ Platform: { OS: "android" } }));

// Mock sync/api
vi.mock("../../sync/api", () => ({
  authHeaders: vi.fn(() => Promise.resolve({ Authorization: "Bearer test" })),
  apiUrl: vi.fn((path: string) => `http://localhost:8000${path}`),
}));

describe("useNotifications", () => {
  it("is a function", async () => {
    const mod = await import("../useNotifications");
    expect(typeof mod.default).toBe("function");
  });
});
