import { exifResolution } from "./tiff.js";
import { Damaged, fmtDpi } from "./reader.js";

const SOF = {
  0xc0: "Baseline DCT",
  0xc1: "Extended sequential DCT",
  0xc2: "Progressive DCT",
  0xc3: "Lossless",
  0xc5: "Differential sequential DCT",
  0xc6: "Differential progressive DCT",
  0xc7: "Differential lossless",
  0xc9: "Extended sequential DCT (арифм.)",
  0xca: "Progressive DCT (арифм.)",
  0xcb: "Lossless (арифм.)",
  0xcd: "Differential sequential DCT (арифм.)",
  0xce: "Differential progressive DCT (арифм.)",
  0xcf: "Differential lossless (арифм.)",
};

export function parse(r, info) {
  let pos = 2;
  let jfifDpi = null;
  let exifDpi = null;
  const extra = [];
  while (true) {
    const [marker, code] = r.bytes(pos, 2);
    if (marker !== 0xff) throw new Damaged(`ожидался маркер по смещению ${pos}`);
    if (code === 0xff) {
      pos += 1;
      continue;
    }
    if (code === 0x01 || (code >= 0xd0 && code <= 0xd7)) {
      pos += 2;
      continue;
    }
    if (code === 0xd9 || code === 0xda) throw new Damaged("нет маркера SOF (размеры изображения)");
    const length = r.u16(pos + 2);
    if (code === 0xe0 && r.ascii(pos + 4, 5) === "JFIF\0") {
      const [major, minor, units] = r.bytes(pos + 9, 3);
      const xd = r.u16(pos + 12);
      const yd = r.u16(pos + 14);
      extra.push(`JFIF ${major}.${String(minor).padStart(2, "0")}`);
      if ((units === 1 || units === 2) && xd && yd) {
        const k = units === 1 ? 1 : 2.54;
        jfifDpi = fmtDpi(xd * k, yd * k);
      }
    } else if (code === 0xe1 && r.ascii(pos + 4, 6) === "Exif\0\0") {
      extra.push("Exif");
      try {
        exifDpi = exifResolution(r, pos + 10);
      } catch {
        exifDpi = null;
      }
    } else if (code in SOF) {
      const precision = r.u8(pos + 4);
      const components = r.u8(pos + 9);
      info.height = r.u16(pos + 5);
      info.width = r.u16(pos + 7);
      info.depth = precision * components;
      info.compression = SOF[code];
      info.dpi = jfifDpi ?? exifDpi;
      extra.push(`${components} компонент(ы) по ${precision} бит`);
      break;
    }
    pos += 2 + length;
  }

  info.extra = extra.join(", ");

  const size = Math.min(r.size, 32);
  const end = [...r.bytes(r.size - size, size)];
  while (end.length && end[end.length - 1] === 0) end.pop();
  if (end[end.length - 2] !== 0xff || end[end.length - 1] !== 0xd9) throw new Damaged("нет маркера конца EOI (FF D9)");
}
