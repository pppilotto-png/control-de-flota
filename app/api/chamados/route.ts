import { NextResponse } from "next/server";
import { readState, writeState, supabase, FILE_BUCKET } from "../_lib/supabase";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const state = await readState();
    return NextResponse.json({ requests: state?.serviceRequests ?? [] });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Database error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const state = (await readState()) ?? {};
    const requests = Array.isArray(state.serviceRequests) ? state.serviceRequests as Record<string, unknown>[] : [];
    const photoKeys: string[] = [];
    for (const photo of form.getAll("photos").filter((item): item is File => item instanceof File && item.size > 0).slice(0, 3)) {
      if (!["image/jpeg", "image/png", "image/webp"].includes(photo.type) || photo.size > 5 * 1024 * 1024) continue;
      const extension = photo.type === "image/png" ? "png" : photo.type === "image/webp" ? "webp" : "jpg";
      const key = `chamados/${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}.${extension}`;
      const { error } = await supabase.storage.from(FILE_BUCKET).upload(key, photo, { contentType: photo.type });
      if (error) throw error;
      photoKeys.push(key);
    }
    const body = Object.fromEntries(Array.from(form.entries()).filter(([key]) => key !== "photos"));
    const item = {
      ...body,
      id: requests.length ? Math.max(...requests.map((entry) => Number(entry.id) || 0)) + 1 : 1,
      protocol: `CH-${Date.now().toString().slice(-8)}`,
      createdAt: new Date().toISOString(),
      status: "Nuevo",
      photoKeys,
    };
    await writeState({ ...state, serviceRequests: [item, ...requests] });
    return NextResponse.json({ request: item }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Upload error" }, { status: 500 });
  }
}
