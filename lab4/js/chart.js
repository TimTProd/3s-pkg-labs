export function drawChart(canvas, options) {
  const { title, xLabel, yLabel, series } = options;
  const width = 560;
  const height = 340;
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, width, height);
  const left = 62;
  const right = 14;
  const top = 34;
  const bottom = 48;
  const plotW = width - left - right;
  const plotH = height - top - bottom;
  let maxX = 0;
  let maxY = 0;
  for (const s of series) {
    for (const [x, y] of s.points) {
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }
  maxY = niceCeil(maxY);
  const px = x => left + (x / maxX) * plotW;
  const py = y => top + plotH - (y / maxY) * plotH;

  ctx.font = "13px Arial";
  ctx.fillStyle = "#000";
  ctx.textAlign = "center";
  ctx.fillText(title, width / 2, 20);
  ctx.strokeStyle = "#ddd";
  ctx.lineWidth = 1;
  ctx.textAlign = "right";
  ctx.font = "11px Arial";
  for (let i = 0; i <= 5; i++) {
    const y = (maxY / 5) * i;
    ctx.beginPath();
    ctx.moveTo(left, py(y));
    ctx.lineTo(left + plotW, py(y));
    ctx.stroke();
    ctx.fillStyle = "#000";
    ctx.fillText(formatNumber(y), left - 6, py(y) + 4);
  }
  ctx.textAlign = "center";
  const xs = series[0].points.map(p => p[0]);
  for (const x of xs) {
    ctx.fillText(formatNumber(x), px(x), top + plotH + 16);
  }
  ctx.strokeStyle = "#000";
  ctx.beginPath();
  ctx.moveTo(left, top);
  ctx.lineTo(left, top + plotH);
  ctx.lineTo(left + plotW, top + plotH);
  ctx.stroke();
  ctx.fillStyle = "#000";
  ctx.font = "12px Arial";
  ctx.fillText(xLabel, left + plotW / 2, height - 8);
  ctx.save();
  ctx.translate(14, top + plotH / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillText(yLabel, 0, 0);
  ctx.restore();

  ctx.lineWidth = 2;
  series.forEach((s, index) => {
    ctx.strokeStyle = s.color;
    ctx.fillStyle = s.color;
    ctx.beginPath();
    s.points.forEach(([x, y], i) => {
      if (i === 0) ctx.moveTo(px(x), py(y));
      else ctx.lineTo(px(x), py(y));
    });
    ctx.stroke();
    s.points.forEach(([x, y]) => {
      ctx.beginPath();
      ctx.arc(px(x), py(y), 3, 0, Math.PI * 2);
      ctx.fill();
    });
    const lx = left + 6 + index * 92;
    ctx.fillRect(lx, top + 6, 12, 4);
    ctx.fillStyle = "#000";
    ctx.textAlign = "left";
    ctx.font = "11px Arial";
    ctx.fillText(s.name, lx + 15, top + 12);
    ctx.textAlign = "center";
  });
}

function niceCeil(v) {
  if (v <= 0) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  const m = v / p;
  const n = m <= 1 ? 1 : m <= 2 ? 2 : m <= 5 ? 5 : 10;
  return n * p;
}

function formatNumber(v) {
  if (v >= 1000) return (v / 1000) + "k";
  if (v < 1 && v > 0) return v.toFixed(2);
  return String(Math.round(v * 10) / 10);
}
