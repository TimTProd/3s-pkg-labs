export class Damaged extends Error {}

export class Unknown extends Error {}

const BLOCK = 64 * 1024;

export class Reader {
  constructor(file) {
    this.file = file;
    this.size = file.size;
    this.sync = new FileReaderSync();
    this.start = 0;
    this.buffer = this.load(0, BLOCK);
  }

  load(offset, length) {
    return new Uint8Array(this.sync.readAsArrayBuffer(this.file.slice(offset, offset + length)));
  }

  bytes(offset, length) {
    if (offset < 0 || length < 0 || offset + length > this.size) {
      throw new Damaged("размер файла меньше, чем указано в заголовке");
    }
    if (offset < this.start || offset + length > this.start + this.buffer.length) {
      this.start = offset;
      this.buffer = this.load(offset, Math.max(length, BLOCK));
    }
    return this.buffer.subarray(offset - this.start, offset - this.start + length);
  }

  view(offset, length) {
    const b = this.bytes(offset, length);
    return new DataView(b.buffer, b.byteOffset, b.byteLength);
  }

  u8(offset) {
    return this.bytes(offset, 1)[0];
  }

  u16(offset, le) {
    return this.view(offset, 2).getUint16(0, le);
  }

  u32(offset, le) {
    return this.view(offset, 4).getUint32(0, le);
  }

  i32(offset, le) {
    return this.view(offset, 4).getInt32(0, le);
  }

  ascii(offset, length) {
    return String.fromCharCode(...this.bytes(offset, length));
  }
}

export function fmtDpi(x, y) {
  x = Math.round(x);
  y = Math.round(y);
  return x === y ? String(x) : `${x} × ${y}`;
}
