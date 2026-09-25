import sharp from 'sharp';
import { createHash } from 'node:crypto';
import { inspectWebImage } from '../../features/memory/adapters/platform/webImageIntake.js';

export const TRANSPORT_LIMIT = 1_500_000;
export const hash = bytes => createHash('sha256').update(bytes).digest('hex');
export class PrivateImageError extends Error {
  constructor(code, status = 400) { super(code); this.code = code; this.status = status; }
}

// This endpoint receives a bounded client rendition, never attests the original's checksum.
export async function processPrivateImage(bytes, policy) {
  if (!Buffer.isBuffer(bytes) || !bytes.length || bytes.length > TRANSPORT_LIMIT) throw new PrivateImageError('IMAGE_SIZE_LIMIT', 413);
  try {
    const info = inspectWebImage(bytes);
    if (info.width > 1600 || info.height > 1600) throw new PrivateImageError('IMAGE_SIZE_LIMIT', 413);
    const input = sharp(bytes, { limitInputPixels: 2_560_000, failOn: 'warning', animated: true });
    const meta = await input.metadata();
    if ((meta.pages || 1) !== 1 || !['jpeg','png','webp'].includes(meta.format)) throw new PrivateImageError('IMAGE_FORMAT_UNSUPPORTED');
    // Strip metadata/normalize orientation; do not trust browser-asserted hashes or sizes.
    const main = await input.clone().rotate().webp({ quality: 85 }).toBuffer({ resolveWithObject: true });
    const thumb = await input.clone().rotate().resize({ width: 400, height: 400, fit: 'inside', withoutEnlargement: true }).webp({ quality: 75 }).toBuffer();
    if (main.data.length > policy.mainMaxBytes || thumb.length > policy.thumbnailMaxBytes) throw new PrivateImageError('IMAGE_SIZE_LIMIT', 413);
    return { main: main.data, thumb, inputHash: hash(bytes), mainHash: hash(main.data), thumbHash: hash(thumb), width: main.info.width, height: main.info.height };
  } catch (error) {
    if (error instanceof PrivateImageError) throw error;
    if (error.code === 'UNSUPPORTED_IMAGE_TYPE') throw new PrivateImageError('IMAGE_FORMAT_UNSUPPORTED');
    throw new PrivateImageError('IMAGE_DECODE_FAILED');
  }
}
