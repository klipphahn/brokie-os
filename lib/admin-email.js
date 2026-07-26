/**
 * Resolves the authorized administrator email from the environment.
 *
 * Returns the normalized `ADMIN_EMAIL` value, or `null` when it is not set.
 * Callers must treat `null` as "no one is authorized" (fail closed) rather
 * than falling back to a hardcoded account.
 */
export function getAdminEmail() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  return email || null;
}

/**
 * Returns true when `email` matches the configured administrator.
 * Always false when `ADMIN_EMAIL` is unset (fail closed).
 */
export function isAuthorizedAdminEmail(email) {
  const adminEmail = getAdminEmail();
  if (!adminEmail) return false;
  return String(email || "").trim().toLowerCase() === adminEmail;
}
