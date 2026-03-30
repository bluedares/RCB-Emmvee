const path = require("path");
const express = require("express");
const crypto = require("crypto");

const { MATCHES, matchById } = require("./src/matches");
const {
  ensureDir,
  readCsv,
  rewriteCsv,
  appendCsvRow,
  fileExists,
  listFiles,
} = require("./src/csv/csv");

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// --- Minimal cookie parsing (no dependencies) ---
function parseCookies(cookieHeader) {
  if (!cookieHeader) return {};
  const out = {};
  const parts = cookieHeader.split(";");
  for (const p of parts) {
    const idx = p.indexOf("=");
    if (idx === -1) continue;
    const k = p.slice(0, idx).trim();
    const v = p.slice(idx + 1).trim();
    out[k] = decodeURIComponent(v);
  }
  return out;
}

function setCookie(res, name, value, { httpOnly = true, path = "/", maxAgeSeconds } = {}) {
  let cookie = `${name}=${encodeURIComponent(value)}; Path=${path}`;
  if (httpOnly) cookie += "; HttpOnly";
  if (typeof maxAgeSeconds === "number") cookie += `; Max-Age=${maxAgeSeconds}`;
  res.setHeader("Set-Cookie", cookie);
}

// --- In-memory sessions (simple + single-process) ---
const employeeSessions = new Map(); // token -> employeeId
const adminSessions = new Map(); // token -> username

function newToken() {
  return crypto.randomBytes(24).toString("hex");
}

function requireEmployee(req, res, next) {
  const cookies = parseCookies(req.headers.cookie);
  const token = cookies.emp_session;
  const employeeId = token ? employeeSessions.get(token) : null;
  if (!employeeId) return res.status(401).json({ error: "NOT_AUTHENTICATED" });
  req.employeeId = employeeId;
  next();
}

function requireAdmin(req, res, next) {
  const cookies = parseCookies(req.headers.cookie);
  const token = cookies.admin_session;
  const username = token ? adminSessions.get(token) : null;
  if (!username) return res.status(401).json({ error: "NOT_AUTHENTICATED" });
  req.adminUsername = username;
  next();
}

// --- Data locations ---
const DATA_DIR = path.join(__dirname, "data");
const WINNERS_DIR = path.join(DATA_DIR, "winners");
const EMPLOYEES_CSV = path.join(DATA_DIR, "employees.csv");
const ADMINS_CSV = path.join(DATA_DIR, "admins.csv");
const INTERESTS_CSV = path.join(DATA_DIR, "interests.csv");

async function ensureDataFiles() {
  await ensureDir(DATA_DIR);
  await ensureDir(WINNERS_DIR);

  // Create empty templates if missing
  if (!(await fileExists(EMPLOYEES_CSV))) {
    await rewriteCsv(EMPLOYEES_CSV, ["employeeId", "name", "email"], []);
  }
  
  // Seed admins.csv with default credentials if missing or empty
  if (!(await fileExists(ADMINS_CSV))) {
    await rewriteCsv(ADMINS_CSV, ["username", "password"], [
      { username: "suhas", password: "Admin@Emmvee" }
    ]);
    console.log("✅ Created admins.csv with default credentials");
  } else {
    // Check if file exists but is empty (only headers)
    const admins = await readCsv(ADMINS_CSV);
    if (admins.length === 0) {
      await rewriteCsv(ADMINS_CSV, ["username", "password"], [
        { username: "suhas", password: "Admin@Emmvee" }
      ]);
      console.log("✅ Seeded admins.csv with default credentials");
    }
  }
  
  if (!(await fileExists(INTERESTS_CSV))) {
    await rewriteCsv(INTERESTS_CSV, ["employeeId", "ticketCount", "matchId", "submittedAt"], []);
  }
}

function sanitizeMatchId(matchId) {
  // Safe for filenames
  return String(matchId).replace(/[^a-zA-Z0-9_-]/g, "_");
}

function winnersPathForMatch(matchId) {
  return path.join(WINNERS_DIR, `${sanitizeMatchId(matchId)}.csv`);
}

