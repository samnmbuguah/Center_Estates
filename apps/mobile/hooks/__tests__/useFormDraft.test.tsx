import React, { useEffect } from "react";
import TestRenderer, { act } from "react-test-renderer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../store/tinybase", async () => {
  const { createStore } = await import("tinybase");
  const testStore = createStore();
  return {
    store: testStore,
    initStore: vi.fn(),
  };
});

vi.mock("react-native", async () => {
  const ReactModule = await import("react");
  return {
    StyleSheet: { create: (styles: unknown) => styles },
    Text: ({ children, ...props }: any) => ReactModule.createElement("Text", props, children),
    View: ({ children, ...props }: any) => ReactModule.createElement("View", props, children),
    Platform: { OS: "android" },
  };
});

import { store } from "../../store/tinybase";
import { DRAFTS_TABLE, useFormDraft } from "../useFormDraft";

interface HarnessProps {
  draftKey: string;
  initialValues: Record<string, any>;
  onReady: (hook: ReturnType<typeof useFormDraft>) => void;
}

function Harness({ draftKey, initialValues, onReady }: HarnessProps) {
  const hook = useFormDraft(draftKey, initialValues, 50);
  useEffect(() => {
    onReady(hook);
  });
  return null;
}

describe("useFormDraft", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    store.delRow(DRAFTS_TABLE, "test_key");
    store.delRow(DRAFTS_TABLE, "saved_key");
    store.delRow(DRAFTS_TABLE, "to_clear");
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("initializes with initialValues when no draft exists", () => {
    let hookResult!: ReturnType<typeof useFormDraft>;

    act(() => {
      TestRenderer.create(
        <Harness
          draftKey="test_key"
          initialValues={{ notes: "", count: 0 }}
          onReady={(h) => {
            hookResult = h;
          }}
        />,
      );
    });

    expect(hookResult.formState).toEqual({ notes: "", count: 0 });
    expect(hookResult.isRestored).toBe(true);
  });

  it("restores previously persisted draft from store", () => {
    store.setRow(DRAFTS_TABLE, "saved_key", {
      payload: JSON.stringify({ notes: "Drafted note", count: 42 }),
      updated_at: 1000,
    });

    let hookResult!: ReturnType<typeof useFormDraft>;

    act(() => {
      TestRenderer.create(
        <Harness
          draftKey="saved_key"
          initialValues={{ notes: "", count: 0 }}
          onReady={(h) => {
            hookResult = h;
          }}
        />,
      );
    });

    expect(hookResult.formState).toEqual({ notes: "Drafted note", count: 42 });
  });

  it("debounces and saves updates to tinybase store", () => {
    let hookResult!: ReturnType<typeof useFormDraft>;

    act(() => {
      TestRenderer.create(
        <Harness
          draftKey="test_key"
          initialValues={{ notes: "", count: 0 }}
          onReady={(h) => {
            hookResult = h;
          }}
        />,
      );
    });

    act(() => {
      hookResult.updateForm({ notes: "Work in progress" });
    });

    expect(hookResult.formState.notes).toBe("Work in progress");

    // Before timer advances past 50ms debounce
    expect(store.getRow(DRAFTS_TABLE, "test_key")).toEqual({});

    act(() => {
      vi.advanceTimersByTime(60);
    });

    const saved = store.getRow(DRAFTS_TABLE, "test_key");
    expect(saved).toBeDefined();
    expect(JSON.parse(String(saved.payload))).toEqual({ notes: "Work in progress", count: 0 });
  });

  it("clears draft row when clearDraft is invoked", () => {
    store.setRow(DRAFTS_TABLE, "to_clear", {
      payload: JSON.stringify({ notes: "Ready to submit" }),
      updated_at: 1000,
    });

    let hookResult!: ReturnType<typeof useFormDraft>;

    act(() => {
      TestRenderer.create(
        <Harness
          draftKey="to_clear"
          initialValues={{ notes: "" }}
          onReady={(h) => {
            hookResult = h;
          }}
        />,
      );
    });

    act(() => {
      hookResult.clearDraft();
    });

    expect(store.getRow(DRAFTS_TABLE, "to_clear")).toEqual({});
  });
});
