import "server-only";
import sharp from "sharp";
import { inTransaction } from "@/lib/db";
import { ValidationError } from "@/lib/errors";
import { assertWithinRateLimit } from "@/lib/rate-limit";
import type { Actor } from "@/modules/auth/session";
import { updateWedding } from "@/modules/wedding/wedding.repository";
import { requireOwnWedding } from "@/modules/wedding/wedding.service";
import type { ImageDTO } from "@/modules/wedding/wedding.types";
import { createMediaAsset } from "./media.repository";
import { getMediaStorage } from "./storage";

export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
export const UPLOAD_KINDS = ["HERO", "DREAM_COVER"] as const;
export type UploadKind = (typeof UPLOAD_KINDS)[number];

const ALLOWED_FORMATS = new Set(["jpeg", "png", "webp"]);
const MAX_EDGE: Record<UploadKind, number> = { HERO: 2400, DREAM_COVER: 1600 };

/**
 * Decodes the upload and re-encodes it as WebP.
 * The real format comes from the file's bytes, never its name or declared type,
 * and re-encoding drops metadata (location, camera) and anything hidden in the file.
 */
export async function processImage(
  bytes: Buffer,
  kind: UploadKind,
): Promise<{ data: Buffer; width: number; height: number }> {
  if (bytes.length === 0) throw new ValidationError("That file is empty.");
  if (bytes.length > MAX_UPLOAD_BYTES) throw new ValidationError("Photos can be up to 8 MB.");

  try {
    const metadata = await sharp(bytes).metadata();
    if (!metadata.format || !ALLOWED_FORMATS.has(metadata.format)) {
      throw new ValidationError("Please upload a JPEG, PNG or WebP photo.");
    }
    const { data, info } = await sharp(bytes)
      .rotate()
      .resize({
        width: MAX_EDGE[kind],
        height: MAX_EDGE[kind],
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: 82 })
      .toBuffer({ resolveWithObject: true });
    return { data, width: info.width, height: info.height };
  } catch (error) {
    if (error instanceof ValidationError) throw error;
    throw new ValidationError("We could not read that file as a photo.");
  }
}

/** Stores a photo for the actor's wedding. A hero photo is attached to the page straight away. */
export async function uploadImage(
  actor: Actor,
  kind: UploadKind,
  bytes: Buffer,
): Promise<ImageDTO & { slug: string }> {
  await assertWithinRateLimit(`upload:${actor.userId}`, 30, 10 * 60 * 1000);
  const { couple, wedding } = await requireOwnWedding(actor);
  const image = await processImage(bytes, kind);

  const key = `${crypto.randomUUID()}.webp`;
  const { url } = await getMediaStorage().put(key, image.data);

  const asset = await inTransaction(async (tx) => {
    const created = await createMediaAsset(
      {
        coupleId: couple.id,
        kind,
        providerPublicId: key,
        url,
        mimeType: "image/webp",
        bytes: image.data.length,
        width: image.width,
        height: image.height,
      },
      tx,
    );
    if (kind === "HERO") await updateWedding(wedding.id, { heroImageId: created.id }, tx);
    return created;
  });
  return {
    id: asset.id,
    url: asset.url,
    width: asset.width,
    height: asset.height,
    slug: wedding.slug,
  };
}
