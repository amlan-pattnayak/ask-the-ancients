import { auth } from "@clerk/nextjs/server";
import { cookies } from "next/headers";
import { createHmac } from "node:crypto";

const ANON_COOKIE_NAME = "ata_anon_id";
const PROOF_TTL_MS = 5 * 60 * 1000;

function looksLikeAnonId(value: string): boolean {
  return /^[a-f0-9-]{16,64}$/i.test(value);
}

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return new Response("Unauthorized", { status: 401 });
  }

  const secret = process.env.MERGE_PROOF_SECRET;
  if (!secret) {
    return new Response("MERGE_PROOF_SECRET is not configured", { status: 500 });
  }

  const anonId = (await cookies()).get(ANON_COOKIE_NAME)?.value?.trim();
  if (!anonId || !looksLikeAnonId(anonId)) {
    return new Response("Anonymous principal not found", { status: 400 });
  }

  const exp = Date.now() + PROOF_TTL_MS;
  const payload = `${anonId}.${userId}.${exp}`;
  const sig = createHmac("sha256", secret).update(payload).digest("hex");

  return Response.json(
    { anonId, proof: `${payload}.${sig}` },
    { headers: { "Cache-Control": "no-store" } }
  );
}
