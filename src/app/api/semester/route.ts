import { NextResponse } from "next/server";
import { loadSemester } from "@/lib/load";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const run = new URL(req.url).searchParams.get("run") ?? undefined;
  return NextResponse.json(await loadSemester(run));
}
