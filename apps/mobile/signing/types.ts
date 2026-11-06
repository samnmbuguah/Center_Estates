/**
 * A SubmissionSigner produces a base64 signature over a message, gated behind a
 * biometric check. The default implementation (ed25519Signer) keeps a device
 * key in secure storage that can only be used after Face/Touch ID; tests inject
 * a fake signer so the submission logic can be verified without native crypto.
 */
export interface SubmissionSigner {
  /** Stable identifier for the enrolled device. */
  deviceId(): Promise<string>;
  /** Base64 Ed25519 public key for server enrolment. */
  publicKeyBase64(): Promise<string>;
  /** Biometric-gated signature (base64) over the given UTF-8 message. */
  sign(message: string): Promise<string>;
}
