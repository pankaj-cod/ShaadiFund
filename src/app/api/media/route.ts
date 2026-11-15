import { revalidateTag } from "next/cache";
import { weddingTag } from "@/lib/cache-tags";
import { ValidationError } from "@/lib/errors";
import { ok, route } from "@/lib/http";
import { requireActor } from "@/modules/auth/session";
import {
  MAX_UPLOAD_BYTES,
  UPLOAD_KINDS,
  uploadImage,
  type UploadKind,
} from "@/modules/media/media.service";

/** Upload one photo for the signed-in couple's wedding. multipart/form-data: file, kind. */
export const POST = route(async (request) => {
  const actor = await requireActor();

  // Reject oversized bodies before reading them into memory.
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > MAX_UPLOAD_BYTES + 64 * 1024)
    throw new ValidationError("Photos can be up to 8 MB.");

  const form = await request.formData();
  const file = form.get("file");
  const kind = form.get("kind");
  if (!(file instanceof File)) throw new ValidationError("Please choose a photo.");
  if (typeof kind !== "string" || !UPLOAD_KINDS.includes(kind as UploadKind)) {
    throw new ValidationError("Unknown photo type.");
  }

  const { slug, ...image } = await uploadImage(
    actor,
    kind as UploadKind,
    Buffer.from(await file.arrayBuffer()),
  );
  if (kind === "HERO") revalidateTag(weddingTag(slug), { expire: 0 });
  return ok(image, { status: 201 });
});
