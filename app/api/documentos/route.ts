import { NextResponse } from "next/server";
import { FILE_BUCKET, supabase } from "../_lib/supabase";

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File) || !file.size) return NextResponse.json({ error: "Seleccione un archivo." }, { status: 400 });
    const allowed = ["application/pdf", "image/jpeg", "image/png", "image/webp"];
    if (!allowed.includes(file.type) || file.size > 8 * 1024 * 1024) return NextResponse.json({ error: "Use PDF, JPG, PNG o WebP de hasta 8 MB." }, { status: 400 });
    const extension = file.type === "application/pdf" ? "pdf" : file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
    const key = `documentos/${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}.${extension}`;
    const { error } = await supabase.storage.from(FILE_BUCKET).upload(key, file, { contentType: file.type });
    if (error) throw error;
    return NextResponse.json({ key, name: file.name.slice(0, 180) }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Upload error" }, { status: 500 });
  }
}
