import { createHash, pbkdf2Sync, randomBytes, timingSafeEqual } from 'node:crypto';

const passwordIterations = 310_000;
const passwordKeyLength = 32;
const passwordDigest = 'sha256';

export function normalizeEmail(email) {
  return String(email ?? '').trim().toLowerCase();
}

export function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function validatePassword(password) {
  const value = String(password ?? '');
  const rules = [
    {
      isValid: value.length >= 8,
      message: 'Паролата трябва да е поне 8 символа.',
    },
    {
      isValid: /[A-ZА-Я]/.test(value),
      message: 'Добави поне една главна буква.',
    },
    {
      isValid: /[a-zа-я]/.test(value),
      message: 'Добави поне една малка буква.',
    },
    {
      isValid: /\d/.test(value),
      message: 'Добави поне една цифра.',
    },
    {
      isValid: /[^A-Za-zА-Яа-я0-9]/.test(value),
      message: 'Добави поне един специален знак.',
    },
  ];

  return rules.filter((rule) => !rule.isValid).map((rule) => rule.message);
}

export function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const passwordHash = pbkdf2Sync(
    password,
    salt,
    passwordIterations,
    passwordKeyLength,
    passwordDigest,
  ).toString('hex');

  return {
    passwordDigest,
    passwordHash,
    passwordIterations,
    passwordSalt: salt,
  };
}

export function verifyPassword(password, user) {
  if (!user?.passwordHash || !user?.passwordSalt) {
    return false;
  }

  const storedHash = Buffer.from(user.passwordHash, 'hex');
  const candidateHash = pbkdf2Sync(
    password,
    user.passwordSalt,
    user.passwordIterations ?? passwordIterations,
    storedHash.length,
    user.passwordDigest ?? passwordDigest,
  );

  return storedHash.length === candidateHash.length && timingSafeEqual(storedHash, candidateHash);
}

export function createSessionToken() {
  return randomBytes(48).toString('base64url');
}

export function hashSessionToken(token) {
  return createHash('sha256').update(String(token ?? '')).digest('hex');
}

export function getBearerToken(request) {
  const authorization = request.headers.authorization ?? '';
  const [scheme, token] = authorization.split(' ');

  if (scheme?.toLowerCase() !== 'bearer' || !token) {
    return '';
  }

  return token.trim();
}