async function getAllWinnerEmployeeIds() {
  const files = await listFiles(WINNERS_DIR);
  const ids = new Set();
  for (const f of files) {
    if (!f.toLowerCase().endsWith(".csv")) continue;
    const rows = await readCsv(path.join(WINNERS_DIR, f));
    for (const r of rows) {
      if (r.employeeId) ids.add(String(r.employeeId).trim().toUpperCase());
    }
  }
  return ids;
}

// --- Static sites ---
app.use("/logo", express.static(path.join(__dirname, "public", "logo")));
app.use("/employee", express.static(path.join(__dirname, "public", "employee")));
app.use("/admin", express.static(path.join(__dirname, "public", "admin")));
app.get("/", (req, res) => res.redirect("/employee/login.html"));

// --- Public API ---
app.get("/api/matches", async (req, res) => {
  const matchesWithStatus = await Promise.all(
    MATCHES.map(async (m) => {
      const winnersPath = winnersPathForMatch(m.matchId);
      const winnersExist = await fileExists(winnersPath);
      let winnersGenerated = false;
      if (winnersExist) {
        const winners = await readCsv(winnersPath);
        winnersGenerated = winners.length > 0;
      }
      return { ...m, winnersGenerated };
    })
  );
  res.json({ matches: matchesWithStatus });
});

// --- Employee auth ---
app.post("/api/employee/login", async (req, res) => {
  const employeeId = String(req.body.employeeId || "").trim().toUpperCase();
  if (!employeeId) return res.status(400).json({ error: "EMPLOYEE_ID_REQUIRED" });

  const employees = await readCsv(EMPLOYEES_CSV);
  const found = employees.some((e) => String(e.employeeId || "").trim().toUpperCase() === employeeId);
  if (!found) return res.status(401).json({ error: "INVALID_EMPLOYEE_ID" });

  const interests = await readCsv(INTERESTS_CSV);
  const alreadySubmitted = interests.some((r) => String(r.employeeId || "").trim().toUpperCase() === employeeId);
  if (alreadySubmitted) return res.status(409).json({ error: "ALREADY_SUBMITTED" });

  const token = newToken();
  employeeSessions.set(token, employeeId);
  setCookie(res, "emp_session", token, { httpOnly: true, path: "/" });
  res.json({ ok: true, employeeId });
});

app.get("/api/me", requireEmployee, (req, res) => {
  res.json({ employeeId: req.employeeId });
});

app.get("/api/employee/submission-status", requireEmployee, async (req, res) => {
  const existing = await readCsv(INTERESTS_CSV);
  const submitted = existing.some((r) => String(r.employeeId || "").trim().toUpperCase() === req.employeeId.toUpperCase());
  res.json({ submitted });
});

app.post("/api/interests", requireEmployee, async (req, res) => {
  const ticketCount = Number(req.body.ticketCount);
  const matchIds = Array.isArray(req.body.matchIds) ? req.body.matchIds : [];

  if (![1, 2].includes(ticketCount)) return res.status(400).json({ error: "INVALID_TICKET_COUNT" });
  if (matchIds.length < 1) return res.status(400).json({ error: "NO_MATCH_SELECTED" });

  // Re-validate against master employee list (employees.csv) before accepting submission.
  const employees = await readCsv(EMPLOYEES_CSV);
  const isValidEmployee = employees.some((e) => String(e.employeeId || "").trim().toUpperCase() === req.employeeId.toUpperCase());
  if (!isValidEmployee) return res.status(401).json({ error: "INVALID_EMPLOYEE_ID" });

  const validMatchIds = new Set(MATCHES.map((m) => m.matchId));
  const normalized = [];
  for (const mid of matchIds) {
    const id = String(mid).trim();
    if (!validMatchIds.has(id)) return res.status(400).json({ error: "INVALID_MATCH_ID" });
    normalized.push(id);
  }

  // Dedup: keep only one row per (employeeId, matchId).
  const existing = await readCsv(INTERESTS_CSV);
  const alreadySubmitted = existing.some((r) => String(r.employeeId || "").trim().toUpperCase() === req.employeeId.toUpperCase());
  if (alreadySubmitted) return res.status(409).json({ error: "ALREADY_SUBMITTED" });

  const now = new Date().toISOString();

  const keep = existing.filter((r) => String(r.employeeId || "").trim().toUpperCase() !== req.employeeId.toUpperCase());
  const newRows = normalized.map((matchId) => ({
    employeeId: req.employeeId,
    ticketCount: String(ticketCount),
    matchId,
    submittedAt: now,
  }));

  await rewriteCsv(INTERESTS_CSV, ["employeeId", "ticketCount", "matchId", "submittedAt"], [...keep, ...newRows]);
  res.json({ ok: true });
});

