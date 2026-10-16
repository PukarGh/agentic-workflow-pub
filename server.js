const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = 3000;
const ARTIFACTS_DIR = path.join(__dirname, "artifacts");
const JIRA_BASE_URL = process.env.JIRA_BASE_URL || "https://your-org.atlassian.net";

function getFiles(dir, base = "") {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  let files = [];
  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue;
    const rel = path.join(base, entry.name);
    if (entry.isDirectory()) {
      files = files.concat(getFiles(path.join(dir, entry.name), rel));
    } else {
      files.push(rel);
    }
  }
  return files;
}

function escapeHtml(str) {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function extractDate(filePath) {
  const match = path.basename(filePath).match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : "0000-00-00";
}

function newestDate(files) {
  return files.reduce((max, f) => {
    const d = extractDate(f);
    return d > max ? d : max;
  }, "0000-00-00");
}

const STEPS = [
  { key: "research", label: "Research" },
  { key: "plan", label: "Plan" },
  { key: "implement", label: "Implement" },
  { key: "review", label: "Review" },
  { key: "push-pr", label: "Push PR" },
  { key: "work-summary", label: "Summary" },
];

function normalizeStep(raw) {
  const s = raw.replace(/^\d+-/, "").toLowerCase();
  return STEPS.find(st => s === st.key || s.startsWith(st.key)) || null;
}

function getStepStates(dir) {
  const trackingPath = path.join(ARTIFACTS_DIR, dir, "tracking.md");
  if (!fs.existsSync(trackingPath)) return null;
  const lines = fs.readFileSync(trackingPath, "utf-8").trim().split("\n");
  const state = {};
  for (const line of lines) {
    const cols = line.split("|").map(c => c.trim()).filter(Boolean);
    if (cols.length < 3 || cols[1] === "Step" || cols[1].startsWith("-")) continue;
    const matched = normalizeStep(cols[1]);
    if (!matched) continue;
    const event = cols[2].toLowerCase();
    if (event === "completed") state[matched.key] = "completed";
    else if (event === "waiting_for_user") state[matched.key] = "waiting";
    else if ((event === "started" || event === "resumed") && state[matched.key] !== "completed") state[matched.key] = "active";
  }
  return STEPS.map(s => ({ ...s, state: state[s.key] || "pending" }));
}

function parseDirName(dir) {
  const match = dir.match(/^([A-Z]+-\d+)(?:-(.+))?$/);
  if (!match) return { id: dir, title: "" };
  const id = match[1];
  const title = match[2]
    ? match[2].replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase())
    : "";
  return { id, title };
}

function renderList() {
  const files = getFiles(ARTIFACTS_DIR);
  const grouped = {};
  for (const f of files) {
    const dir = path.dirname(f);
    if (!grouped[dir]) grouped[dir] = [];
    grouped[dir].push(f);
  }

  let list = "";
  const sortedGroups = Object.entries(grouped).sort(
    (a, b) => newestDate(b[1]).localeCompare(newestDate(a[1]))
  );
  sortedGroups.forEach(([dir, items], idx) => {
    const { id, title } = parseDirName(dir);
    const titleHtml = title ? `<span class="card-title">${escapeHtml(title)}</span>` : "";
    const stepStates = getStepStates(dir);
    let stepsHtml = "";
    if (stepStates) {
      stepsHtml = `<div class="steps">${stepStates.map(s =>
        `<div class="step ${s.state}"><span class="step-dot"></span><span class="step-label">${s.label}</span></div>`
      ).join("")}</div>`;
    }
    list += `<details class="card" data-dir="${escapeHtml(dir)}"><summary><div class="card-header"><div class="card-id-row"><a class="card-id" href="${JIRA_BASE_URL}/browse/${encodeURIComponent(id)}" target="_blank">${escapeHtml(id)}</a></div>${titleHtml}</div></summary>${stepsHtml}<ol>`;
    items.forEach((item, i) => {
      const name = path.basename(item);
      const urlPath = item.split(path.sep).map(encodeURIComponent).join("/");
      const num = String(i + 1).padStart(2, "0");
      list += `<li><span class="num">${num}</span><a href="/${urlPath}">${escapeHtml(name)}</a></li>`;
    });
    list += "</ol></details>";
  });

  return list;
}

