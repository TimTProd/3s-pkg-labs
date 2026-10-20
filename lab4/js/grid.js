export class VirtualGrid {
  constructor(width, height) {
    this.width = width;
    this.height = height;
    this.originX = width >> 1;
    this.originY = height >> 1;
    this.data = new Float32Array(width * height);
    this.writes = 0;
  }

  reset() {
    this.data.fill(0);
    this.writes = 0;
  }

  setPixel(x, y, intensity) {
    const gx = x + this.originX;
    const gy = y + this.originY;
    this.writes++;
    if (gx < 0 || gy < 0 || gx >= this.width || gy >= this.height) return;
    const i = gy * this.width + gx;
    if (intensity > this.data[i]) this.data[i] = intensity;
  }

  get(x, y) {
    const gx = x + this.originX;
    const gy = y + this.originY;
    if (gx < 0 || gy < 0 || gx >= this.width || gy >= this.height) return 0;
    return this.data[gy * this.width + gx];
  }

  count() {
    let n = 0;
    for (let i = 0; i < this.data.length; i++) if (this.data[i] > 0) n++;
    return n;
  }
}
