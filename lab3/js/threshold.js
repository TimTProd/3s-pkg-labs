export function otsuThreshold(hist, total) {
  let sumAll = 0;
  for (let t = 0; t < 256; t++) sumAll += t * hist[t];
  let weightB = 0;
  let sumB = 0;
  let best = 0;
  let threshold = 0;
  for (let t = 0; t < 256; t++) {
    weightB += hist[t];
    if (weightB === 0) continue;
    const weightF = total - weightB;
    if (weightF === 0) break;
    sumB += t * hist[t];
    const meanB = sumB / weightB;
    const meanF = (sumAll - sumB) / weightF;
    const variance = weightB * weightF * (meanB - meanF) * (meanB - meanF);
    if (variance > best) {
      best = variance;
      threshold = t;
    }
  }
  return threshold;
}

export function iterativeThreshold(hist, total) {
  let sumAll = 0;
  for (let t = 0; t < 256; t++) sumAll += t * hist[t];
  let threshold = sumAll / total;
  for (let step = 0; step < 100; step++) {
    let countB = 0;
    let sumB = 0;
    const limit = Math.floor(threshold);
    for (let t = 0; t <= limit; t++) {
      countB += hist[t];
      sumB += t * hist[t];
    }
    const countF = total - countB;
    if (countB === 0 || countF === 0) break;
    const next = (sumB / countB + (sumAll - sumB) / countF) / 2;
    const done = Math.abs(next - threshold) < 0.5;
    threshold = next;
    if (done) break;
  }
  return Math.floor(threshold);
}

export function applyThreshold(gray, threshold) {
  const out = new Uint8Array(gray.length);
  for (let i = 0; i < gray.length; i++) out[i] = gray[i] > threshold ? 255 : 0;
  return out;
}

export function integralImages(gray, width, height) {
  const stride = width + 1;
  const sum = new Float64Array(stride * (height + 1));
  const sq = new Float64Array(stride * (height + 1));
  for (let y = 0; y < height; y++) {
    let rowSum = 0;
    let rowSq = 0;
    for (let x = 0; x < width; x++) {
      const v = gray[y * width + x];
      rowSum += v;
      rowSq += v * v;
      const i = (y + 1) * stride + x + 1;
      sum[i] = sum[i - stride] + rowSum;
      sq[i] = sq[i - stride] + rowSq;
    }
  }
  return { sum, sq, stride };
}

export function sauvolaThreshold(gray, width, height, windowSize, k, range) {
  const { sum, sq, stride } = integralImages(gray, width, height);
  const half = windowSize >> 1;
  const out = new Uint8Array(gray.length);
  for (let y = 0; y < height; y++) {
    const y0 = Math.max(0, y - half);
    const y1 = Math.min(height - 1, y + half) + 1;
    for (let x = 0; x < width; x++) {
      const x0 = Math.max(0, x - half);
      const x1 = Math.min(width - 1, x + half) + 1;
      const area = (x1 - x0) * (y1 - y0);
      const s = sum[y1 * stride + x1] - sum[y0 * stride + x1] - sum[y1 * stride + x0] + sum[y0 * stride + x0];
      const q = sq[y1 * stride + x1] - sq[y0 * stride + x1] - sq[y1 * stride + x0] + sq[y0 * stride + x0];
      const mean = s / area;
      const std = Math.sqrt(Math.max(0, q / area - mean * mean));
      const t = mean * (1 + k * (std / range - 1));
      out[y * width + x] = gray[y * width + x] > t ? 255 : 0;
    }
  }
  return out;
}
