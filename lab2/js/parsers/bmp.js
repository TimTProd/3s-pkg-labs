import { Damaged, Unknown, fmtDpi } from "./reader.js";

const COMPRESSION = {
  0: "BI_RGB (без сжатия)",
  1: "BI_RLE8",
  2: "BI_RLE4",
  3: "BI_BITFIELDS",
  4: "BI_JPEG",
  5: "BI_PNG",
  6: "BI_ALPHABITFIELDS",
};

const HEADERS = {
  12: "BITMAPCOREHEADER",
  40: "BITMAPINFOHEADER",
  52: "BITMAPV2INFOHEADER",
  56: "BITMAPV3INFOHEADER",
  64: "OS22XBITMAPHEADER",
  108: "BITMAPV4HEADER",
  124: "BITMAPV5HEADER",
};

export function parse(r, info) {
  const fileSize = r.u32(2, true);
  const dataOffset = r.u32(10, true);
  const headerSize = r.u32(14, true);
  if (!(headerSize in HEADERS)) throw new Unknown();

  let width, height, bpp;
  let compression = 0, imageSize = 0, xppm = 0, yppm = 0, colors = 0;
  if (headerSize === 12) {
    width = r.u16(18, true);
    height = r.u16(20, true);
    bpp = r.u16(24, true);
  } else {
    width = r.i32(18, true);
    height = r.i32(22, true);
    bpp = r.u16(28, true);
    compression = r.u32(30, true);
    imageSize = r.u32(34, true);
    xppm = r.i32(38, true);
    yppm = r.i32(42, true);
    colors = r.u32(46, true);
  }

  info.width = width;
  info.height = Math.abs(height);
  info.depth = bpp;
  info.compression = COMPRESSION[compression] ?? `код ${compression}`;
  if (xppm > 0 && yppm > 0) info.dpi = fmtDpi(xppm * 0.0254, yppm * 0.0254);

  const extra = [HEADERS[headerSize]];
  extra.push(bpp <= 8 ? `палитра ${colors || 1 << bpp} цветов` : "без палитры (цвет хранится в пикселе)");
  extra.push(height < 0 ? "строки сверху вниз" : "строки снизу вверх");
  info.extra = extra.join(", ");

  if (r.size < fileSize) {
    throw new Damaged(`размер файла ${r.size} Б меньше указанного в заголовке (${fileSize} Б)`);
  }
  const dataSize = [0, 3, 6].includes(compression)
    ? Math.floor((width * bpp + 31) / 32) * 4 * Math.abs(height)
    : imageSize;
  if (r.size < dataOffset + dataSize) {
    throw new Damaged(`не хватает данных пикселей: нужно ${dataOffset + dataSize} Б, есть ${r.size} Б`);
  }
}
