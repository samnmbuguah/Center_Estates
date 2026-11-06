import * as ed from "@noble/ed25519";
import { sha512 } from "@noble/hashes/sha2.js";
import * as LocalAuthentication from "expo-local-authentication";
import * as SecureStore from "expo-secure-store";

import { bytesToBase64 } from "./base64";
import type { SubmissionSigner } from "./types";

// @noble/ed25519 v3 needs a sha512 implementation wired in once.
ed.hashes.sha512 = (...m) => sha512(ed.etc.concatBytes(...m));

const PRIV_KEY = "submission_signing_key"; // biometric-gated
const DEVICE_ID = "submission_device_id";

const utf8 = (s: string) => new TextEncoder().encode(s);

async function loadOrCreatePrivateKey(): Promise<Uint8Array> {
  try {
    const existing = await SecureStore.getItemAsync(PRIV_KEY, {
      requireAuthentication: true,
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
    if (existing) return ed.etc.hexToBytes(existing);

    const key = ed.utils.randomSecretKey();
    await SecureStore.setItemAsync(PRIV_KEY, ed.etc.bytesToHex(key), {
      requireAuthentication: true,
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
    return key;
  } catch {
    // Typically: no screen lock enrolled, so the OS refuses an auth-gated key.
    throw new Error(
      "Couldn't access the secure signing key. Make sure this phone has a " +
        "screen lock (fingerprint, face or passcode) set up, then try again.",
    );
  }
}

/**
 * Device-bound Ed25519 signer. The private key never leaves secure storage and
 * is unlocked only by a biometric check, so a verifiable signature is proof the
 * enrolled Clerk's device — confirmed live by fingerprint/Face ID — authorised
 * the submission (non-repudiation for audit / payment certification).
 */
export const ed25519Signer: SubmissionSigner = {
  async deviceId() {
    let id = await SecureStore.getItemAsync(DEVICE_ID);
    if (!id) {
      id = ed.etc.bytesToHex(ed.utils.randomPrivateKey()).slice(0, 32);
      await SecureStore.setItemAsync(DEVICE_ID, id);
    }
    return id;
  },

  async publicKeyBase64() {
    const priv = await loadOrCreatePrivateKey();
    return bytesToBase64(ed.getPublicKey(priv));
  },

  async sign(message: string) {
    // authenticateAsync falls back to the device passcode when no biometric is
    // enrolled, so phones without Face/Touch ID can still submit.
    const ok = await LocalAuthentication.authenticateAsync({
      promptMessage: "Confirm submission",
    });
    if (!ok.success) {
      const enrolled = await LocalAuthentication.isEnrolledAsync().catch(() => false);
      throw new Error(
        enrolled
          ? "Confirmation cancelled — authenticate to sign and submit."
          : "No fingerprint, face unlock or passcode is set up on this phone. " +
            "Add one in your phone's Settings, then submit again.",
      );
    }
    const priv = await loadOrCreatePrivateKey();
    return bytesToBase64(ed.sign(utf8(message), priv));
  },
};
