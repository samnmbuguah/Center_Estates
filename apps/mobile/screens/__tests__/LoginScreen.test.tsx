import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { describe, expect, it, vi } from "vitest";

vi.mock("react-native", async () => {
  const ReactModule = await import("react");
  const component = (name: string) => ({ children, ...props }: any) =>
    ReactModule.createElement(name, props, children);
  return {
  View: component("View"), Text: component("Text"), TextInput: component("TextInput"),
  Pressable: component("Pressable"), ActivityIndicator: component("ActivityIndicator"),
  StyleSheet: { create: (styles: unknown) => styles },
  Platform: { OS: "ios", select: (values: any) => values.ios ?? values.default },
  };
});
vi.mock("react-native-safe-area-context", async () => {
  const ReactModule = await import("react");
  return { SafeAreaView: ({ children, ...props }: any) => ReactModule.createElement("SafeAreaView", props, children) };
});
vi.mock("expo-linear-gradient", async () => {
  const ReactModule = await import("react");
  return { LinearGradient: ({ children, ...props }: any) => ReactModule.createElement("LinearGradient", props, children) };
});

vi.mock("@react-navigation/native", () => ({ useNavigation: () => ({ navigate: vi.fn() }) }));
vi.mock("../../auth/AuthContext", () => ({
  useAuth: () => ({ signIn: vi.fn(), error: null, signingIn: false }),
}));

import { LoginScreen } from "../LoginScreen";

describe("LoginScreen", () => {
  it("renders both credential fields and a disabled sign-in action", () => {
    let renderer: TestRenderer.ReactTestRenderer;
    act(() => { renderer = TestRenderer.create(<LoginScreen />); });

    const fields = renderer!.root.findAllByType("TextInput" as any);
    expect(fields.map((field) => field.props.placeholder)).toEqual(["you@company.com", "••••••••"]);

    const signIn = renderer!.root.findAllByType("Pressable" as any)
      .find((node) => node.findAllByType("Text" as any).some((text) => text.children.includes("Sign in")));
    expect(signIn?.props.disabled).toBe(true);
  });

  it("shows the security and offline capability labels", () => {
    let renderer: TestRenderer.ReactTestRenderer;
    act(() => { renderer = TestRenderer.create(<LoginScreen />); });
    const text = renderer!.root.findAllByType("Text" as any).flatMap((node) => node.children).join(" ");
    expect(text).toContain("Geofenced");
    expect(text).toContain("Audit-sealed");
    expect(text).toContain("Offline-first");
  });
});
