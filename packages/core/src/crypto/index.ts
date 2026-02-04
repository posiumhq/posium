/**
 * Crypto utility for AES-256-GCM encryption/decryption.
 *
 * Used for encrypting sensitive environment variables (secrets).
 */

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { ValidationError } from "../errors.js";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // 96 bits recommended for GCM
const AUTH_TAG_LENGTH = 16; // 128 bits
const VERSION = "v1";

/**
 * Configuration for the crypto service.
 */
export interface CryptoConfig {
  /** 32-byte master key as hex (64 chars) or base64 (44 chars) */
  masterKey: string;
}

/**
 * CryptoService interface for encryption/decryption operations.
 */
export interface CryptoService {
  /** Encrypt plaintext and return serialized format: "v1:iv:ciphertext:authTag" */
  encrypt(plaintext: string): string;

  /** Decrypt serialized format back to plaintext */
  decrypt(encrypted: string): string;
}

/**
 * Parse the master key from hex or base64 format.
 */
function parseKey(masterKey: string): Buffer {
  // Try hex first (64 characters = 32 bytes)
  if (/^[0-9a-fA-F]{64}$/.test(masterKey)) {
    return Buffer.from(masterKey, "hex");
  }

  // Try base64 (44 characters with padding = 32 bytes)
  try {
    const decoded = Buffer.from(masterKey, "base64");
    if (decoded.length === 32) {
      return decoded;
    }
  } catch {
    // Fall through to error
  }

  throw new ValidationError(
    "SECRETS_MASTER_KEY must be 32 bytes encoded as hex (64 chars) or base64"
  );
}

/**
 * Creates a CryptoService instance.
 *
 * @param config - Configuration with master key
 * @returns CryptoService instance
 * @throws ValidationError if master key is missing or invalid
 */
export function createCryptoService(config: CryptoConfig): CryptoService {
  if (!config.masterKey) {
    throw new ValidationError("SECRETS_ENC_KEY environment variable is required");
  }

  const key = parseKey(config.masterKey);

  return {
    encrypt(plaintext: string): string {
      // Generate random IV for each encryption
      const iv = randomBytes(IV_LENGTH);

      // Create cipher
      const cipher = createCipheriv(ALGORITHM, key, iv, {
        authTagLength: AUTH_TAG_LENGTH,
      });

      // Encrypt
      const encrypted = Buffer.concat([
        cipher.update(plaintext, "utf8"),
        cipher.final(),
      ]);

      // Get auth tag
      const authTag = cipher.getAuthTag();

      // Serialize: "v1:iv:ciphertext:authTag" (all base64)
      return [
        VERSION,
        iv.toString("base64"),
        encrypted.toString("base64"),
        authTag.toString("base64"),
      ].join(":");
    },

    decrypt(encrypted: string): string {
      // Parse serialized format
      const parts = encrypted.split(":");
      if (parts.length !== 4) {
        throw new ValidationError("Invalid encrypted value format");
      }

      const [version, ivB64, ciphertextB64, authTagB64] = parts as [string, string, string, string];

      // Check version
      if (version !== VERSION) {
        throw new ValidationError(`Unsupported encryption version: ${version}`);
      }

      // Decode parts
      const iv = Buffer.from(ivB64, "base64");
      const ciphertext = Buffer.from(ciphertextB64, "base64");
      const authTag = Buffer.from(authTagB64, "base64");

      // Validate lengths
      if (iv.length !== IV_LENGTH) {
        throw new ValidationError("Invalid IV length");
      }
      if (authTag.length !== AUTH_TAG_LENGTH) {
        throw new ValidationError("Invalid auth tag length");
      }

      try {
        // Create decipher
        const decipher = createDecipheriv(ALGORITHM, key, iv, {
          authTagLength: AUTH_TAG_LENGTH,
        });
        decipher.setAuthTag(authTag);

        // Decrypt
        const decrypted = Buffer.concat([
          decipher.update(ciphertext),
          decipher.final(),
        ]);

        return decrypted.toString("utf8");
      } catch {
        // Decryption failed - data may be corrupted or wrong key
        throw new ValidationError(
          "Decryption failed: data may be corrupted or key mismatch"
        );
      }
    },
  };
}

/**
 * Get the crypto service singleton, lazy-initialized from environment.
 * Returns null if SECRETS_ENC_KEY is not set.
 */
let cryptoServiceInstance: CryptoService | null = null;

export function getCryptoService(): CryptoService | null {
  if (cryptoServiceInstance) {
    return cryptoServiceInstance;
  }

  const masterKey = process.env.SECRETS_ENC_KEY;
  if (!masterKey) {
    return null;
  }

  cryptoServiceInstance = createCryptoService({ masterKey });
  return cryptoServiceInstance;
}
