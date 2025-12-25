import express from "express";
import path from "path";
import { fileURLToPath } from "url";

const app = express();
const PORT = process.env.PORT || 10000;

// Fix __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ✅ SERVE PUBLIC FOLDER
app.use(express.static(path.join(__dirname, "public")));

// ✅ ROOT → dashboard.html
app.get("/", (req, res) => {
res.sendFile(path.join(__dirname, "public", "dashboard.html"));
});

// Health check (Render)
app.get("/health", (req, res) => {
res.json({ ok: true, service: "citywide-routing" });
});

// Catch-all (prevents showing code text)
app.use((req, res) => {
res.status(404).send("Not Found");
});

app.listen(PORT, () => {
console.log(`✅ Server running on port ${PORT}`);
});
