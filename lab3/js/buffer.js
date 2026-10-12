export function makeIndexTable(n, r, mode) {
  const table = new Int32Array(n + 2 * r);
  const period = 2 * n;
  for (let i = 0; i < table.length; i++) {
    let j = i - r;
    if (mode === "reflect") {
      j = ((j % period) + period) % period;
      if (j >= n) j = period - 1 - j;
    } else {
      if (j < 0) j = 0;
      if (j > n - 1) j = n - 1;
    }
    table[i] = j;
  }
  return table;
}

export function splitChannels(data, width, height) {
  const size = width * height;
  const channels = [new Float32Array(size), new Float32Array(size), new Float32Array(size)];
  for (let i = 0, p = 0; i < size; i++, p += 4) {
    channels[0][i] = data[p];
    channels[1][i] = data[p + 1];
    channels[2][i] = data[p + 2];
  }
  return channels;
}

export function mergeChannels(channels, width, height) {
  const size = width * height;
  const data = new Uint8ClampedArray(size * 4);
  for (let i = 0, p = 0; i < size; i++, p += 4) {
    data[p] = channels[0][i];
    data[p + 1] = channels[1][i];
    data[p + 2] = channels[2][i];
    data[p + 3] = 255;
  }
  return data;
}

export function toGray(data, width, height) {
  const size = width * height;
  const gray = new Uint8Array(size);
  for (let i = 0, p = 0; i < size; i++, p += 4) {
    gray[i] = Math.round(0.299 * data[p] + 0.587 * data[p + 1] + 0.114 * data[p + 2]);
  }
  return gray;
}

export function grayToRgba(gray, width, height) {
  const size = width * height;
  const data = new Uint8ClampedArray(size * 4);
  for (let i = 0, p = 0; i < size; i++, p += 4) {
    data[p] = gray[i];
    data[p + 1] = gray[i];
    data[p + 2] = gray[i];
    data[p + 3] = 255;
  }
  return data;
}

export function histogram(gray) {
  const bins = new Float64Array(256);
  for (let i = 0; i < gray.length; i++) bins[gray[i]]++;
  return bins;
}
