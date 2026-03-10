import { v4 as uuidv4 } from "uuid";

const COOKIE_NAME = "ata_anon_id";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year

export function getOrCreateAnonId(): string {
  if (typeof document === "undefined") return "ssr-placeholder";

  const existing = getCookie(COOKIE_NAME);
  if (existing) return existing;

  const newId = uuidv4();
  document.cookie = [
    `${COOKIE_NAME}=${newId}`,
    `max-age=${COOKIE_MAX_AGE}`,
    "path=/",
    "SameSite=Lax",
  ].join("; ");
  return newId;
}

export function getAnonId(): string | null {
  if (typeof document === "undefined") return null;
  return getCookie(COOKIE_NAME);
}

function getCookie(name: string): string | null {
  const match = document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${name}=`));
  return match ? match.split("=")[1] : null;
}
