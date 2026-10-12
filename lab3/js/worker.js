import { run } from "./processing.js";

onmessage = event => {
  const { id, op, data, width, height, params } = event.data;
  const result = run(op, data, width, height, params);
  postMessage({ id, op, width, height, ...result }, [result.data.buffer]);
};
