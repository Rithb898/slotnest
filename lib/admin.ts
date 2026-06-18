const ADMIN_EMAIL = "rithb8981@gmail.com";

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isAdminEmail(
  email: string | null | undefined,
  allowlistEmail: string | null = ADMIN_EMAIL,
): boolean {
  if (!allowlistEmail || !email) return false;
  return normalizeEmail(email) === normalizeEmail(allowlistEmail);
}

export { ADMIN_EMAIL };
