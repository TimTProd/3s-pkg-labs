import { VirtualGrid } from "./grid.js";
import { stepLine, ddaLine, bresenhamLine, wuLine, castlePitteway, bresenhamCircle } from "./raster.js";

export const LINE_ALGORITHMS = [
  ["step", "Пошаговый"],
  ["dda", "ЦДА"],
  ["bresenham", "Брезенхем"],
  ["wu", "Ву"],
  ["castle", "Кастл-Питвей"]
];

const GRID_SIZE = 2048;
const HALF = 1000;

function makeRandom(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function makeSegments(count, minLength, maxLength, seed) {
  const random = makeRandom(seed);
  const data = new Int32Array(count * 4);
  const octants = new Array(8).fill(0);
  for (let i = 0; i < count; i++) {
    const length = minLength + random() * (maxLength - minLength);
    const angle = random() * 2 * Math.PI;
    const range = HALF - Math.ceil(maxLength);
    const x0 = Math.round((random() * 2 - 1) * range);
    const y0 = Math.round((random() * 2 - 1) * range);
    const x1 = x0 + Math.round(length * Math.cos(angle));
    const y1 = y0 + Math.round(length * Math.sin(angle));
    data[i * 4] = x0;
    data[i * 4 + 1] = y0;
    data[i * 4 + 2] = x1;
    data[i * 4 + 3] = y1;
    octants[Math.min(7, Math.floor(angle / (Math.PI / 4)))]++;
  }
  return { data, octants };
}

export function makeCircles(count, minRadius, maxRadius, seed) {
  const random = makeRandom(seed);
  const data = new Int32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const r = Math.round(minRadius + random() * (maxRadius - minRadius));
    const range = HALF - r;
    data[i * 3] = Math.round((random() * 2 - 1) * range);
    data[i * 3 + 1] = Math.round((random() * 2 - 1) * range);
    data[i * 3 + 2] = r;
  }
  return data;
}

export const computeTarget = {
  sum: 0,
  setPixel(x, y) {
    this.sum = (this.sum + x * 3 + y) | 0;
  }
};

const runners = {
  step(d, from, to, t) {
    for (let i = from; i < to; i++) stepLine(d[i * 4], d[i * 4 + 1], d[i * 4 + 2], d[i * 4 + 3], t);
  },
  dda(d, from, to, t) {
    for (let i = from; i < to; i++) ddaLine(d[i * 4], d[i * 4 + 1], d[i * 4 + 2], d[i * 4 + 3], t);
  },
  bresenham(d, from, to, t) {
    for (let i = from; i < to; i++) bresenhamLine(d[i * 4], d[i * 4 + 1], d[i * 4 + 2], d[i * 4 + 3], t);
  },
  wu(d, from, to, t) {
    for (let i = from; i < to; i++) wuLine(d[i * 4], d[i * 4 + 1], d[i * 4 + 2], d[i * 4 + 3], t);
  },
  castle(d, from, to, t) {
    for (let i = from; i < to; i++) castlePitteway(d[i * 4], d[i * 4 + 1], d[i * 4 + 2], d[i * 4 + 3], t);
  }
};

function drawCircles(data, from, to, target) {
  for (let i = from; i < to; i++) bresenhamCircle(data[i * 3], data[i * 3 + 1], data[i * 3 + 2], target);
}

function timeIt(run, repeats) {
  let best = Infinity;
  for (let r = 0; r < repeats; r++) {
    const t0 = performance.now();
    run();
    const t = performance.now() - t0;
    if (t < best) best = t;
  }
  return best;
}

export function runBenchmark(mode, report) {
  const raster = mode === "raster";
  const grid = new VirtualGrid(GRID_SIZE, GRID_SIZE);
  const target = raster ? grid : computeTarget;
  const reset = () => {
    if (raster) grid.reset();
  };
  const result = { mode, segments: {}, byLength: {}, circles: [], circlesByRadius: [], octants: null, totals: {} };

  const total = 100000;
  const step = 10000;
  const segs = makeSegments(total, 10, 500, 1);
  result.octants = segs.octants;
  const warm = makeSegments(2000, 10, 500, 7);
  const lengths = [50, 100, 200, 400, 600, 800];
  const perLength = 10000;
  const steps = LINE_ALGORITHMS.length * 2 + (raster ? 2 : 0);
  let done = 0;
  const tick = text => report(++done / steps, text);

  for (const [key, name] of LINE_ALGORITHMS) {
    const run = runners[key];
    run(warm.data, 0, 2000, target);
    reset();
    const points = [];
    let cumulative = 0;
    for (let from = 0; from < total; from += step) {
      const t = timeIt(() => run(segs.data, from, from + step, target), 5);
      cumulative += t;
      points.push([from + step, cumulative]);
    }
    result.segments[key] = points;
    result.totals[key] = cumulative;
    tick(name + ": 100 000 отрезков");
  }

  for (const [key, name] of LINE_ALGORITHMS) {
    const run = runners[key];
    const points = [];
    for (const L of lengths) {
      const set = makeSegments(perLength, L, L, 100 + L);
      reset();
      const t = timeIt(() => run(set.data, 0, perLength, target), 5);
      points.push([L, t]);
    }
    result.byLength[key] = points;
    tick(name + ": зависимость от длины");
  }

  if (!raster) return result;

  const circleTotal = 50000;
  const circleStep = 5000;
  const circles = makeCircles(circleTotal, 1, 500, 3);
  drawCircles(circles, 0, 2000, grid);
  grid.reset();
  let cumulative = 0;
  for (let from = 0; from < circleTotal; from += circleStep) {
    const t = timeIt(() => drawCircles(circles, from, from + circleStep, grid), 5);
    cumulative += t;
    result.circles.push([from + circleStep, cumulative]);
  }
  result.totals.circle = cumulative;
  tick("Окружности: 50 000 штук");

  for (const R of [20, 50, 100, 200, 400, 800]) {
    const set = makeCircles(5000, R, R, 200 + R);
    grid.reset();
    const t = timeIt(() => drawCircles(set, 0, 5000, grid), 5);
    result.circlesByRadius.push([R, t]);
  }
  tick("Окружности: зависимость от радиуса");
  return result;
}
