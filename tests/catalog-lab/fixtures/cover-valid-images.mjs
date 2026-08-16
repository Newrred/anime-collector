import { deflateSync } from 'node:zlib';

// Synthetic 1×1 pixels only. These bytes are test data, not third-party artwork.
const fromBase64 = (value) => new Uint8Array(Buffer.from(value, 'base64'));

const crc32 = (bytes) => {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(data.length, 0);
  head.write(type, 4, 'ascii');
  const tail = Buffer.alloc(4);
  tail.writeUInt32BE(crc32(Buffer.concat([Buffer.from(type), data])), 0);
  return Buffer.concat([head, data, tail]);
};
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(1, 0);
ihdr.writeUInt32BE(1, 4);
ihdr.set([8, 6, 0, 0, 0], 8);
export const pngBytes = new Uint8Array(Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk('IHDR', ihdr),
  chunk('IDAT', deflateSync(Buffer.from([0, 0, 0, 0, 0]))),
  chunk('IEND', Buffer.alloc(0)),
]));

export const jpegBytes = fromBase64(
  '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////2wBDAf//////////////////////////////////////////////////////////////////////////////////////wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAX/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIQAxAAAAF//8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABBQJ//8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAgBAwEBPwF//8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAgBAgEBPwF//8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQAGPwJ//8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPyF//9k=',
);

export const webpBytes = fromBase64(
  'UklGRiIAAABXRUJQVlA4IBYAAACQAwCdASoBAAEAAUAmJaQAA3AA/vuU',
);

const webpChunk = (type, data) => {
  const head = Buffer.alloc(8);
  head.write(type, 0, 'ascii');
  head.writeUInt32LE(data.length, 4);
  return Buffer.concat([head, data, ...(data.length % 2 ? [Buffer.alloc(1)] : [])]);
};
const webpPayload = Buffer.concat([
  webpChunk('VP8X', Buffer.from([0, 0, 0, 0, 1, 0, 0, 2, 0, 0])),
  webpChunk('VP8L', Buffer.from([0x2f, 1, 0x80, 0, 0])),
]);
const webpRiff = Buffer.alloc(12);
webpRiff.write('RIFF', 0, 'ascii');
webpRiff.writeUInt32LE(webpPayload.length + 4, 4);
webpRiff.write('WEBP', 8, 'ascii');
export const webpVp8xBytes = new Uint8Array(Buffer.concat([webpRiff, webpPayload]));

export const truncatedPngBytes = pngBytes.slice(0, 20);
