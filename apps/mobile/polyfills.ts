// Hermes (Expo Go) has no Web Crypto global, but @noble/ed25519 needs
// crypto.getRandomValues for key generation. Back it with expo-crypto (which IS
// available in Expo Go). Imported FIRST in index.ts, before any crypto use.
import { getRandomValues as expoGetRandomValues } from "expo-crypto";

const g = globalThis as unknown as { crypto?: { getRandomValues?: unknown } };
if (!g.crypto) g.crypto = {};
if (typeof g.crypto.getRandomValues !== "function") {
  g.crypto.getRandomValues = (array: ArrayBufferView) =>
    expoGetRandomValues(array as Parameters<typeof expoGetRandomValues>[0]);
}
