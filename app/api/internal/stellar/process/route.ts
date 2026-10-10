import { NextResponse } from "next/server";
import { serviceClient } from "@/lib/admin-access";
import { processNextBlockchainJob } from "@/lib/stellar/jobs";

export const runtime = "nodejs";
export const maxDuration = 60;

async function handleWorkerRequest(request: Request) {
  const expected = (process.env.CRON_SECRET ?? process.env.STELLAR_WORKER_SECRET)?.trim();
  const provided = request.headers.get("authorization");
  if (!expected || provided !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = serviceClient();
  const results = [];
  for (let index = 0; index < 5; index += 1) {
    const result = await processNextBlockchainJob(admin);
    results.push(result);
    if (!result.processed) break;
  }
  return NextResponse.json({ ok: true, results });
}

export const GET = handleWorkerRequest;
export const POST = handleWorkerRequest;
