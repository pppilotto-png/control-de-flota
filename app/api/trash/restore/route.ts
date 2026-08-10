import { NextResponse } from "next/server";
import { readState, writeState } from "../../_lib/supabase";

export async function POST(request: Request) {
  try {
    const { id } = await request.json() as { id: string };
    const state = (await readState()) ?? {};
    const trash = Array.isArray(state.trash) ? state.trash as Record<string, unknown>[] : [];
    const item = trash.find((entry) => entry.id === id);
    if (!item) return NextResponse.json({ error: "Registro no encontrado." }, { status: 404 });
    const collection = String(item.collection);
    if (collection === "orders") {
      const record = item.record as Record<string, unknown>;
      const tripId = Number(record.tripId);
      const trips = Array.isArray(state.trips) ? state.trips as Record<string, unknown>[] : [];
      const tripIndex = trips.findIndex((trip) => Number(trip.id) === tripId);
      if (tripIndex < 0) return NextResponse.json({ error: "El viaje vinculado ya no existe." }, { status: 409 });
      const { tripId: _tripId, ...order } = record;
      const trip = trips[tripIndex];
      const orders = Array.isArray(trip.orders) ? trip.orders as unknown[] : [];
      const restoredTrips = trips.map((entry, index) => index === tripIndex ? { ...entry, orders: [...orders, order] } : entry);
      await writeState({ ...state, trips: restoredTrips, trash: trash.filter((entry) => entry.id !== id) });
      return NextResponse.json({ ok: true, record: order });
    }
    const current = Array.isArray(state[collection]) ? state[collection] as unknown[] : [];
    await writeState({ ...state, [collection]: [item.record, ...current], trash: trash.filter((entry) => entry.id !== id) });
    return NextResponse.json({ ok: true, record: item.record });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Restore error" }, { status: 500 });
  }
}
