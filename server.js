const fs = require("fs");
const path = require("path");
const express = require("express");
const http = require("http");
const multer = require("multer");
const { Server } = require("socket.io");

const PREFERRED_PORT = Number(process.env.PORT) || 3000;
const ROOT = __dirname;
const UPLOAD_DIR = path.join(ROOT, "uploads");
const DATA_DIR = path.join(ROOT, "data");
const STATE_FILE = path.join(DATA_DIR, "state.json");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: true },
});

function ensureDirs() {
  [UPLOAD_DIR, DATA_DIR].forEach((d) => {
    if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
  });
}

function loadState() {
  const empty = { slots: ["", "", "", "", ""] };
  try {
    const raw = fs.readFileSync(STATE_FILE, "utf8");
    const parsed = JSON.parse(raw);
    if (parsed && Array.isArray(parsed.slots)) {
      while (parsed.slots.length < 5) parsed.slots.push("");
      parsed.slots = parsed.slots.slice(0, 5);
      return parsed;
    }
  } catch (_) {}
  return empty;
}

function saveState(state) {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), "utf8");
}

let state = loadState();

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || ".jpg";
    const safe = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}${ext}`;
    cb(null, safe);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok = /^image\//.test(file.mimetype);
    cb(ok ? null : new Error("Only image uploads are allowed"), ok);
  },
});

app.use(express.static(path.join(ROOT, "public")));
app.use("/uploads", express.static(UPLOAD_DIR));

app.get("/api/state", (_req, res) => {
  res.json(state);
});

app.post("/api/upload/:slot", upload.single("photo"), (req, res) => {
  const slot = parseInt(req.params.slot, 10);
  if (Number.isNaN(slot) || slot < 0 || slot > 4) {
    return res.status(400).json({ error: "Invalid slot (0–4)" });
  }
  if (!req.file) {
    return res.status(400).json({ error: "No file" });
  }
  const url = `/uploads/${req.file.filename}`;
  state.slots[slot] = url;
  saveState(state);
  io.emit("photo", { slot, url });
  res.json({ ok: true, slot, url });
});

app.use((err, _req, res, _next) => {
  const msg = err && err.message ? err.message : "Error";
  res.status(400).json({ error: msg });
});

io.on("connection", (socket) => {
  socket.emit("state", state);
});

ensureDirs();

let listenPort = PREFERRED_PORT;
const MAX_TRY = PREFERRED_PORT + 25;

function listenWithFallback() {
  server.removeAllListeners("error");
  server.once("error", (err) => {
    if (err.code === "EADDRINUSE" && listenPort < MAX_TRY) {
      listenPort += 1;
      console.warn(
        `Port ${listenPort - 1} is already in use — trying http://localhost:${listenPort} …`,
      );
      listenWithFallback();
    } else {
      console.error(err);
      process.exit(1);
    }
  });
  server.listen(listenPort, () => {
    console.log(`Billboard running at http://localhost:${listenPort}`);
  });
}

listenWithFallback();
