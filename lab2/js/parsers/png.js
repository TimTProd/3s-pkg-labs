import { Damaged, fmtDpi } from "./reader.js";

const IEND = [0, 0, 0, 0, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82];

const COLOR_TYPES = {
  0: ["оттенки серого", 1],
  2: ["RGB", 3],
  3: ["индексированный (палитра)", 1],
  4: ["серый + альфа", 2],
  6: ["RGBA", 4],
};

export function parse(r, info) {
  if (r.ascii(12, 4) !== "IHDR" || r.u32(8) !== 13) throw new Damaged("первый чанк не IHDR");
  const width = r.u32(16);
  const height = r.u32(20);
  const [bitDepth, colorType, compression, filter, interlace] = r.bytes(24, 5);
  const [name, channels] = COLOR_TYPES[colorType] ?? [`тип цвета ${colorType}`, 1];

  info.width = width;
  info.height = height;
  info.depth = bitDepth * channels;
  info.compression = compression === 0 ? "Deflate" : `метод ${compression}`;

  const extra = [
    name,
    `${bitDepth} бит/канал`,
    filter === 0 ? "фильтрация: адаптивная (метод 0)" : `фильтрация: метод ${filter}`,
    interlace ? "чересстрочная Adam7" : "без чересстрочности",
  ];

  let pos = 33;
  while (true) {
    const length = r.u32(pos);
    const kind = r.ascii(pos + 4, 4);
    if (kind === "pHYs") {
      const x = r.u32(pos + 8);
      const y = r.u32(pos + 12);
      if (r.u8(pos + 16) === 1 && x && y) info.dpi = fmtDpi(x * 0.0254, y * 0.0254);
    } else if (kind === "PLTE") {
      extra.push(`палитра ${Math.floor(length / 3)} цветов`);
    } else if (kind === "IDAT" || kind === "IEND") {
      break;
    }
    pos += 12 + length;
  }

  info.extra = extra.join(", ");

  const end = r.bytes(r.size - 12, 12);
  if (!IEND.every((b, i) => end[i] === b)) throw new Damaged("нет чанка IEND в конце файла");
}