// --- Admin auth ---
app.post("/api/admin/login", async (req, res) => {
  const username = String(req.body.username || "").trim();
  const password = String(req.body.password || "").trim();
  if (!username || !password) return res.status(400).json({ error: "USERNAME_PASSWORD_REQUIRED" });

  const admins = await readCsv(ADMINS_CSV);
  const ok = admins.some(
    (a) => String(a.username || "").trim() === username && String(a.password || "").trim() === password,
  );
  if (!ok) return res.status(401).json({ error: "INVALID_ADMIN_CREDENTIALS" });

  const token = newToken();
  adminSessions.set(token, username);
  setCookie(res, "admin_session", token, { httpOnly: true, path: "/" });
  res.json({ ok: true, username });
});

app.get("/api/admin/matches", requireAdmin, async (req, res) => {
  const interests = await readCsv(INTERESTS_CSV);
  const winnerIds = await getAllWinnerEmployeeIds();

  const out = [];
  for (const m of MATCHES) {
    const interested = interests.filter((r) => String(r.matchId || "").trim() === m.matchId);
    const eligible = interested.filter((r) => !winnerIds.has(String(r.employeeId || "").trim()));
    const winnersPath = winnersPathForMatch(m.matchId);
    const winnersGenerated = await fileExists(winnersPath);
    out.push({
      ...m,
      interestedCount: interested.length,
      eligibleCount: eligible.length,
      winnersGenerated,
    });
  }
  res.json({ matches: out });
});

app.get("/api/admin/matches/:matchId/eligible", requireAdmin, async (req, res) => {
  const matchId = String(req.params.matchId || "").trim();
  const m = matchById(matchId);
  if (!m) return res.status(404).json({ error: "MATCH_NOT_FOUND" });

  const interests = await readCsv(INTERESTS_CSV);
  const winnerIds = await getAllWinnerEmployeeIds();
  const eligible = interests
    .filter((r) => String(r.matchId || "").trim() === matchId)
    .map((r) => ({
      employeeId: String(r.employeeId || "").trim(),
      ticketCount: Number(r.ticketCount),
      submittedAt: r.submittedAt,
    }))
    .filter((r) => r.employeeId && (r.ticketCount === 1 || r.ticketCount === 2))
    .filter((r) => !winnerIds.has(r.employeeId.toUpperCase()));

  res.json({ match: m, eligible });
});

