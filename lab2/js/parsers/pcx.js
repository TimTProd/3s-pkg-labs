import { Damaged, Unknown, fmtDpi } from "./reader.js";

export function parse(r, info) {
  if (r.size < 128) throw new Unknown();
  const [, version, encoding, bpp] = r.bytes(0, 4);
  const xmin = r.u16(4, true);
  const ymin = r.u16(6, true);
  const xmax = r.u16(8, true);
  const ymax = r.u16(10, true);
  const hdpi = r.u16(12, true);
  const vdpi = r.u16(14, true);
  const planes = r.u8(65);
  const bytesPerLine = r.u16(66, true);
  if (![0, 2, 3, 4, 5].includes(version) || ![0, 1].includes(encoding) || ![1, 2, 4, 8].includes(bpp) || xmax < xmin || ymax < ymin) {
    throw new Unknown();
  }

  const height = ymax - ymin + 1;
  info.width = xmax - xmin + 1;
  info.height = height;
  info.depth = bpp * planes;
  info.compression = encoding ? "RLE" : "без сжатия";
  if (hdpi && vdpi) info.dpi = fmtDpi(hdpi, vdpi);

  const vga = bpp === 8 && planes === 1;
  const extra = [`версия ${version}`, `${planes} плоскост., ${bpp} бит/плоскость`, `${bytesPerLine} байт/строку`];
  if (vga) extra.push("VGA-палитра 256 цветов в конце файла");
  else if (bpp * planes <= 4) extra.push(`палитра в заголовке (${1 << (bpp * planes)} цветов)`);
  info.extra = extra.join(", ");

  if (r.size === 128) throw new Damaged("нет данных изображения");
  if (vga && version === 5 && (r.size < 128 + 769 || r.u8(r.size - 769) !== 0x0c)) {
    throw new Damaged("нет 256-цветной палитры в конце файла");
  }
  if (encoding === 0 && r.size < 128 + bytesPerLine * planes * height) {
    throw new Damaged("размер файла меньше, чем указано в заголовке");
  }
}
