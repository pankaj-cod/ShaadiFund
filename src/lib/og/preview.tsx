import "server-only";
import { cacheLife } from "next/cache";
import { ImageResponse } from "next/og";
import sharp from "sharp";
import { getEnv } from "@/lib/env";
import { logger } from "@/lib/logger";

/**
 * Link previews: the image WhatsApp, Instagram, iMessage and others show when
 * someone shares a ShaadiFund link. 1200×630 is what all of them expect.
 */
export const PREVIEW_SIZE = { width: 1200, height: 630 };

const IVORY = "#fbf8f2";
const CHARCOAL = "#2b2926";
const GOLD = "#b3924f";
const GOLD_INK = "#7d5f24";
const MUTED = "#6a6359";

/**
 * A Google font as TTF (base64), subset to the characters actually drawn. The
 * image renderer cannot read the WOFF2 files the website uses.
 *
 * Cached for a long time, so a shared link never waits on Google. A failure
 * throws instead of returning, so a bad moment is never cached.
 */
async function fetchGoogleFont(family: string, axes: string, text: string): Promise<string> {
  "use cache";
  cacheLife("max");
  const css = await fetch(
    `https://fonts.googleapis.com/css2?family=${family}:${axes}&text=${encodeURIComponent(text)}`,
    { signal: AbortSignal.timeout(8000) },
  ).then((response) => response.text());
  const url = css.match(/src: url\((.+?)\) format\('(opentype|truetype)'\)/)?.[1];
  if (!url) throw new Error(`Google Fonts returned no TTF for ${family}`);
  const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!response.ok) throw new Error(`Font download failed for ${family} (${response.status})`);
  return Buffer.from(await response.arrayBuffer()).toString("base64");
}

type Font = {
  name: string;
  data: ArrayBuffer;
  style: "normal" | "italic";
  weight: 400 | 500 | 600;
};

async function loadFont(
  name: string,
  family: string,
  axes: string,
  style: Font["style"],
  weight: Font["weight"],
  text: string,
): Promise<Font | null> {
  try {
    // Every character that might be drawn, plus common punctuation.
    const bytes = Buffer.from(await fetchGoogleFont(family, axes, `${text} .,·&'’`), "base64");
    const data = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
    return { name, data, style, weight };
  } catch (error) {
    logger.warn("Preview font unavailable; using the default font", { family, error });
    return null;
  }
}

/** Cormorant for headings, Manrope for everything else: the same pairing as the site. */
async function previewFonts(headingText: string, bodyText: string): Promise<Font[] | undefined> {
  const fonts = await Promise.all([
    loadFont("Body", "Manrope", "wght@400", "normal", 400, bodyText),
    loadFont("Body", "Manrope", "wght@600", "normal", 600, bodyText),
    loadFont("Heading", "Cormorant+Garamond", "ital,wght@1,500", "italic", 500, headingText),
  ]);
  const loaded = fonts.filter((font): font is Font => font !== null);
  return loaded.length > 0 ? loaded : undefined;
}

/**
 * A photo as a JPEG data URL sized for the preview. Couples' uploads are WebP,
 * which the renderer cannot read, so every photo is converted here. Cached per
 * address (uploaded photos never change); failures throw and are not cached.
 */
async function fetchPreviewPhoto(
  absoluteUrl: string,
  width: number,
  height: number,
): Promise<string> {
  "use cache";
  cacheLife("days");
  const response = await fetch(absoluteUrl, { signal: AbortSignal.timeout(10000) });
  if (!response.ok) throw new Error(`Preview photo download failed (${response.status})`);
  const jpeg = await sharp(Buffer.from(await response.arrayBuffer()))
    .resize(width, height, { fit: "cover", position: "attention" })
    .jpeg({ quality: 78 })
    .toBuffer();
  return `data:image/jpeg;base64,${jpeg.toString("base64")}`;
}

async function photoForPreview(url: string, width: number, height: number): Promise<string | null> {
  try {
    return await fetchPreviewPhoto(new URL(url, getEnv().APP_URL).toString(), width, height);
  } catch (error) {
    logger.warn("Preview photo unavailable; rendering without it", { error });
    return null;
  }
}

function siteHost(): string {
  return new URL(getEnv().APP_URL).host;
}

