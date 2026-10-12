import { analyze } from "./parsers/index.js";

onmessage = event => {
  postMessage(event.data.map(({ file, name }) => analyze(file, name)));
};
