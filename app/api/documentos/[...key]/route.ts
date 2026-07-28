import { NextResponse } from "next/server";
import { FILE_BUCKET, supabase } from "../../_lib/supabase";

export async function GET(_request: Request, context: { params: Promise<{ key: string[] }> }) {
  const { key } = await context.params;
  const path = key.join("/");
  if (!path.startsWith("documentos/")) return NextResponse.json({ error: "Archivo inválido." }, { status: 400 });
  const { data, error } = await supabase.storage.from(FILE_BUCKET).download(path);
  if (error) return NextResponse.json({ error: error.message }, { status: 404 });
  return new Response(data, { headers: { "content-type": data.type || "application/octet-stream", "content-disposition": "inline", "cache-control": "private, max-age=300" } });
}