/** Text on ivory beside a photo: the ShaadiFund brand preview. */
export async function brandPreview(input: {
  eyebrow: string;
  headline: string;
  body: string;
  photoUrl: string;
}): Promise<ImageResponse> {
  const photoWidth = 520;
  const [fonts, photo] = await Promise.all([
    previewFonts(
      `ShaadiFund${input.headline}`,
      `${input.eyebrow.toUpperCase()}${input.body}${siteHost()}`,
    ),
    photoForPreview(input.photoUrl, photoWidth, PREVIEW_SIZE.height),
  ]);
  return new ImageResponse(
    <div
      style={{
        display: "flex",
        width: "100%",
        height: "100%",
        background: IVORY,
        fontFamily: "Body",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          flex: 1,
          padding: "56px 64px 52px 72px",
        }}
      >
        <div style={{ display: "flex", fontFamily: "Heading", fontSize: 40, color: CHARCOAL }}>
          ShaadiFund
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              display: "flex",
              fontSize: 18,
              letterSpacing: 4,
              color: GOLD_INK,
              fontWeight: 600,
            }}
          >
            {input.eyebrow.toUpperCase()}
          </div>
          <div
            style={{
              display: "flex",
              marginTop: 20,
              fontFamily: "Heading",
              fontSize: 66,
              lineHeight: 1.02,
              color: CHARCOAL,
            }}
          >
            {input.headline}
          </div>
          <div style={{ display: "flex", marginTop: 24, width: 96, height: 2, background: GOLD }} />
          <div
            style={{ display: "flex", marginTop: 22, fontSize: 24, lineHeight: 1.4, color: MUTED }}
          >
            {input.body}
          </div>
        </div>
        <div style={{ display: "flex", fontSize: 20, color: MUTED }}>{siteHost()}</div>
      </div>
      {photo ? (
        // eslint-disable-next-line @next/next/no-img-element -- rendered to PNG, not a web page
        <img src={photo} width={photoWidth} height={PREVIEW_SIZE.height} alt="" />
      ) : null}
    </div>,
    {
      ...PREVIEW_SIZE,
      fonts,
    },
  );
}

/** A couple's names over their photo, or on ivory when they have none. */
export async function weddingPreview(input: {
  names: string;
  details: string;
  photoUrl: string | null;
  footnote: string;
}): Promise<ImageResponse> {
  const [fonts, photo] = await Promise.all([
    previewFonts(input.names, `THE WEDDING OF${input.details}${input.footnote}`),
    input.photoUrl
      ? photoForPreview(input.photoUrl, PREVIEW_SIZE.width, PREVIEW_SIZE.height)
      : null,
  ]);
  const onPhoto = Boolean(photo);
  const ink = onPhoto ? "#ffffff" : CHARCOAL;
  const soft = onPhoto ? "rgba(255,255,255,0.88)" : MUTED;

  return new ImageResponse(
    <div
      style={{
        display: "flex",
        position: "relative",
        width: "100%",
        height: "100%",
        background: IVORY,
        fontFamily: "Body",
        alignItems: onPhoto ? "flex-end" : "center",
        justifyContent: onPhoto ? "flex-start" : "center",
      }}
    >
      {photo ? (
        // eslint-disable-next-line @next/next/no-img-element -- rendered to PNG, not a web page
        <img
          src={photo}
          width={PREVIEW_SIZE.width}
          height={PREVIEW_SIZE.height}
          alt=""
          style={{ position: "absolute", top: 0, left: 0 }}
        />
      ) : null}
      {onPhoto ? (
        <div
          style={{
            display: "flex",
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            backgroundImage:
              "linear-gradient(to top, rgba(0,0,0,0.78), rgba(0,0,0,0.28) 55%, rgba(0,0,0,0.05))",
          }}
        />
      ) : null}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: onPhoto ? "flex-start" : "center",
          padding: onPhoto ? "0 72px 60px" : "0 72px",
          textAlign: onPhoto ? "left" : "center",
        }}
      >
        <div
          style={{
            display: "flex",
            fontSize: 20,
            letterSpacing: 5,
            color: onPhoto ? soft : GOLD_INK,
            fontWeight: 600,
          }}
        >
          THE WEDDING OF
        </div>
        <div
          style={{
            display: "flex",
            marginTop: 14,
            fontFamily: "Heading",
            fontSize: input.names.length > 22 ? 84 : 104,
            lineHeight: 1.02,
            color: ink,
          }}
        >
          {input.names}
        </div>
        {input.details ? (
          <div style={{ display: "flex", marginTop: 18, fontSize: 30, color: soft }}>
            {input.details}
          </div>
        ) : null}
        <div style={{ display: "flex", marginTop: 26, fontSize: 22, color: soft }}>
          {input.footnote}
        </div>
      </div>
    </div>,
    {
      ...PREVIEW_SIZE,
      fonts,
    },
  );
}
