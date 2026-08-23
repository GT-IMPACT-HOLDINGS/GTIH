import zlib from 'zlib';

const PNG_SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const ODD_VISUAL_SIZE = 128;

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([typeBuf, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

/**
 * Build a 128×128 RGB PNG and return base64 (no data-URL prefix).
 * @param {(x: number, y: number) => { r: number, g: number, b: number }} rgbFn
 */
export function createRgbPng128Base64(rgbFn) {
  const w = ODD_VISUAL_SIZE;
  const h = ODD_VISUAL_SIZE;
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) {
    const row = y * (w * 3 + 1);
    raw[row] = 0;
    for (let x = 0; x < w; x++) {
      const { r, g, b } = rgbFn(x, y);
      const o = row + 1 + x * 3;
      raw[o] = Math.max(0, Math.min(255, Math.round(r)));
      raw[o + 1] = Math.max(0, Math.min(255, Math.round(g)));
      raw[o + 2] = Math.max(0, Math.min(255, Math.round(b)));
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  const idat = zlib.deflateSync(raw, { level: 9 });
  const png = Buffer.concat([
    PNG_SIG,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', idat),
    pngChunk('IEND', Buffer.alloc(0))
  ]);
  return png.toString('base64');
}

/** POC mock 128×128 watercolor-style PNG for ODD graphics. */
export function mockOddGraphicsPngBase64(narrative) {
  const text = (narrative || '').toLowerCase();
  let hue = 210;
  if (text.includes('apple')) hue = 8;
  else if (text.includes('house')) hue = 28;
  else if (text.includes('tree')) hue = 120;
  else if (text.includes('sun')) hue = 45;
  else if (text.includes('moon')) hue = 240;
  return createRgbPng128Base64((x, y) => {
    const cx = 64;
    const cy = 68;
    const dx = (x - cx) / 48;
    const dy = (y - cy) / 40;
    const blob = Math.exp(-(dx * dx + dy * dy) * 1.8);
    const wash =
      0.55 +
      0.25 * Math.sin(x * 0.09 + hue * 0.02) +
      0.2 * Math.cos(y * 0.11);
    const sat = blob * 0.85 + 0.15 * wash;
    const h = (hue + 18 * blob + 6 * Math.sin(y * 0.05)) % 360;
    const s = 0.42 + 0.38 * sat;
    const l = 0.72 + 0.18 * blob - 0.08 * (y / ODD_VISUAL_SIZE);
    return hslToRgb(h, s, l);
  });
}

function hslToRgb(h, s, l) {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0;
  let g = 0;
  let b = 0;
  if (h < 60) {
    r = c;
    g = x;
  } else if (h < 120) {
    r = x;
    g = c;
  } else if (h < 180) {
    g = c;
    b = x;
  } else if (h < 240) {
    g = x;
    b = c;
  } else if (h < 300) {
    r = x;
    b = c;
  } else {
    r = c;
    b = x;
  }
  return {
    r: (r + m) * 255,
    g: (g + m) * 255,
    b: (b + m) * 255
  };
}

export { ODD_VISUAL_SIZE };
