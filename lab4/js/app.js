import { VirtualGrid } from "./grid.js";
import { GridPainter } from "./painter.js";
import { stepLine, ddaLine, bresenhamLine, wuLine, castlePitteway, bresenhamCircle } from "./raster.js";
import { drawChart } from "./chart.js";

const $ = id => document.getElementById(id);
const grid = new VirtualGrid(401, 401);
const canvas = $("grid");
canvas.width = 960;
canvas.height = 560;
const painter = new GridPainter(canvas, grid);

const algorithms = {
  step: { name: "Пошаговый", fn: stepLine, header: ["x", "y = kx + b", "y округл."], stepHeader: ["x", "y", "x = ky + b"] },
  dda: { name: "ЦДА", fn: ddaLine, header: ["i", "x", "y", "X", "Y"] },
  bresenham: { name: "Брезенхем", fn: bresenhamLine, header: ["i", "x", "y", "e", "шаг"] },
  wu: { name: "Ву", fn: wuLine, header: ["x", "y точное", "y нижн.", "яркость", "y верхн.", "яркость"] },
  castle: { name: "Кастл-Питвей", fn: castlePitteway, header: ["x", "y", "m1", "m2"] },
  circle: { name: "Брезенхем (окружность)", fn: bresenhamCircle, header: ["x", "y", "d", "следующая точка"] }
};

function readInt(id) {
  const v = Math.round(Number($(id).value));
  return Math.max(-190, Math.min(190, Number.isFinite(v) ? v : 0));
}

function updateFields() {
  const circle = $("algorithm").value === "circle";
  document.querySelectorAll(".for-line").forEach(el => el.classList.toggle("hidden", circle));
  document.querySelectorAll(".for-circle").forEach(el => el.classList.toggle("hidden", !circle));
  $("labelStart").textContent = circle ? "Центр" : "Начало";
}

function build() {
  const key = $("algorithm").value;
  const alg = algorithms[key];
  const x0 = readInt("x0");
  const y0 = readInt("y0");
  const x1 = readInt("x1");
  const y1 = readInt("y1");
  const r = Math.max(0, Math.min(190, readInt("r")));
  grid.reset();
  const trace = [];
  let extra = "";
  let call;
  if (key === "circle") {
    call = target => alg.fn(x0, y0, r, target);
    alg.fn(x0, y0, r, grid, trace);
    painter.overlay = { type: "circle", cx: x0, cy: y0, r };
  } else {
    call = target => alg.fn(x0, y0, x1, y1, target);
    const word = alg.fn(x0, y0, x1, y1, grid, trace);
    painter.overlay = $("ideal").checked ? { type: "line", x0, y0, x1, y1 } : null;
    if (key === "castle") extra = "Строка шагов: " + word + " (s – шаг по главной оси, d – диагональный шаг)";
  }
  if (key === "circle" && !$("ideal").checked) painter.overlay = null;
  const sink = { setPixel() {} };
  for (let i = 0; i < 2000; i++) call(sink);
  const runs = 20000;
  const t0 = performance.now();
  for (let i = 0; i < runs; i++) call(sink);
  const micro = ((performance.now() - t0) * 1000) / runs;
  $("info").textContent = "Закрашено пикселей: " + grid.count() + ". Время одного вызова: " + micro.toFixed(2) + " мкс (среднее по " + runs + " вызовам). " + extra;
  const header = key === "step" && Math.abs(y1 - y0) > Math.abs(x1 - x0) ? alg.stepHeader : alg.header;
  renderTrace(header, trace);
  painter.showValues = $("values").checked;
  painter.draw();
}

function renderTrace(header, rows) {
  const table = $("trace");
  table.innerHTML = "";
  if (!rows.length) return;
  const head = document.createElement("tr");
  header.forEach(h => {
    const th = document.createElement("th");
    th.textContent = h;
    head.appendChild(th);
  });
  table.appendChild(head);
  rows.slice(0, 400).forEach(row => {
    const tr = document.createElement("tr");
    row.forEach(v => {
      const td = document.createElement("td");
      td.textContent = v;
      tr.appendChild(td);
    });
    table.appendChild(tr);
  });
}

function fitView() {
  const key = $("algorithm").value;
  let minX;
  let maxX;
  let minY;
  let maxY;
  if (key === "circle") {
    const r = readInt("r");
    minX = readInt("x0") - r;
    maxX = readInt("x0") + r;
    minY = readInt("y0") - r;
    maxY = readInt("y0") + r;
  } else {
    minX = Math.min(readInt("x0"), readInt("x1"));
    maxX = Math.max(readInt("x0"), readInt("x1"));
    minY = Math.min(readInt("y0"), readInt("y1"));
    maxY = Math.max(readInt("y0"), readInt("y1"));
  }
  painter.centerX = (minX + maxX) / 2;
  painter.centerY = (minY + maxY) / 2;
  const sx = canvas.width / (maxX - minX + 6);
  const sy = canvas.height / (maxY - minY + 6);
  painter.scale = Math.max(4, Math.min(80, Math.floor(Math.min(sx, sy))));
  $("scale").value = painter.scale;
}

