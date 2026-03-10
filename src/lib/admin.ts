const ADMIN_IDS_ENV = "ADMIN_CLERK_USER_IDS";
const ADMIN_EMAILS_ENV = "ADMIN_EMAILS";

function parseCsvEnv(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function toEmailSet(values: string[]): Set<string> {
  return new Set(values.map((v) => v.toLowerCase()));
}

export function getAdminConfig() {
  const adminUserIds = new Set(parseCsvEnv(process.env[ADMIN_IDS_ENV]));
  const adminEmails = toEmailSet(parseCsvEnv(process.env[ADMIN_EMAILS_ENV]));
  return { adminUserIds, adminEmails };
}

export function isAdminUser(input: {
  userId?: string | null;
  email?: string | null;
}): boolean {
  const { adminUserIds, adminEmails } = getAdminConfig();

  const idAllowed = input.userId ? adminUserIds.has(input.userId) : false;
  const emailAllowed = input.email
    ? adminEmails.has(input.email.toLowerCase())
    : false;

  return idAllowed || emailAllowed;
}
