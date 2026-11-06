import { describe, expect, it, vi, beforeEach } from "vitest";
import * as SecureStore from "expo-secure-store";
import * as LocalAuthentication from "expo-local-authentication";

vi.mock("expo-secure-store", () => {
  const store = new Map<string, string>();
  return {
    getItemAsync: vi.fn(async (k: string) => store.get(k) ?? null),
    setItemAsync: vi.fn(async (k: string, v: string) => { store.set(k, v); }),
    deleteItemAsync: vi.fn(async (k: string) => { store.delete(k); }),
    WHEN_UNLOCKED_THIS_DEVICE_ONLY: "WHEN_UNLOCKED_THIS_DEVICE_ONLY",
  };
});

vi.mock("expo-local-authentication", () => ({
  authenticateAsync: vi.fn(async () => ({ success: true })),
  isEnrolledAsync: vi.fn(async () => true),
}));

import { ed25519Signer } from "../ed25519Signer";

describe("ed25519Signer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("generates and stores deviceId without throwing undefined is not a function", async () => {
    const id = await ed25519Signer.deviceId();
    expect(typeof id).toBe("string");
    expect(id.length).toBe(32);
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith("submission_device_id", id);

    // Second call retrieves cached id
    const cached = await ed25519Signer.deviceId();
    expect(cached).toBe(id);
  });

  it("generates and signs message with valid base64 signature", async () => {
    const pub = await ed25519Signer.publicKeyBase64();
    expect(typeof pub).toBe("string");
    expect(pub.length).toBeGreaterThan(0);

    const sig = await ed25519Signer.sign("canonical_hash_value");
    expect(typeof sig).toBe("string");
    expect(sig.length).toBeGreaterThan(0);
  });
});
