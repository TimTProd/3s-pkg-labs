export class GridPainter {
  constructor(canvas, grid) {
    this.canvas = canvas;
    this.grid = grid;
    this.scale = 30;
    this.centerX = 0;
    this.centerY = 0;
    this.overlay = null;
    this.showValues = false;
    this.ctx = canvas.getContext("2d");
  }

  toScreenX(x) {
    return this.canvas.width / 2 + (x - this.centerX) * this.scale;
  }

  toScreenY(y) {
    return this.canvas.height / 2 - (y - this.centerY) * this.scale;
  }

  cellAt(sx, sy) {
    return [
      Math.round((sx - this.canvas.width / 2) / this.scale + this.centerX),
      Math.round(-(sy - this.canvas.height / 2) / this.scale + this.centerY)
    ];
  }

  draw() {
    const { ctx, canvas, scale } = this;
    const w = canvas.width;
    const h = canvas.height;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, w, h);

    const minX = Math.floor(this.centerX - w / 2 / scale) - 1;
    const maxX = Math.ceil(this.centerX + w / 2 / scale) + 1;
    const minY = Math.floor(this.centerY - h / 2 / scale) - 1;
    const maxY = Math.ceil(this.centerY + h / 2 / scale) + 1;

    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const v = this.grid.get(x, y);
        if (v > 0) {
          ctx.fillStyle = "rgba(20, 90, 200, " + (0.08 + 0.92 * v).toFixed(3) + ")";
          ctx.fillRect(this.toScreenX(x - 0.5), this.toScreenY(y + 0.5), scale, scale);
          if (this.showValues && scale >= 36 && v < 1) {
            ctx.fillStyle = v > 0.55 ? "#fff" : "#000";
            ctx.font = "11px Arial";
            ctx.textAlign = "center";
            ctx.fillText(v.toFixed(2), this.toScreenX(x), this.toScreenY(y) + 4);
          }
        }
      }
    }

    if (scale >= 6) {
      ctx.strokeStyle = "#d4d4d4";
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let x = minX; x <= maxX; x++) {
        const sx = Math.round(this.toScreenX(x - 0.5)) + 0.5;
        ctx.moveTo(sx, 0);
        ctx.lineTo(sx, h);
      }
      for (let y = minY; y <= maxY; y++) {
        const sy = Math.round(this.toScreenY(y + 0.5)) + 0.5;
        ctx.moveTo(0, sy);
        ctx.lineTo(w, sy);
      }
      ctx.stroke();
    }

    this.drawOverlay();
    this.drawAxes(minX, maxX, minY, maxY);
  }

  drawOverlay() {
    const { ctx } = this;
    const o = this.overlay;
    if (!o) return;
    ctx.strokeStyle = "#d02020";
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    if (o.type === "line") {
      ctx.moveTo(this.toScreenX(o.x0), this.toScreenY(o.y0));
      ctx.lineTo(this.toScreenX(o.x1), this.toScreenY(o.y1));
    } else {
      ctx.arc(this.toScreenX(o.cx), this.toScreenY(o.cy), o.r * this.scale, 0, Math.PI * 2);
    }
    ctx.stroke();
    ctx.setLineDash([]);
  }

  drawAxes(minX, maxX, minY, maxY) {
    const { ctx, canvas } = this;
    const w = canvas.width;
    const h = canvas.height;
    const axisX = Math.min(Math.max(this.toScreenY(0), 14), h - 22);
    const axisY = Math.min(Math.max(this.toScreenX(0), 22), w - 16);
    ctx.strokeStyle = "#000";
    ctx.fillStyle = "#000";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, axisX);
    ctx.lineTo(w, axisX);
    ctx.moveTo(axisY, 0);
    ctx.lineTo(axisY, h);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(w, axisX);
    ctx.lineTo(w - 9, axisX - 4);
    ctx.lineTo(w - 9, axisX + 4);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(axisY, 0);
    ctx.lineTo(axisY - 4, 9);
    ctx.lineTo(axisY + 4, 9);
    ctx.closePath();
    ctx.fill();
    ctx.font = "bold 13px Arial";
    ctx.textAlign = "left";
    ctx.fillText("x", w - 14, axisX - 8);
    ctx.fillText("y", axisY + 8, 14);

    const stepCells = Math.max(1, Math.ceil(34 / this.scale));
    const nice = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000];
    const tick = nice.find(n => n >= stepCells) || 1000;
    ctx.font = "11px Arial";
    ctx.textAlign = "center";
    for (let x = Math.ceil(minX / tick) * tick; x <= maxX; x += tick) {
      const sx = this.toScreenX(x);
      if (sx < 20 || sx > w - 20) continue;
      ctx.fillRect(Math.round(sx) - 0.5, axisX - 3, 1, 6);
      if (x !== 0) ctx.fillText(String(x), sx, axisX + 15);
    }
    ctx.textAlign = "right";
    for (let y = Math.ceil(minY / tick) * tick; y <= maxY; y += tick) {
      const sy = this.toScreenY(y);
      if (sy < 20 || sy > h - 10) continue;
      ctx.fillRect(axisY - 3, Math.round(sy) - 0.5, 6, 1);
      if (y !== 0) ctx.fillText(String(y), axisY - 7, sy + 4);
    }
    ctx.textAlign = "right";
    ctx.fillText("0", axisY - 7, axisX + 15);
  }
}
