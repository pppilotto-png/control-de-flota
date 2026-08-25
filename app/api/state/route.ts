import { NextResponse } from "next/server";
import { readState, writeState } from "../_lib/supabase";

export const dynamic = "force-dynamic";

const protectedCollections = [
  "trips",
  "tripCosts",
  "fuelEntries",
  "vehicles",
  "drivers",
  "serviceRequests",
] as const;

function recordCount(state: Record<string, unknown> | null) {
  if (!state) return 0;
  return protectedCollections.reduce(
    (total, key) => total + (Array.isArray(state[key]) ? state[key].length : 0),
    0,
  );
}

function hasRequiredCollections(state: Record<string, unknown>) {
  return protectedCollections.every((key) => Array.isArray(state[key]));
}

export async function GET() {
  try {
    const state = await readState();
    if (!state) {
      return NextResponse.json(
        { error: "Base de datos ausente. El guardado automático fue bloqueado." },
        { status: 503 },
      );
    }
    return NextResponse.json({ state });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Database error" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const state = await request.json() as Record<string, unknown>;
    if (!hasRequiredCollections(state)) {
      return NextResponse.json(
        { error: "Estado incompleto. Ningún dato fue modificado." },
        { status: 400 },
      );
    }

    const currentState = await readState();
    const currentCount = recordCount(currentState);
    const incomingCount = recordCount(state);

    if (currentCount > 0 && incomingCount === 0) {
      return NextResponse.json(
        { error: "Operación bloqueada: una base con datos no puede ser reemplazada por una base vacía." },
        { status: 409 },
      );
    }

    await writeState(state);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Database error" }, { status: 500 });
  }
}