$("build").onclick = () => {
  build();
};
$("fit").onclick = () => {
  fitView();
  painter.draw();
};
$("example").onclick = () => {
  const key = $("algorithm").value;
  if (key === "circle") {
    $("x0").value = 0;
    $("y0").value = 0;
    $("r").value = 6;
  } else {
    $("x0").value = 1;
    $("y0").value = 1;
    $("x1").value = 10;
    $("y1").value = 6;
  }
  build();
  fitView();
  painter.draw();
};
$("algorithm").onchange = () => {
  updateFields();
  build();
  fitView();
  painter.draw();
};
$("scale").oninput = () => {
  painter.scale = Number($("scale").value);
  painter.draw();
};
$("ideal").onchange = build;
$("values").onchange = build;

let dragging = null;
canvas.onmousedown = e => {
  dragging = { x: e.offsetX, y: e.offsetY, cx: painter.centerX, cy: painter.centerY };
};
window.onmouseup = () => {
  dragging = null;
};
canvas.onmousemove = e => {
  const ratio = canvas.width / canvas.clientWidth;
  const sx = e.offsetX * ratio;
  const sy = e.offsetY * ratio;
  if (dragging) {
    painter.centerX = dragging.cx - ((e.offsetX - dragging.x) * ratio) / painter.scale;
    painter.centerY = dragging.cy + ((e.offsetY - dragging.y) * ratio) / painter.scale;
    painter.draw();
  }
  const [x, y] = painter.cellAt(sx, sy);
  const v = grid.get(x, y);
  $("cursor").textContent = "Клетка (" + x + "; " + y + ")" + (v > 0 ? ", яркость " + v.toFixed(2) : "");
};
canvas.onwheel = e => {
  e.preventDefault();
  const next = Math.max(4, Math.min(80, painter.scale + (e.deltaY < 0 ? 2 : -2)));
  painter.scale = next;
  $("scale").value = next;
  painter.draw();
};

const colors = { step: "#7a7a7a", dda: "#d62728", bresenham: "#1f77b4", wu: "#2ca02c", castle: "#9467bd", circle: "#ff7f0e" };
const names = { step: "Пошаговый", dda: "ЦДА", bresenham: "Брезенхем", wu: "Ву", castle: "Кастл-Питвей", circle: "Окружность" };

function seriesOf(map) {
  return Object.keys(map).map(k => ({ name: names[k], color: colors[k], points: map[k] }));
}

function showBenchmark(r) {
  drawChart($("chart1"), { title: "Время от числа отрезков", xLabel: "Число отрезков", yLabel: "Суммарное время, мс", series: seriesOf(r.segments) });
  drawChart($("chart2"), { title: "Время на 10 000 отрезков от длины", xLabel: "Длина отрезка, пикс.", yLabel: "Время, мс", series: seriesOf(r.byLength) });
  drawChart($("chart3"), { title: "Время от числа окружностей", xLabel: "Число окружностей", yLabel: "Суммарное время, мс", series: [{ name: names.circle, color: colors.circle, points: r.circles }] });
  drawChart($("chart4"), { title: "Время на 5 000 окружностей от радиуса", xLabel: "Радиус, пикс.", yLabel: "Время, мс", series: [{ name: names.circle, color: colors.circle, points: r.circlesByRadius }] });
  drawChart($("chart5"), { title: "Только вычисления: время от числа отрезков", xLabel: "Число отрезков", yLabel: "Суммарное время, мс", series: seriesOf(r.compute.segments) });
  drawChart($("chart6"), { title: "Только вычисления: время от длины", xLabel: "Длина отрезка, пикс.", yLabel: "Время, мс", series: seriesOf(r.compute.byLength) });
  const table = $("totals");
  table.innerHTML = "<tr><th>Алгоритм</th><th>Запись в растр, мс</th><th>Только вычисления, мс</th></tr>";
  const labels = { step: "Пошаговый, 100 000 отрезков", dda: "ЦДА, 100 000 отрезков", bresenham: "Брезенхем, 100 000 отрезков", wu: "Ву, 100 000 отрезков", castle: "Кастл-Питвей, 100 000 отрезков", circle: "Брезенхем, 50 000 окружностей" };
  Object.keys(labels).forEach(k => {
    const tr = document.createElement("tr");
    tr.innerHTML = "<td>" + labels[k] + "</td><td>" + r.totals[k].toFixed(1) + "</td><td>" + (r.compute.totals[k] === undefined ? "–" : r.compute.totals[k].toFixed(1)) + "</td>";
    table.appendChild(tr);
  });
  $("octants").textContent = "Отрезков по октантам: " + r.octants.join(", ");
  window.benchmarkResult = r;
}

function runInWorker(mode, offset, share) {
  return new Promise(resolve => {
    const worker = new Worker("js/bench-worker.js", { type: "module" });
    worker.onmessage = e => {
      if (e.data.type === "progress") {
        $("bar").value = offset + e.data.fraction * share;
        $("barText").textContent = e.data.text;
      } else {
        worker.terminate();
        resolve(e.data.result);
      }
    };
    worker.postMessage(mode);
  });
}

$("runBench").onclick = async () => {
  $("runBench").disabled = true;
  $("bar").value = 0;
  $("barText").textContent = "Запуск...";
  const raster = await runInWorker("raster", 0, 0.6);
  const compute = await runInWorker("compute", 0.6, 0.4);
  raster.compute = compute;
  $("bar").value = 1;
  $("barText").textContent = "Готово";
  $("runBench").disabled = false;
  showBenchmark(raster);
};

updateFields();
$("example").click();
