import { Damaged, fmtDpi } from "./reader.js";

const TYPES = {
  1: [1, 1, "getUint8"],
  3: [2, 1, "getUint16"],
  4: [4, 1, "getUint32"],
  5: [4, 2, "getUint32"],
  6: [1, 1, "getInt8"],
  8: [2, 1, "getInt16"],
  9: [4, 1, "getInt32"],
  10: [4, 2, "getInt32"],
  11: [4, 1, "getFloat32"],
  12: [8, 1, "getFloat64"],
};

const WANTED = new Set([256, 257, 258, 259, 262, 273, 277, 279, 282, 283, 296, 324, 325]);

const COMPRESSION = {
  1: "без сжатия",
  2: "CCITT RLE",
  3: "CCITT Group 3",
  4: "CCITT Group 4",
  5: "LZW",
  6: "JPEG (старый)",
  7: "JPEG",
  8: "Deflate",
  32773: "PackBits",
  32946: "Deflate",
  34712: "JPEG 2000",
};

const PHOTOMETRIC = { 0: "WhiteIsZero", 1: "BlackIsZero", 2: "RGB", 3: "палитра", 4: "маска", 5: "CMYK", 6: "YCbCr", 8: "CIELab" };

function readIfd(r, base, offset, le) {
  const count = r.u16(base + offset, le);
  const tags = {};
  for (let i = 0; i < count; i++) {
    const entry = base + offset + 2 + i * 12;
    const tag = r.u16(entry, le);
    const kind = r.u16(entry + 2, le);
    const n = r.u32(entry + 4, le);
    if (!WANTED.has(tag) || !(kind in TYPES)) continue;
    const [size, parts, getter] = TYPES[kind];
    const total = size * parts * n;
    const view = r.view(total <= 4 ? entry + 8 : base + r.u32(entry + 8, le), total);
    const values = [];
    for (let k = 0; k < n * parts; k++) values.push(view[getter](k * size, le));
    tags[tag] = parts === 2
      ? values.filter((_, k) => k % 2 === 0).map((a, k) => (values[k * 2 + 1] ? a / values[k * 2 + 1] : 0))
      : values;
  }
  return tags;
}

function resolution(tags) {
  if (!tags[282] || !tags[283]) return null;
  const unit = tags[296]?.[0] ?? 2;
  if (unit === 1) return null;
  const k = unit === 3 ? 2.54 : 1;
  const x = tags[282][0] * k;
  const y = tags[283][0] * k;
  return x && y ? fmtDpi(x, y) : null;
}

export function exifResolution(r, base) {
  const le = r.ascii(base, 2) === "II";
  return resolution(readIfd(r, base, r.u32(base + 4, le), le));
}

export function parse(r, info) {
  const le = r.ascii(0, 2) === "II";
  const tags = readIfd(r, 0, r.u32(4, le), le);
  if (!tags[256] || !tags[257]) throw new Damaged("нет обязательных тегов ImageWidth/ImageLength");

  const bits = tags[258] ?? [1];
  const samples = tags[277]?.[0] ?? bits.length;
  const compression = tags[259]?.[0] ?? 1;
  const photometric = tags[262]?.[0];

  info.width = tags[256][0];
  info.height = tags[257][0];
  info.depth = bits.length === samples ? bits.reduce((a, b) => a + b, 0) : bits[0] * samples;
  info.compression = COMPRESSION[compression] ?? `код ${compression}`;
  info.dpi = resolution(tags);

  const extra = [le ? "Intel (II)" : "Motorola (MM)", `${samples} канал(ов)`];
  if (photometric !== undefined) extra.push(PHOTOMETRIC[photometric] ?? `фотометрия ${photometric}`);
  if (photometric === 3) extra.push(`палитра ${1 << bits[0]} цветов`);
  info.extra = extra.join(", ");

  const offsets = tags[273] ?? tags[324];
  const counts = tags[279] ?? tags[325];
  if (offsets && counts && offsets.some((o, i) => o + (counts[i] ?? 0) > r.size)) {
    throw new Damaged("размер файла меньше, чем указано в заголовке (StripOffsets + StripByteCounts)");
  }
}
