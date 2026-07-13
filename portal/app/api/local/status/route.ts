import { NextResponse } from "next/server";
import { getLocalJob } from "@/lib/local";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const jobId = searchParams.get("jobId");
  if (!jobId) return NextResponse.json({ error: "bad_request" }, { status: 400 });

  const job = getLocalJob(jobId);
  if (!job) return NextResponse.json({ error: "job_not_found" }, { status: 404 });

  return NextResponse.json({
    status: job.status,
    logTail: job.log.slice(-200),
    result: job.result ?? null,
    error: job.error ?? null,
  });
}
