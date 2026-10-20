import { runBenchmark } from "./benchmark.js";

onmessage = event => {
  const result = runBenchmark(event.data, (fraction, text) => postMessage({ type: "progress", fraction, text }));
  postMessage({ type: "done", result });
};
