import { NextResponse } from "next/server";
import { getServerEnv } from "@/src/config/env";

export function GET() {
  const env = getServerEnv();
  return NextResponse.json({
    integrations: {
      officialResearch: Boolean(env.EXA_API_KEY),
      gmailOAuth: Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET),
      backgroundMonitoring: Boolean(
        env.QSTASH_URL &&
          env.QSTASH_TOKEN &&
          env.QSTASH_CURRENT_SIGNING_KEY &&
          env.QSTASH_NEXT_SIGNING_KEY,
      ),
    },
  });
}
