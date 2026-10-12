const BATCH = 50;

export function scan(items, onResults) {
  return new Promise(resolve => {
    const batches = [];
    for (let i = 0; i < items.length; i += BATCH) batches.push(items.slice(i, i + BATCH));
    const count = Math.min(navigator.hardwareConcurrency || 4, batches.length);
    const workers = [];
    let next = 0;
    let active = 0;

    const feed = worker => {
      if (next < batches.length) {
        active++;
        worker.postMessage(batches[next++]);
      } else if (active === 0) {
        workers.forEach(w => w.terminate());
        resolve();
      }
    };

    for (let i = 0; i < count; i++) {
      const worker = new Worker(new URL("./worker.js", import.meta.url), { type: "module" });
      worker.onmessage = event => {
        active--;
        onResults(event.data);
        feed(worker);
      };
      workers.push(worker);
    }
    workers.forEach(feed);
  });
}
