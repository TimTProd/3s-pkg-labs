import os
import shutil
import struct
import subprocess
from argparse import ArgumentParser
from concurrent.futures import ThreadPoolExecutor
from functools import partial

HERE = os.path.dirname(os.path.abspath(__file__))
BIG = [(2400, 1600), (2300, 1540), (2100, 1600), (1950, 1950), (1600, 2400)]
SMALL = [(640, 480), (800, 450), (600, 600), (480, 640), (720, 480)]


def sips(source, target, *args):
    subprocess.run(["sips", *args, source, "--out", target], check=True, capture_output=True)


def write_noise_bmp(path, width, height):
    stride = (width * 3 + 3) // 4 * 4
    header = b"BM" + struct.pack("<IHHI", 54 + stride * height, 0, 0, 54)
    header += struct.pack("<IiiHHIIiiII", 40, width, height, 1, 24, 0, stride * height, 2835, 2835, 0, 0)
    with open(path, "wb") as f:
        f.write(header + os.urandom(stride * height))


def generate(folder, sizes, index):
    width, height = sizes[index % len(sizes)]
    dpi = str([72, 96, 150, 300][index % 4])
    path = os.path.join(folder, f"generated_{index:05d}.jpg")
    temp = path + ".bmp"
    write_noise_bmp(temp, width, height)
    sips(temp, path, "-s", "format", "jpeg", "-s", "dpiWidth", dpi, "-s", "dpiHeight", dpi)
    os.remove(temp)
    return os.path.getsize(path)


def generate_speed_set(folder, target, sizes):
    os.makedirs(folder, exist_ok=True)
    existing = len(os.listdir(folder))
    missing = max(target - existing, 0)
    total = count = 0
    with ThreadPoolExecutor(max_workers=os.cpu_count() or 4) as pool:
        for size in pool.map(partial(generate, folder, sizes), range(existing, existing + missing)):
            total += size
            count += 1
            print(f"\rсгенерировано {count}/{missing}  {total / 1024 ** 3:.2f} ГБ", end="", flush=True)
    print()


def read_bmp(path):
    with open(path, "rb") as f:
        data = f.read()
    offset, = struct.unpack_from("<I", data, 10)
    width, height, _, bpp = struct.unpack_from("<iiHH", data, 18)
    header_size, = struct.unpack_from("<I", data, 14)
    stride = (width * bpp + 31) // 32 * 4
    rows = [data[offset + y * stride:offset + y * stride + width * bpp // 8] for y in range(abs(height))]
    if height > 0:
        rows.reverse()
    palette = data[14 + header_size:offset]
    return width, abs(height), bpp, rows, palette


def rle(line):
    out = bytearray()
    i = 0
    while i < len(line):
        run = 1
        while i + run < len(line) and run < 63 and line[i + run] == line[i]:
            run += 1
        if run > 1 or line[i] >= 0xC0:
            out += bytes([0xC0 | run, line[i]])
        else:
            out.append(line[i])
        i += run
    return out


def write_pcx(bmp_path, pcx_path, dpi):
    width, height, bpp, rows, palette = read_bmp(bmp_path)
    bytes_per_line = width + width % 2
    planes = 1 if bpp == 8 else 3
    header = struct.pack("<BBBBHHHHHH", 10, 5, 1, 8, 0, 0, width - 1, height - 1, dpi, dpi)
    header += bytes(48) + b"\0" + struct.pack("<BHH", planes, bytes_per_line, 1)
    header += bytes(128 - len(header))
    body = bytearray()
    for row in rows:
        if bpp == 8:
            body += rle(row.ljust(bytes_per_line, b"\0"))
        else:
            step = bpp // 8
            for channel in (2, 1, 0):
                body += rle(row[channel::step].ljust(bytes_per_line, b"\0"))
    tail = b""
    if bpp == 8:
        palette = palette.ljust(1024, b"\0")
        tail = b"\x0c" + b"".join(bytes([palette[i + 2], palette[i + 1], palette[i]]) for i in range(0, 1024, 4))
    with open(pcx_path, "wb") as f:
        f.write(header + body + tail)


def truncate(source, target, keep):
    with open(source, "rb") as f:
        data = f.read()
    with open(target, "wb") as f:
        f.write(data[:int(len(data) * keep)])


def make_check_set(folder, source):
    os.makedirs(folder, exist_ok=True)
    c = lambda name: os.path.join(folder, name)
    base = c("base.jpg")
    sips(source, base, "-Z", "1600")

    sips(base, c("jpeg_72dpi.jpg"), "-s", "format", "jpeg", "-s", "dpiWidth", "72", "-s", "dpiHeight", "72")
    sips(base, c("jpeg_300dpi_low_quality.jpg"), "-s", "format", "jpeg", "-s", "formatOptions", "20", "-s", "dpiWidth", "300", "-s", "dpiHeight", "300")
    sips(base, c("png_rgb_150dpi.png"), "-s", "format", "png", "-s", "dpiWidth", "150", "-s", "dpiHeight", "150")
    sips(source, c("png_palette.png"), "-s", "format", "png")
    sips(base, c("gif_rgb.gif"), "-s", "format", "gif")
    sips(source, c("gif_gray.gif"), "-s", "format", "gif")
    sips(base, c("tiff_none.tif"), "-s", "format", "tiff", "-s", "dpiWidth", "300", "-s", "dpiHeight", "300")
    sips(base, c("tiff_lzw.tif"), "-s", "format", "tiff", "-s", "formatOptions", "lzw")
    sips(base, c("bmp_24bit.bmp"), "-s", "format", "bmp")
    shutil.copy(source, c("bmp_8bit_palette.bmp"))
    write_pcx(c("bmp_24bit.bmp"), c("pcx_24bit.pcx"), 96)
    write_pcx(source, c("pcx_8bit_palette.pcx"), 200)
    os.remove(base)

    truncate(c("jpeg_72dpi.jpg"), c("broken_jpeg_no_eoi.jpg"), 0.6)
    truncate(c("png_rgb_150dpi.png"), c("broken_png_no_iend.png"), 0.5)
    truncate(c("gif_gray.gif"), c("broken_gif_no_trailer.gif"), 0.7)
    truncate(c("bmp_24bit.bmp"), c("broken_bmp_short.bmp"), 0.5)
    truncate(c("tiff_none.tif"), c("broken_tiff_short.tif"), 0.5)
    truncate(c("pcx_8bit_palette.pcx"), c("broken_pcx_no_palette.pcx"), 0.8)
    open(c("broken_empty.png"), "wb").close()

    shutil.copy(c("png_rgb_150dpi.png"), c("fake_png_named.jpg"))
    shutil.copy(c("jpeg_72dpi.jpg"), c("fake_jpeg_named.bmp"))
    with open(c("fake_text_named.jpg"), "w") as f:
        f.write("это текстовый файл, а не картинка\n")
    with open(c("notes.txt"), "w") as f:
        f.write("обычный текстовый файл\n")


if __name__ == "__main__":
    parser = ArgumentParser()
    parser.add_argument("--out", default="dataset")
    parser.add_argument("--count", type=int, default=600)
    parser.add_argument("--small", action="store_true")
    parser.add_argument("--check-only", action="store_true")
    args = parser.parse_args()

    root = os.path.join(HERE, args.out)
    if not args.check_only:
        generate_speed_set(os.path.join(root, "speed"), args.count, SMALL if args.small else BIG)
    make_check_set(os.path.join(root, "check"), os.path.join(HERE, "Для проверки Lab2", "Fig3.45(a).bmp"))
    print("Готово:", root)
