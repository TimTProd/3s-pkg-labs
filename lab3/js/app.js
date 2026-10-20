import { toGray, histogram } from "./buffer.js";

const samples = [
  ["page.png", "Страница с тенью"],
  ["uneven_light.png", "Неравномерное освещение"],
  ["small_objects.png", "Мелкие объекты на тёмном фоне"],
  ["coins.png", "Монеты"],
  ["text.png", "Текст"],
  ["camera_blur.png", "Размытое (оттенки серого)"],
  ["astronaut_blur.png", "Размытое (цветное)"],
  ["moon_blur.png", "Размытая Луна"],
  ["camera_noisy.png", "Зашумлённое"]
];

const $ = id => document.getElementById(id);
const sampleSelect = $("sample");
const results = $("results");
const status = $("status");
let source = null;
const worker = new Worker("js/worker.js", { type: "module" });
let nextId = 1;
const pending = new Map();

worker.onmessage = event => {
  const resolve = pending.get(event.data.id);
  pending.delete(event.data.id);
  resolve(event.data);
};

samples.forEach(([file, title]) => {
  const option = document.createElement("option");
  option.value = "images/" + file;
  option.textContent = title;
  sampleSelect.appendChild(option);
});

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0);
      resolve(ctx.getImageData(0, 0, canvas.width, canvas.height));
    };
    img.onerror = reject;
    img.src = url;
  });
}

async function selectSource(url) {
  source = await loadImage(url);
  results.innerHTML = "";
  results.appendChild(makeFigure("Исходное", source.data, source.width, source.height, []));
  status.textContent = source.width + "×" + source.height;
}

function makeFigure(title, data, width, height, thresholds) {
  const figure = document.createElement("figure");
  const caption = document.createElement("figcaption");
  caption.textContent = title;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  canvas.getContext("2d").putImageData(new ImageData(new Uint8ClampedArray(data), width, height), 0, 0);
  figure.append(caption, canvas);
  const hist = document.createElement("canvas");
  hist.className = "hist";
  drawHistogram(hist, histogram(toGray(data, width, height)), thresholds);
  figure.append(hist);
  return figure;
}

function drawHistogram(canvas, bins, thresholds) {
  canvas.width = 532;
  canvas.height = 130;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, 532, 130);
  let max = 0;
  for (let i = 0; i < 256; i++) if (bins[i] > max) max = bins[i];
  ctx.fillStyle = "#444";
  for (let i = 0; i < 256; i++) {
    const h = max ? Math.round((bins[i] / max) * 100) : 0;
    ctx.fillRect(10 + i * 2, 110 - h, 2, Math.max(h, bins[i] > 0 ? 2 : 0));
  }
  ctx.fillStyle = "#000";
  ctx.fillRect(10, 110, 512, 1);
  ctx.font = "11px Arial";
  ctx.fillText("0", 6, 124);
  ctx.fillText("255", 504, 124);
  const colors = ["#d00", "#0a0", "#00d"];
  thresholds.forEach((t, i) => {
    ctx.fillStyle = colors[i % colors.length];
    ctx.fillRect(10 + t * 2, 0, 2, 110);
  });
}

function params() {
  return {
    window: Number($("window").value),
    k: Number($("k").value),
    range: Number($("range").value),
    neighbors: Number($("neighbors").value),
    strength: Number($("strength").value),
    sigma: Number($("sigma").value),
    amount: Number($("amount").value),
    edge: $("edge").value
  };
}

function process(op) {
  return new Promise(resolve => {
    const id = nextId++;
    pending.set(id, resolve);
    const copy = new Uint8ClampedArray(source.data);
    worker.postMessage({ id, op, data: copy, width: source.width, height: source.height, params: params() }, [copy.buffer]);
  });
}

const titles = {
  otsu: "Оцу",
  iterative: "Итеративный порог",
  sauvola: "Саувола",
  laplacian: "Лапласиан",
  unsharp: "Нерезкая маска",
  highpass: "Высокочастотная составляющая"
};

function describe(result) {
  let text = titles[result.op];
  if (result.threshold !== null) text += ", порог " + result.threshold;
  return text + ", " + result.time.toFixed(1) + " мс";
}

async function apply(ops) {
  if (!source) return;
  status.textContent = "Обработка...";
  results.innerHTML = "";
  results.appendChild(makeFigure("Исходное", source.data, source.width, source.height, []));
  const thresholds = [];
  for (const op of ops) {
    const result = await process(op);
    results.appendChild(makeFigure(describe(result), result.data, result.width, result.height, []));
    if (result.threshold !== null) thresholds.push(result.threshold);
  }
  if (thresholds.length) {
    const original = results.firstChild.querySelector(".hist");
    drawHistogram(original, histogram(toGray(source.data, source.width, source.height)), thresholds);
    if (thresholds.length > 1) results.firstChild.querySelector("figcaption").textContent = "Исходное (красная линия — Оцу, зелёная — итеративный)";
  }
  status.textContent = "Готово";
}

function updateParams() {
  const op = $("op").value;
  document.querySelectorAll(".panel label[class]").forEach(el => {
    const show = el.classList.contains("p-" + op) || (el.classList.contains("p-filter") && ["laplacian", "unsharp", "highpass"].includes(op));
    el.classList.toggle("hidden", !show);
  });
}

$("op").onchange = updateParams;
$("apply").onclick = () => apply([$("op").value]);
$("compare").onclick = () => apply(["otsu", "iterative", "sauvola"]);
sampleSelect.onchange = () => selectSource(sampleSelect.value);
$("file").onchange = event => {
  const file = event.target.files[0];
  if (file) selectSource(URL.createObjectURL(file));
};

updateParams();
selectSource(sampleSelect.value);