function shuffleInPlace(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = crypto.randomInt(0, i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

app.post("/api/admin/matches/:matchId/draw", requireAdmin, async (req, res) => {
  const matchId = String(req.params.matchId || "").trim();
  const m = matchById(matchId);
  if (!m) return res.status(404).json({ error: "MATCH_NOT_FOUND" });

  const capacityTickets = Number(req.body.capacityTickets);
  if (!Number.isFinite(capacityTickets) || capacityTickets <= 0) {
    return res.status(400).json({ error: "INVALID_CAPACITY" });
  }

  const winnersPath = winnersPathForMatch(matchId);
  if (await fileExists(winnersPath)) {
    // Keep it simple: no redraw by default
    const existing = await readCsv(winnersPath);
    if (existing.length > 0) return res.status(400).json({ error: "WINNERS_ALREADY_GENERATED" });
  }

  const interests = await readCsv(INTERESTS_CSV);
  const winnerIds = await getAllWinnerEmployeeIds();

  const eligible = interests
    .filter((r) => String(r.matchId || "").trim() === matchId)
    .map((r) => ({
      employeeId: String(r.employeeId || "").trim(),
      ticketCount: Number(r.ticketCount),
    }))
    .filter((r) => r.employeeId && (r.ticketCount === 1 || r.ticketCount === 2))
    .filter((r) => !winnerIds.has(r.employeeId.toUpperCase()));

  shuffleInPlace(eligible);

  const winners = [];
  let remaining = capacityTickets;
  
  for (const e of eligible) {
    if (remaining <= 0) break;
    const allocated = Math.min(e.ticketCount, remaining);
    if (allocated <= 0) continue;
    winners.push({ employeeId: e.employeeId, ticketCount: allocated });
    remaining -= allocated;
    if (remaining === 0) break;
  }

  await ensureDir(WINNERS_DIR);
  const pickedAt = new Date().toISOString();

  const rows = winners.map((w) => ({
    matchId,
    employeeId: w.employeeId,
    ticketCount: String(w.ticketCount),
    pickedAt,
  }));

  await rewriteCsv(winnersPath, ["matchId", "employeeId", "ticketCount", "pickedAt"], rows);

  res.json({ ok: true, match: m, capacityTickets, winners, remainingTickets: remaining });
});

app.get("/api/admin/matches/:matchId/winners", requireAdmin, async (req, res) => {
  const matchId = String(req.params.matchId || "").trim();
  const m = matchById(matchId);
  if (!m) return res.status(404).json({ error: "MATCH_NOT_FOUND" });

  const winnersPath = winnersPathForMatch(matchId);
  if (!(await fileExists(winnersPath))) return res.status(404).json({ error: "WINNERS_NOT_FOUND" });

  const rows = await readCsv(winnersPath);
  const winners = rows
    .map((r) => ({
      employeeId: String(r.employeeId || "").trim(),
      ticketCount: Number(r.ticketCount),
      pickedAt: r.pickedAt || "",
    }))
    .filter((w) => w.employeeId && (w.ticketCount === 1 || w.ticketCount === 2));

  res.json({ match: m, winners });
});

app.get("/api/admin/matches/:matchId/winners/download", requireAdmin, async (req, res) => {
  const matchId = String(req.params.matchId || "").trim();
  const m = matchById(matchId);
  if (!m) return res.status(404).json({ error: "MATCH_NOT_FOUND" });

  const winnersPath = winnersPathForMatch(matchId);
  if (!(await fileExists(winnersPath))) return res.status(404).json({ error: "WINNERS_NOT_FOUND" });

  const csvText = await require("./src/csv/csv").readFileText(winnersPath);
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename=\"winners_${sanitizeMatchId(matchId)}.csv\"`);
  res.send(csvText);
});

// Admin endpoint to list all CSV files
app.get("/api/admin/files", requireAdmin, async (req, res) => {
  try {
    const files = [];
    
    // List main data files
    const mainFiles = ["employees.csv", "admins.csv", "interests.csv"];
    for (const file of mainFiles) {
      const filepath = path.join(DATA_DIR, file);
      if (await fileExists(filepath)) {
        const stats = await require("fs").promises.stat(filepath);
        files.push({
          name: file,
          path: file,
          size: stats.size,
          modified: stats.mtime,
        });
      }
    }
    
    // List winner files
    const winnerFiles = await listFiles(WINNERS_DIR);
    for (const file of winnerFiles) {
      if (file.endsWith(".csv")) {
        const filepath = path.join(WINNERS_DIR, file);
        const stats = await require("fs").promises.stat(filepath);
        files.push({
          name: file,
          path: `winners/${file}`,
          size: stats.size,
          modified: stats.mtime,
        });
      }
    }
    
    res.json({ files });
  } catch (err) {
    res.status(500).json({ error: "Failed to list files" });
  }
});

// Admin endpoint to download any CSV file
app.get("/api/admin/files/download/:path(*)", requireAdmin, async (req, res) => {
  try {
    const filePath = String(req.params.path || "").trim();
    const fullPath = path.join(DATA_DIR, filePath);
    
    // Security: ensure path is within DATA_DIR
    if (!fullPath.startsWith(DATA_DIR)) {
      return res.status(403).json({ error: "Access denied" });
    }
    
    if (!(await fileExists(fullPath))) {
      return res.status(404).json({ error: "File not found" });
    }
    
    const csvText = await require("./src/csv/csv").readFileText(fullPath);
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${path.basename(filePath)}"`);
    res.send(csvText);
  } catch (err) {
    res.status(500).json({ error: "Failed to download file" });
  }
});

// Admin endpoint to upload/replace CSV file
app.post("/api/admin/files/upload/:path(*)", requireAdmin, async (req, res) => {
  try {
    const filePath = String(req.params.path || "").trim();
    const fullPath = path.join(DATA_DIR, filePath);
    
    // Security: ensure path is within DATA_DIR and is a CSV file
    if (!fullPath.startsWith(DATA_DIR) || !filePath.endsWith(".csv")) {
      return res.status(403).json({ error: "Access denied" });
    }
    
    // Get CSV content from request body
    const csvContent = req.body.content;
    if (!csvContent || typeof csvContent !== "string") {
      return res.status(400).json({ error: "Invalid CSV content" });
    }
    
    // Ensure directory exists
    await ensureDir(path.dirname(fullPath));
    
    // Write the file
    await require("fs").promises.writeFile(fullPath, csvContent, "utf8");
    
    console.log(`✅ CSV file uploaded: ${filePath}`);
    res.json({ ok: true, message: "File uploaded successfully" });
  } catch (err) {
    console.error("Upload error:", err);
    res.status(500).json({ error: "Failed to upload file" });
  }
});

// Admin endpoint to delete CSV file
app.delete("/api/admin/files/delete/:path(*)", requireAdmin, async (req, res) => {
  try {
    const filePath = String(req.params.path || "").trim();
    const fullPath = path.join(DATA_DIR, filePath);
    
    // Security: ensure path is within DATA_DIR and is a CSV file
    if (!fullPath.startsWith(DATA_DIR) || !filePath.endsWith(".csv")) {
      return res.status(403).json({ error: "Access denied" });
    }
    
    // Prevent deletion of core files
    const protectedFiles = ["employees.csv", "admins.csv", "interests.csv"];
    if (protectedFiles.includes(filePath)) {
      return res.status(403).json({ error: "Cannot delete core system files" });
    }
    
    if (!(await fileExists(fullPath))) {
      return res.status(404).json({ error: "File not found" });
    }
    
    // Delete the file
    await require("fs").promises.unlink(fullPath);
    
    console.log(`✅ CSV file deleted: ${filePath}`);
    res.json({ ok: true, message: "File deleted successfully" });
  } catch (err) {
    console.error("Delete error:", err);
    res.status(500).json({ error: "Failed to delete file" });
  }
});

app.post("/api/logout", (req, res) => {
  const cookies = parseCookies(req.headers.cookie);
  if (cookies.emp_session) employeeSessions.delete(cookies.emp_session);
  if (cookies.admin_session) adminSessions.delete(cookies.admin_session);
  setCookie(res, "emp_session", "", { httpOnly: true, path: "/", maxAgeSeconds: 0 });
  setCookie(res, "admin_session", "", { httpOnly: true, path: "/", maxAgeSeconds: 0 });
  res.json({ ok: true });
});

const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;

ensureDataFiles()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
      console.log(`Employee: http://localhost:${PORT}/employee/login.html`);
      console.log(`Admin:    http://localhost:${PORT}/admin/login.html`);
      // Log Railway volume info if available
      if (process.env.RAILWAY_VOLUME_MOUNT_PATH) {
        console.log(`✅ Railway Volume mounted at: ${process.env.RAILWAY_VOLUME_MOUNT_PATH}`);
        console.log(`✅ Volume name: ${process.env.RAILWAY_VOLUME_NAME}`);
      }
      console.log(`📁 Data directory: ${DATA_DIR}`);
    });
  })
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error("Startup failed:", err);
    process.exit(1);
  });

