import { NextResponse } from "next/server";
import { readState, writeState } from "../_lib/supabase";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json({ state: await readState() });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Database error" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const state = await request.json() as Record<string, unknown>;
    await writeState(state);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Database error" }, { status: 500 });
  }
}
