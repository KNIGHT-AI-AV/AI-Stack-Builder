import packageMetadata from "../../../../package.json";
import { createRequestId, jsonApiResponse } from "@/lib/api/hardening";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET() {
  return jsonApiResponse(
    {
      status: "ok",
      service: "ai-stack-builder-api",
      version: packageMetadata.version,
    },
    200,
    createRequestId(),
    { "Cache-Control": "no-store, max-age=0" },
  );
}
