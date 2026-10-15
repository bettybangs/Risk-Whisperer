// Local dev server: serves public/ and mounts the api/ handlers, no Vercel
// login needed. Reads .env if present. Usage: npm run dev
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
process.env.NODE_ENV = process.env.NODE_ENV || "development";

try {
  for (const line of fs.readFileSync(path.join(root, ".env"), "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
    if (m && !line.trim().startsWith("#") && m[2] !== "" && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
} catch (e) { /* no .env */ }

const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml" };
const port = Number(process.env.PORT) || 3000;

http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  if (url.pathname.startsWith("/api/")) {
    const name = url.pathname.slice(5).replace(/[^a-z]/g, "");
    let handler;
    try {
      handler = (await import(pathToFileURL(path.join(root, "api", name + ".js")).href)).default;
    } catch (e) {
      res.writeHead(404, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ error: { message: "Not found." } }));
    }
    let raw = "";
    for await (const chunk of req) raw += chunk;
    let body;
    try { body = raw ? JSON.parse(raw) : {}; } catch (e) { body = null; }
    const shim = {
      setHeader: (k, v) => res.setHeader(k, v),
      status(code) { res.statusCode = code; return this; },
      json(b) { res.setHeader("Content-Type", "application/json"); res.end(JSON.stringify(b)); }
    };
    return handler({ method: req.method, headers: req.headers, body }, shim);
  }
  const file = path.join(root, "public", url.pathname === "/" ? "index.html" : path.normalize(url.pathname).replace(/^(\.\.[/\\])+/, ""));
  if (!file.startsWith(path.join(root, "public"))) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end("Not found"); }
    res.writeHead(200, { "Content-Type": TYPES[path.extname(file)] || "application/octet-stream", "Cache-Control": "no-cache" });
    res.end(data);
  });
}).listen(port, () => console.log("Plain Talk running at http://localhost:" + port));
