const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = 3000;
const ARTIFACTS_DIR = path.join(__dirname, "artifacts");

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

function renderIndex() {
  const files = getFiles(ARTIFACTS_DIR);
  const grouped = {};
  for (const f of files) {
    const dir = path.dirname(f);
    if (!grouped[dir]) grouped[dir] = [];
    grouped[dir].push(f);
  }

  let list = "";
  for (const [dir, items] of Object.entries(grouped).sort()) {
    list += `<h2>${escapeHtml(dir)}</h2><ul>`;
    for (const item of items.sort()) {
      const name = path.basename(item);
      const urlPath = item.split(path.sep).map(encodeURIComponent).join("/");
      list += `<li><a href="/${urlPath}">${escapeHtml(name)}</a></li>`;
    }
    list += "</ul>";
  }

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
    h2 { font-size: 1.1rem; color: #555; margin: 20px 0 8px; }
    ul { list-style: none; }
    li { padding: 6px 0; }
    a { color: #0066cc; text-decoration: none; }
    a:hover { text-decoration: underline; }
  </style>
</head>
<body>
  <h1>Artifacts</h1>
  ${list}
</body>
</html>`;
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (url.pathname === "/" || url.pathname === "") {
    res.writeHead(200, { "Content-Type": "text/html" });
    res.end(renderIndex());
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
