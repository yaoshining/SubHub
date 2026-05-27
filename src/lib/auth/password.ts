import {
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
} from "node:crypto";

const scrypt = (
  password: string,
  salt: Buffer,
  keyLength: number,
  options: { N: number; r: number; p: number },
) =>
  new Promise<Buffer>((resolve, reject) => {
    scryptCallback(password, salt, keyLength, options, (error, derivedKey) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(derivedKey);
    });
  });

const scryptParameters = {
  N: 16384,
  r: 8,
  p: 1,
  keyLength: 64,
} as const;

export type PasswordStrengthResult = {
  valid: boolean;
  errors: string[];
};

export function validatePasswordStrength(
  password: string,
): PasswordStrengthResult {
  const errors: string[] = [];

  if (password.length < 12) {
    errors.push("密码长度至少需要 12 个字符。");
  }

  if (/\s/.test(password)) {
    errors.push("密码不得包含空白字符。");
  }

  if (!/[\p{L}]/u.test(password)) {
    errors.push("密码至少需要包含一个字母。");
  }

  if (!/[\p{N}\p{P}\p{S}]/u.test(password) && password.length < 16) {
    errors.push("密码至少需要包含数字或符号，或使用 16 位以上长度。");
  }

  if (/^(.)\1+$/.test(password)) {
    errors.push("密码不得由同一字符重复组成。");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

export async function hashPassword(password: string): Promise<string> {
  const strength = validatePasswordStrength(password);

  if (!strength.valid) {
    throw new Error(strength.errors.join(" "));
  }

  const salt = randomBytes(16);
  const derivedKey = await scrypt(password, salt, scryptParameters.keyLength, {
    N: scryptParameters.N,
    r: scryptParameters.r,
    p: scryptParameters.p,
  });

  return [
    "scrypt",
    scryptParameters.N,
    scryptParameters.r,
    scryptParameters.p,
    salt.toString("base64url"),
    derivedKey.toString("base64url"),
  ].join("$");
}

export async function verifyPassword(
  password: string,
  passwordHash: string,
): Promise<boolean> {
  const [algorithm, n, r, p, salt, hash] = passwordHash.split("$");

  if (algorithm !== "scrypt" || !n || !r || !p || !salt || !hash) {
    return false;
  }

  if (
    Number(n) !== scryptParameters.N ||
    Number(r) !== scryptParameters.r ||
    Number(p) !== scryptParameters.p
  ) {
    return false;
  }

  const expected = Buffer.from(hash, "base64url");
  const actual = await scrypt(
    password,
    Buffer.from(salt, "base64url"),
    expected.length,
    {
      N: Number(n),
      r: Number(r),
      p: Number(p),
    },
  );

  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
