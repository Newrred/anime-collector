import sharp from "sharp";
import { createHash } from "node:crypto";

export const INPUT_LIMIT = 4 * 1024 * 1024;
export const OUTPUT_LIMIT = 2 * 1024 * 1024;
export const imageHash = (bytes) => createHash("sha256").update(bytes).digest("hex");
export class PublicImageError extends Error {
  constructor(code, status = 400) { super(code); this.code = code; this.status = status; }
}

export async function processPublicImage(bytes) {
  if (!Buffer.isBuffer(bytes) || bytes.length < 1 || bytes.length > INPUT_LIMIT) throw new PublicImageError("IMAGE_SIZE_LIMIT", 413);
  // Sniff before decode so SVG/HTML and other executable/vector formats never reach a renderer.
  const jpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  const png = bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
  const webp = bytes.toString("ascii",0,4) === "RIFF" && bytes.toString("ascii",8,12) === "WEBP";
  if (!jpeg && !png && !webp) throw new PublicImageError("IMAGE_FORMAT_UNSUPPORTED");
  if (png) {
    // libvips may decode APNG as a static first frame; reject its animation control chunk explicitly.
    for (let offset=8; offset+12<=bytes.length;) {
      const length=bytes.readUInt32BE(offset);
      if (length>bytes.length-offset-12) throw new PublicImageError("IMAGE_DECODE_FAILED");
      if (bytes.toString("ascii",offset+4,offset+8)==="acTL") throw new PublicImageError("IMAGE_FORMAT_UNSUPPORTED");
      offset+=length+12;
    }
  }
  try {
    const input = sharp(bytes, { limitInputPixels: 25_000_000, failOn: "warning", animated: true });
    const meta = await input.metadata();
    if (!["jpeg","png","webp"].includes(meta.format) || (meta.pages || 1) !== 1 ||
      !meta.width || !meta.height || meta.width > 10000 || meta.height > 10000) throw new PublicImageError("IMAGE_FORMAT_UNSUPPORTED");
    // sharp strips EXIF/ICC/XMP by default; do not use keepMetadata/withMetadata.
    const full = await input.clone().rotate().resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 82 }).toBuffer({ resolveWithObject: true });
    const thumb = await input.clone().rotate().resize({ width: 400, height: 400, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 75 }).toBuffer();
    if (full.data.length > OUTPUT_LIMIT || thumb.length > OUTPUT_LIMIT) throw new PublicImageError("IMAGE_SIZE_LIMIT", 413);
    return { full: full.data, thumb, fullHash: imageHash(full.data), thumbHash: imageHash(thumb), width: full.info.width, height: full.info.height };
  } catch (error) {
    if (error instanceof PublicImageError) throw error;
    throw new PublicImageError("IMAGE_DECODE_FAILED");
  }
}
