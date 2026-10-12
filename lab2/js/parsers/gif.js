import { Damaged } from "./reader.js";

export function parse(r, info) {
  const version = r.ascii(3, 3);
  const packed = r.u8(10);
  const hasPalette = packed & 0x80;
  const colorResolution = ((packed >> 4) & 7) + 1;

  info.width = r.u16(6, true);
  info.height = r.u16(8, true);
  info.depth = hasPalette ? (packed & 7) + 1 : colorResolution;
  info.compression = "LZW";

  const extra = [`версия ${version}`];
  extra.push(hasPalette ? `глобальная палитра ${2 << (packed & 7)} цветов` : "без глобальной палитры");
  extra.push(`цветовое разрешение ${colorResolution} бит`);
  info.extra = extra.join(", ");

  if (r.u8(r.size - 1) !== 0x3b) throw new Damaged("нет завершающего байта 0x3B (Trailer)");
}