function renderPage() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Artifacts</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; max-width: 720px; margin: 40px auto; padding: 0 20px; color: #1a1a1a; }
    h1 { font-size: 1.6rem; margin-bottom: 24px; border-bottom: 2px solid #e5e5e5; padding-bottom: 12px; }
    .card { background: #fff; border: 1px solid #e0e0e0; border-radius: 8px; margin-bottom: 12px; overflow: hidden; }
    .card summary { padding: 14px 18px; cursor: pointer; list-style: none; display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #f0f0f0; }
    .card-header { display: flex; flex-direction: column; gap: 6px; flex: 1; }
    .card-id-row { display: flex; align-items: center; gap: 10px; }
    .card-id { font-size: 1.05rem; font-weight: 700; color: #1a1a1a; text-decoration: none; }
    .card-id:hover { text-decoration: underline; }
    .card-title { font-size: 0.92rem; font-weight: 400; color: #888; }
    .steps { display: flex; align-items: flex-start; gap: 0; padding: 16px 18px 12px; position: relative; border-bottom: 1px solid #f0f0f0; }
    .step { display: flex; flex-direction: column; align-items: center; gap: 4px; position: relative; flex: 1; }
    .step:not(:first-child)::before { content: ""; position: absolute; top: 5px; right: 50%; width: 100%; height: 2px; background: #e0e0e0; z-index: 0; }
    .step.completed:not(:first-child)::before { background: #34a853; }
    .step.active:not(:first-child)::before { background: #e0e0e0; }
    .step-dot { width: 10px; height: 10px; border-radius: 50%; border: 2px solid #ccc; background: #fff; position: relative; z-index: 1; }
    .step.completed .step-dot { background: #34a853; border-color: #34a853; }
    .step.active .step-dot { background: #1a73e8; border-color: #1a73e8; animation: pulse 1.5s ease-in-out infinite; }
    .step.waiting .step-dot { background: #f9ab00; border-color: #f9ab00; }
    .step-label { font-size: 0.65rem; color: #999; text-transform: uppercase; letter-spacing: 0.02em; }
    .step.completed .step-label { color: #34a853; }
    .step.active .step-label { color: #1a73e8; font-weight: 600; }
    .step.waiting .step-label { color: #f9ab00; }
    @keyframes pulse { 0%, 100% { box-shadow: 0 0 0 0 rgba(26,115,232,0.4); } 50% { box-shadow: 0 0 0 4px rgba(26,115,232,0); } }
    .card summary::-webkit-details-marker { display: none; }
    .card summary::after { content: "▸"; font-size: 0.85rem; color: #999; transition: transform 0.2s; }
    .card[open] summary::after { transform: rotate(90deg); }
    .card summary:hover { background: #f8f8f8; }
    .card ol { list-style: none; padding: 12px 18px 14px; }
    .card li { padding: 10px 0; display: flex; align-items: baseline; gap: 8px; border-bottom: 1px solid #f5f5f5; }
    .card li:last-child { border-bottom: none; }
    .num { font-size: 0.8rem; color: #999; font-variant-numeric: tabular-nums; min-width: 20px; }
    a { color: #0066cc; text-decoration: none; }
    a:hover { text-decoration: underline; }
  </style>
</head>
<body>
  <h1>Artifacts</h1>
  <div id="content"></div>
  <script>
    function refresh() {
      const openDirs = new Set();
      document.querySelectorAll("details.card[open]").forEach(d => openDirs.add(d.dataset.dir));
      fetch("/api/list").then(r => r.text()).then(html => {
        const container = document.getElementById("content");
        const firstLoad = container.children.length === 0;
        container.innerHTML = html;
        container.querySelectorAll("details.card").forEach((d, i) => {
          if (firstLoad && i === 0) d.open = true;
          else if (openDirs.has(d.dataset.dir)) d.open = true;
        });
      });
    }
    refresh();
    setInterval(refresh, 5000);
  </script>
</body>
</html>`;
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (url.pathname === "/" || url.pathname === "") {
    res.writeHead(200, { "Content-Type": "text/html" });
    res.end(renderPage());
    return;
  }

  if (url.pathname === "/api/list") {
    res.writeHead(200, { "Content-Type": "text/html" });
    res.end(renderList());
    return;
  }

  const filePath = decodeURIComponent(url.pathname.slice(1));
  if (filePath) {
    const abs = path.join(ARTIFACTS_DIR, filePath);
    const resolved = path.resolve(abs);
    if (!resolved.startsWith(path.resolve(ARTIFACTS_DIR))) {
      res.writeHead(403, { "Content-Type": "text/plain" });
      res.end("Forbidden");
      return;
    }
    if (!fs.existsSync(resolved) || fs.statSync(resolved).isDirectory()) {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("Not found");
      return;
    }
    const content = fs.readFileSync(resolved, "utf-8");
    res.writeHead(200, { "Content-Type": "text/markdown; charset=utf-8" });
    res.end(content);
    return;
  }

  res.writeHead(404, { "Content-Type": "text/plain" });
  res.end("Not found");
});

server.listen(PORT, () => {
  console.log(`Artifacts server running at http://localhost:${PORT}`);
});
