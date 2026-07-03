import { NextResponse } from "next/server";
import { extForImage, MAX_IMAGE_BYTES, putImage, randomKey } from "@/lib/s3";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "invalid_multipart" }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "missing_file" }, { status: 400 });
  }
  if (file.size === 0) {
    return NextResponse.json({ error: "empty_file" }, { status: 400 });
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return NextResponse.json(
      { error: "too_large", limitBytes: MAX_IMAGE_BYTES },
      { status: 413 },
    );
  }
  const contentType = file.type || "";
  const ext = extForImage(contentType);
  if (!ext) {
    return NextResponse.json({ error: "unsupported_type", contentType }, { status: 415 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const key = randomKey(ext);
  const url = await putImage({ buffer, key, contentType });
  return NextResponse.json({ url, key, bytes: buffer.length, contentType });
}
