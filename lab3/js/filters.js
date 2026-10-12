import { makeIndexTable, splitChannels, mergeChannels } from "./buffer.js";

export function convolve(src, width, height, kernel, kw, kh, mode) {
  const rx = kw >> 1;
  const ry = kh >> 1;
  const xs = makeIndexTable(width, rx, mode);
  const ys = makeIndexTable(height, ry, mode);
  const out = new Float32Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let sum = 0;
      for (let ky = 0; ky < kh; ky++) {
        const row = ys[y + ky] * width;
        for (let kx = 0; kx < kw; kx++) {
          sum += kernel[ky * kw + kx] * src[row + xs[x + kx]];
        }
      }
      out[y * width + x] = sum;
    }
  }
  return out;
}

export function gaussianKernel(sigma) {
  const radius = Math.max(1, Math.ceil(3 * sigma));
  const kernel = new Float32Array(2 * radius + 1);
  let sum = 0;
  for (let i = -radius; i <= radius; i++) {
    const v = Math.exp(-(i * i) / (2 * sigma * sigma));
    kernel[i + radius] = v;
    sum += v;
  }
  for (let i = 0; i < kernel.length; i++) kernel[i] /= sum;
  return kernel;
}

export function convolveSeparable(src, width, height, kernel, mode) {
  const r = kernel.length >> 1;
  const xs = makeIndexTable(width, r, mode);
  const ys = makeIndexTable(height, r, mode);
  const tmp = new Float32Array(width * height);
  const out = new Float32Array(width * height);
  for (let y = 0; y < height; y++) {
    const row = y * width;
    for (let x = 0; x < width; x++) {
      let sum = 0;
      for (let k = 0; k < kernel.length; k++) sum += kernel[k] * src[row + xs[x + k]];
      tmp[row + x] = sum;
    }
  }
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let sum = 0;
      for (let k = 0; k < kernel.length; k++) sum += kernel[k] * tmp[ys[y + k] * width + x];
      out[y * width + x] = sum;
    }
  }
  return out;
}

const LAPLACIAN_4 = new Float32Array([0, 1, 0, 1, -4, 1, 0, 1, 0]);
const LAPLACIAN_8 = new Float32Array([1, 1, 1, 1, -8, 1, 1, 1, 1]);

export function laplacianChannel(src, width, height, mode, neighbors, strength) {
  const kernel = neighbors === 8 ? LAPLACIAN_8 : LAPLACIAN_4;
  const lap = convolve(src, width, height, kernel, 3, 3, mode);
  const out = new Float32Array(src.length);
  for (let i = 0; i < src.length; i++) out[i] = src[i] - strength * lap[i];
  return out;
}

export function unsharpChannel(src, width, height, mode, sigma, amount) {
  const blur = convolveSeparable(src, width, height, gaussianKernel(sigma), mode);
  const out = new Float32Array(src.length);
  for (let i = 0; i < src.length; i++) out[i] = src[i] + amount * (src[i] - blur[i]);
  return out;
}

export function sharpenLaplacian(data, width, height, mode, neighbors, strength) {
  const channels = splitChannels(data, width, height).map(c => laplacianChannel(c, width, height, mode, neighbors, strength));
  return mergeChannels(channels, width, height);
}

export function sharpenUnsharp(data, width, height, mode, sigma, amount) {
  const channels = splitChannels(data, width, height).map(c => unsharpChannel(c, width, height, mode, sigma, amount));
  return mergeChannels(channels, width, height);
}

export function highPassMap(data, width, height, mode, sigma) {
  const channels = splitChannels(data, width, height).map(c => {
    const blur = convolveSeparable(c, width, height, gaussianKernel(sigma), mode);
    const out = new Float32Array(c.length);
    for (let i = 0; i < c.length; i++) out[i] = c[i] - blur[i] + 128;
    return out;
  });
  return mergeChannels(channels, width, height);
}
