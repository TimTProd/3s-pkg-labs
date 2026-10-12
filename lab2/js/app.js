import { scan } from "./engine.js";

const PAGE = 100;

const $ = id => document.getElementById(id);

let results = [];
let page = 0;
let total = 0;
let started = 0;
let finished = 0;
let renderQueued = false;

$("folder").addEventListener("change", e => start(e.target));
$("files").addEventListener("change", e => start(e.target));

async function start(input) {
  const items = [...input.files]
    .filter(file => !file.name.startsWith("."))
    .map(file => ({ file, name: file.webkitRelativePath || file.name }));
  input.value = "";
  if (!items.length) return;
  results = [];
  total = items.length;
  page = 0;
  started = performance.now();
  finished = 0;
  await scan(items, batch => {
    results.push(...batch);
    scheduleRender();
  });
  finished = performance.now();
  render();
}

function scheduleRender() {
  if (renderQueued) return;
  renderQueued = true;
  setTimeout(() => { renderQueued = false; render(); }, 200);
}

function render() {
  const seconds = ((finished || performance.now()) - started) / 1000;
  $("bar").max = total;
  $("bar").value = results.length;
  $("progressText").textContent = `${results.length} из ${total} · ${seconds.toFixed(1)} с`;

  const count = status => results.filter(r => r.status === status).length;
  $("stats").textContent =
    `Всего: ${results.length}, корректных: ${count("ok")}, повреждённых: ${count("damaged")}, не изображений: ${count("unknown")}`;

  const filter = $("filter").value;
  const view = results
    .map((r, i) => ({ ...r, n: i + 1 }))
    .filter(r => filter === "all" || (filter === "note" ? r.note : r.status === filter));

  const pages = Math.max(1, Math.ceil(view.length / PAGE));
  page = Math.min(page, pages - 1);
  $("pageInfo").textContent = `Страница ${page + 1} из ${pages}`;
  $("rows").innerHTML = view.slice(page * PAGE, (page + 1) * PAGE).map(row).join("");
}

function esc(value) {
  return value == null ? "—" : String(value).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
}

function bytes(n) {
  if (n < 1024) return n + " Б";
  if (n < 1024 * 1024) return (n / 1024).toFixed(1) + " КБ";
  return (n / 1024 / 1024).toFixed(2) + " МБ";
}

const STATUS = { ok: "OK", damaged: "Файл повреждён", unknown: "Не изображение" };

function row(r) {
  let status = STATUS[r.status];
  if (r.reason) status += `: ${esc(r.reason)}`;
  if (r.note) status += `<div class="note">${esc(r.note)}</div>`;
  return `<tr class="${r.status}">
    <td>${r.n}</td>
    <td>${esc(r.name)}</td>
    <td>${esc(r.format)}</td>
    <td>${r.width ? `${r.width} × ${r.height}` : "—"}</td>
    <td>${esc(r.dpi)}</td>
    <td>${esc(r.depth)}</td>
    <td>${esc(r.compression)}</td>
    <td>${bytes(r.size)}</td>
    <td>${status}</td>
    <td>${esc(r.extra)}</td>
  </tr>`;
}

$("filter").addEventListener("change", () => { page = 0; render(); });
$("prev").addEventListener("click", () => { if (page > 0) { page--; render(); } });
$("next").addEventListener("click", () => { page++; render(); });
