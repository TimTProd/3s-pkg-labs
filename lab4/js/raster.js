const round = v => Math.floor(v + 0.5);

export function stepLine(x0, y0, x1, y1, target, trace) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  if (dx === 0 && dy === 0) {
    target.setPixel(x0, y0, 1);
    return;
  }
  if (Math.abs(dx) >= Math.abs(dy)) {
    const k = dy / dx;
    const b = y0 - k * x0;
    const s = dx > 0 ? 1 : -1;
    for (let x = x0; ; x += s) {
      const y = k * x + b;
      const yi = round(y);
      target.setPixel(x, yi, 1);
      if (trace) trace.push([x, y.toFixed(3), yi]);
      if (x === x1) break;
    }
  } else {
    const k = dx / dy;
    const b = x0 - k * y0;
    const s = dy > 0 ? 1 : -1;
    for (let y = y0; ; y += s) {
      const x = k * y + b;
      const xi = round(x);
      target.setPixel(xi, y, 1);
      if (trace) trace.push([xi, y, x.toFixed(3)]);
      if (y === y1) break;
    }
  }
}

export function ddaLine(x0, y0, x1, y1, target, trace) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const length = Math.max(Math.abs(dx), Math.abs(dy));
  if (length === 0) {
    target.setPixel(x0, y0, 1);
    return;
  }
  const ix = dx / length;
  const iy = dy / length;
  let x = x0;
  let y = y0;
  for (let i = 0; i <= length; i++) {
    const px = round(x);
    const py = round(y);
    target.setPixel(px, py, 1);
    if (trace) trace.push([i, x.toFixed(3), y.toFixed(3), px, py]);
    x += ix;
    y += iy;
  }
}

export function bresenhamLine(x0, y0, x1, y1, target, trace) {
  let dx = Math.abs(x1 - x0);
  let dy = Math.abs(y1 - y0);
  const sx = x1 >= x0 ? 1 : -1;
  const sy = y1 >= y0 ? 1 : -1;
  const steep = dy > dx;
  if (steep) {
    const t = dx;
    dx = dy;
    dy = t;
  }
  let e = 2 * dy - dx;
  const eStraight = 2 * dy;
  const eDiagonal = 2 * dy - 2 * dx;
  let x = x0;
  let y = y0;
  for (let i = 0; i <= dx; i++) {
    target.setPixel(x, y, 1);
    const diagonal = e > 0;
    if (trace) trace.push([i, x, y, e, diagonal ? "диагональный" : "прямой"]);
    if (diagonal) {
      x += sx;
      y += sy;
      e += eDiagonal;
    } else {
      if (steep) y += sy;
      else x += sx;
      e += eStraight;
    }
  }
}

export function bresenhamCircle(cx, cy, r, target, trace) {
  let x = 0;
  let y = r;
  let d = 3 - 2 * r;
  while (x <= y) {
    target.setPixel(cx + x, cy + y, 1);
    target.setPixel(cx - x, cy + y, 1);
    target.setPixel(cx + x, cy - y, 1);
    target.setPixel(cx - x, cy - y, 1);
    target.setPixel(cx + y, cy + x, 1);
    target.setPixel(cx - y, cy + x, 1);
    target.setPixel(cx + y, cy - x, 1);
    target.setPixel(cx - y, cy - x, 1);
    const inside = d < 0;
    if (trace) trace.push([x, y, d, inside ? "(x+1, y)" : "(x+1, y-1)"]);
    if (inside) {
      d += 4 * x + 6;
    } else {
      d += 4 * (x - y) + 10;
      y--;
    }
    x++;
  }
}

export function wuLine(x0, y0, x1, y1, target, trace) {
  const steep = Math.abs(y1 - y0) > Math.abs(x1 - x0);
  if (steep) {
    [x0, y0] = [y0, x0];
    [x1, y1] = [y1, x1];
  }
  if (x0 > x1) {
    [x0, x1] = [x1, x0];
    [y0, y1] = [y1, y0];
  }
  const dx = x1 - x0;
  const dy = y1 - y0;
  const gradient = dx === 0 ? 1 : dy / dx;
  const plot = (x, y, c) => {
    if (c <= 0) return;
    if (steep) target.setPixel(y, x, c);
    else target.setPixel(x, y, c);
  };
  const fpart = v => v - Math.floor(v);
  const rfpart = v => 1 - fpart(v);

  let yEnd = y0 + gradient * (round(x0) - x0);
  let xGap = rfpart(x0 + 0.5);
  const xp1 = round(x0);
  plot(xp1, Math.floor(yEnd), rfpart(yEnd) * xGap);
  plot(xp1, Math.floor(yEnd) + 1, fpart(yEnd) * xGap);
  let inter = yEnd + gradient;

  yEnd = y1 + gradient * (round(x1) - x1);
  xGap = fpart(x1 + 0.5);
  const xp2 = round(x1);
  plot(xp2, Math.floor(yEnd), rfpart(yEnd) * xGap);
  plot(xp2, Math.floor(yEnd) + 1, fpart(yEnd) * xGap);

  for (let x = xp1 + 1; x < xp2; x++) {
    const fy = Math.floor(inter);
    const f = fpart(inter);
    plot(x, fy, 1 - f);
    plot(x, fy + 1, f);
    if (trace) trace.push([x, inter.toFixed(3), fy, (1 - f).toFixed(3), fy + 1, f.toFixed(3)]);
    inter += gradient;
  }
}

function euclidString(a, b, trace) {
  if (b === 0) return "s".repeat(a);
  if (a === b) return "d".repeat(a);
  let y = b;
  let x = a - b;
  let m1 = "s";
  let m2 = "d";
  while (x !== y) {
    if (x > y) {
      x -= y;
      m2 = m1 + m2;
    } else {
      y -= x;
      m1 = m2 + m1;
    }
    if (trace) trace.push([x, y, m1.length > 30 ? m1.slice(0, 30) + "…" : m1, m2.length > 30 ? m2.slice(0, 30) + "…" : m2]);
  }
  return (m1 + m2).repeat(x);
}

export function castlePitteway(x0, y0, x1, y1, target, trace) {
  let a = Math.abs(x1 - x0);
  let b = Math.abs(y1 - y0);
  const sx = x1 >= x0 ? 1 : -1;
  const sy = y1 >= y0 ? 1 : -1;
  const steep = b > a;
  if (steep) {
    const t = a;
    a = b;
    b = t;
  }
  const word = euclidString(a, b, trace);
  let x = x0;
  let y = y0;
  target.setPixel(x, y, 1);
  for (let i = 0; i < word.length; i++) {
    if (word.charCodeAt(i) === 100) {
      x += sx;
      y += sy;
    } else if (steep) {
      y += sy;
    } else {
      x += sx;
    }
    target.setPixel(x, y, 1);
  }
  return word;
}
