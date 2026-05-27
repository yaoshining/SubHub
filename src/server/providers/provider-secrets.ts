import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
} from "node:crypto";

import { readEnv } from "@/lib/env";
import { AppError } from "@/lib/errors";

const algorithm = "aes-256-gcm";
const developmentSecret = "subhub-development-provider-credential-key";

const getCredentialSecret = () => {
  const env = readEnv();

  return env.PROVIDER_CREDENTIAL_ENCRYPTION_KEY ?? developmentSecret;
};

const getEncryptionKey = () =>
  createHash("sha256").update(getCredentialSecret()).digest();

export const hashProviderCredentialSecret = (secret: string) =>
  createHmac("sha256", getCredentialSecret())
    .update(secret)
    .digest("base64url");

export const encryptProviderCredentialSecret = (secret: string) => {
  const iv = randomBytes(12);
  const cipher = createCipheriv(algorithm, getEncryptionKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(secret, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return [iv, tag, encrypted]
    .map((part) => part.toString("base64url"))
    .join(".");
};

export const decryptProviderCredentialSecret = (encryptedSecret: string) => {
  try {
    const [iv, tag, encrypted] = encryptedSecret.split(".");

    if (!iv || !tag || !encrypted) {
      throw new Error("Provider 凭据密文格式无效。");
    }

    const decipher = createDecipheriv(
      algorithm,
      getEncryptionKey(),
      Buffer.from(iv, "base64url"),
    );
    decipher.setAuthTag(Buffer.from(tag, "base64url"));

    return Buffer.concat([
      decipher.update(Buffer.from(encrypted, "base64url")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    throw new AppError(
      "UPSTREAM_FAILED",
      "Provider 凭据解密失败。",
      "provider_credential",
    );
  }
};

export const createCredentialDisplayParts = (secret: string) => ({
  displayPrefix: secret.length > 8 ? secret.slice(0, 4) : null,
  displaySuffix: secret.length > 8 ? secret.slice(-4) : null,
});
