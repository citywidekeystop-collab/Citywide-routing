// ================================
// Citywide Routing – Server
// ================================

import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import path from "path";
import { fileURLToPath } from "url";

// ================================
// Setup
// ================================
const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ================================
// Middleware
// ================================
app.use(cors());
app.use(bodyParser.json({ limit: "2mb" }));

// ================================
// ENV
// ================================
const {
  ADMIN_TOKEN,
  PORT = 10000
} = process.env;

// ================================
// ✅ SERVE STATIC FILES (CRITICAL FIX)
// ================================
app.use(express.static(path.join(__dirname, "public")));

// Friendly routes
app.get("/", (req, res) => res.redirect("/dashboard.html"));
app.get("/dashboard", (req, res) => res.redirect("/dashboard.html"));

// ================================
// AUTH MIDDLEWARE
// ================================
function requireAdmin(req, res, next) {
  const token =
    req.query.token ||
    req.headers["x-admin-token"] ||
    req.body?.token;

  if (!token || token !== ADMIN_TOKEN) {
    return res.status(401).json({ ok: false, error: "Unauthorized" });
  }
  next();
}

// ================================
// API ROUTES
// ================================
app.get("/api/health", (req, res) => {
  res.json({ ok: true, status: "live" });
});

// Example protected route
app.post("/api/admin/test", requireAdmin, (req, res) => {
  res.json({ ok: true, message: "Admin access confirmed" });
});

// ================================
// FALLBACK (optional)
// ================================
app.use((req, res) => {
  res.status(404).send("Not Found");
});

// ================================
// START SERVER
// ================================
app.listen(PORT, () => {
  console.log(`✅ Citywide Routing running on port ${PORT}`);
});
