import { NextResponse } from "next/server";
import { readState, writeState } from "../../_lib/supabase";

export async function POST(request: Request) {
  try {
    const { id } = await request.json() as { id: number };
    const state = (await readState()) ?? {};
    const fuelEntries = Array.isArray(state.fuelEntries) ? state.fuelEntries as Record<string, unknown>[] : [];
    const entry = fuelEntries.find((item) => Number(item.id) === Number(id));
    if (!entry) return NextResponse.json({ error: "Carga no encontrada." }, { status: 404 });

    const trash = Array.isArray(state.trash) ? state.trash as Record<string, unknown>[] : [];
    const liters = Number(entry.liters ?? 0);
    const vehicle = String(entry.vehicle ?? "");
    const date = String(entry.date ?? "");
    const deletedAt = new Date().toISOString();
    const trashEntry = {
      id: `fuel-${id}-${Date.now()}`,
      deletedAt,
      deletedBy: "usuario del sistema",
      collection: "fuelEntries",
      label: `Combustible ${vehicle} · ${date} · ${liters.toLocaleString("es-PY")} L`,
      record: entry,
    };

    await writeState({
      ...state,
      fuelEntries: fuelEntries.filter((item) => Number(item.id) !== Number(id)),
      trash: [trashEntry, ...trash],
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Delete error" }, { status: 500 });
  }
}
