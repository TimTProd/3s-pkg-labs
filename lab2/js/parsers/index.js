import * as bmp from "./bmp.js";
import * as gif from "./gif.js";
import * as jpeg from "./jpeg.js";
import * as pcx from "./pcx.js";
import * as png from "./png.js";
import * as tiff from "./tiff.js";
import { Damaged, Reader, Unknown } from "./reader.js";

const SIGNATURES = [
  ["\x89PNG\r\n\x1a\n", "PNG", png.parse],
  ["\xff\xd8\xff", "JPEG", jpeg.parse],
  ["GIF87a", "GIF", gif.parse],
  ["GIF89a", "GIF", gif.parse],
  ["II*\x00", "TIFF", tiff.parse],
  ["MM\x00*", "TIFF", tiff.parse],
  ["BM", "BMP", bmp.parse],
  ["\x0a", "PCX", pcx.parse],
];

const EXTENSIONS = {
  jpg: "JPEG", jpeg: "JPEG", jpe: "JPEG", jfif: "JPEG",
  png: "PNG",
  gif: "GIF",
  tif: "TIFF", tiff: "TIFF",
  bmp: "BMP", dib: "BMP",
  pcx: "PCX",
};

function detect(r) {
  const head = r.bytes(0, Math.min(r.size, 8));
  return SIGNATURES.find(([signature]) =>
    signature.length <= head.length && [...signature].every((c, i) => head[i] === c.charCodeAt(0)));
}

export function analyze(file, name) {
  const info = {
    name, size: file.size, format: null, width: null, height: null,
    dpi: null, depth: null, compression: null, extra: null,
    status: "ok", reason: null, note: null,
  };
  const base = name.split("/").pop();
  const ext = base.includes(".") ? base.split(".").pop().toLowerCase() : "";
  const expected = EXTENSIONS[ext];

  if (file.size === 0) {
    info.status = "damaged";
    info.reason = "пустой файл";
    return info;
  }

  try {
    const r = new Reader(file);
    const found = detect(r);
    if (found) {
      info.format = found[1];
      found[2](r, info);
    }
  } catch (error) {
    if (error instanceof Unknown) {
      info.format = null;
    } else {
      info.status = "damaged";
      info.reason = error instanceof Damaged ? error.message
        : error.name === "NotReadableError" ? "не удалось прочитать файл"
        : "нарушена структура заголовка";
    }
  }

  if (info.format === null && info.status === "ok") {
    info.status = "unknown";
    info.reason = "сигнатура графического формата не найдена";
  }
  if (expected && info.format !== expected) {
    info.note = `расширение .${ext}, а по содержимому ${info.format ?? "не изображение"}`;
  }
  return info;
}
