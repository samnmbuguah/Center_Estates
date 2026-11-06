import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  addEventListener: vi.fn(),
  pendingSubmissionCount: vi.fn(),
}));
vi.mock("@react-native-community/netinfo", () => ({ default: { addEventListener: mocks.addEventListener } }));
vi.mock("react-native", async () => {
  const ReactModule = await import("react");
  return {
  StyleSheet: { create: (styles: unknown) => styles },
  Text: ({ children, ...props }: any) => ReactModule.createElement("Text", props, children),
  Pressable: ({ children, ...props }: any) => ReactModule.createElement("Pressable", props, children),
  View: ({ children, ...props }: any) => ReactModule.createElement("View", props, children),
  };
});
vi.mock("../../sitediary/offlineQueue", () => ({ pendingSubmissionCount: mocks.pendingSubmissionCount }));

import ConnectivityBanner from "../ConnectivityBanner";

describe("ConnectivityBanner", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mocks.pendingSubmissionCount.mockResolvedValue(0);
    mocks.addEventListener.mockImplementation((callback) => {
      callback({ isConnected: true });
      return vi.fn();
    });
  });

  it("stays hidden when online with no pending submissions", async () => {
    let renderer: TestRenderer.ReactTestRenderer;
    await act(async () => { renderer = TestRenderer.create(<ConnectivityBanner />); });
    expect(renderer!.toJSON()).toBeNull();
    renderer!.unmount();
  });

  it("shows an offline status and pending count", async () => {
    mocks.pendingSubmissionCount.mockResolvedValue(3);
    mocks.addEventListener.mockImplementation((callback) => {
      callback({ isConnected: false });
      return vi.fn();
    });
    let renderer: TestRenderer.ReactTestRenderer;
    await act(async () => { renderer = TestRenderer.create(<ConnectivityBanner />); });
    expect(JSON.stringify(renderer!.toJSON())).toContain("Offline");
    expect(JSON.stringify(renderer!.toJSON())).toContain("3 pending");
    renderer!.unmount();
  });
});
