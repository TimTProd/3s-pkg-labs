import { toGray, grayToRgba, histogram } from "./buffer.js";
import { otsuThreshold, iterativeThreshold, applyThreshold, sauvolaThreshold } from "./threshold.js";
import { sharpenLaplacian, sharpenUnsharp, highPassMap } from "./filters.js";

export function run(op, data, width, height, p) {
  const start = performance.now();
  let result;
  let threshold = null;
  if (op === "otsu" || op === "iterative") {
    const gray = toGray(data, width, height);
    const hist = histogram(gray);
    threshold = op === "otsu" ? otsuThreshold(hist, gray.length) : iterativeThreshold(hist, gray.length);
    result = grayToRgba(applyThreshold(gray, threshold), width, height);
  } else if (op === "sauvola") {
    const gray = toGray(data, width, height);
    result = grayToRgba(sauvolaThreshold(gray, width, height, p.window, p.k, p.range), width, height);
  } else if (op === "laplacian") {
    result = sharpenLaplacian(data, width, height, p.edge, p.neighbors, p.strength);
  } else if (op === "unsharp") {
    result = sharpenUnsharp(data, width, height, p.edge, p.sigma, p.amount);
  } else if (op === "highpass") {
    result = highPassMap(data, width, height, p.edge, p.sigma);
  }
  return { data: result, threshold, time: performance.now() - start };
}
