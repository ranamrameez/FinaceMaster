// Dev utility, not loaded by the extension itself: regenerates the plain
// solid-color placeholder PNG icons (navy square, matching FinanceRecorder's
// own LogoMark brand color) using only Node's built-in zlib — no image
// library dependency for three tiny placeholder icons. Run with:
//   node icons/generate-icons.js
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const NAVY = [0x14, 0x1a, 0x3d]; // matches webapp's LogoMark badge color
const ACCENT = [0x4c, 0x8b, 0xf5];

function crc32(buf) {
  let c;
  const table = crc32.table || (crc32.table = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c >>> 0;
    }
    return t;
  })());
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}

function makePng(size) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const raw = Buffer.alloc((size * 4 + 1) * size);
  const margin = Math.round(size * 0.18);
  const barCount = 3;
  const gap = Math.max(1, Math.round(size * 0.06));
  const barWidth = Math.floor((size - margin * 2 - gap * (barCount - 1)) / barCount);
  const baseline = size - margin;
  const heights = [0.35, 0.6, 0.9].map((f) => Math.round((size - margin * 2) * f));

  for (let y = 0; y < size; y++) {
    const rowStart = y * (size * 4 + 1);
    raw[rowStart] = 0; // filter type: none
    for (let x = 0; x < size; x++) {
      let color = NAVY;
      for (let b = 0; b < barCount; b++) {
        const barX0 = margin + b * (barWidth + gap);
        const barX1 = barX0 + barWidth;
        const barY0 = baseline - heights[b];
        if (x >= barX0 && x < barX1 && y >= barY0 && y < baseline) color = ACCENT;
      }
      const off = rowStart + 1 + x * 4;
      raw[off] = color[0];
      raw[off + 1] = color[1];
      raw[off + 2] = color[2];
      raw[off + 3] = 255;
    }
  }

  const idat = zlib.deflateSync(raw);
  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ]);
  return png;
}

for (const size of [16, 48, 128]) {
  const out = path.join(__dirname, `icon${size}.png`);
  fs.writeFileSync(out, makePng(size));
  console.log('wrote', out);
}
