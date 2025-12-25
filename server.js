const express = require("express");
const cors = require("cors");

const app = express();

app.use(cors());
app.use(express.json());

/* ---------- PUBLIC ROUTES ---------- */
app.get("/", (req, res) => {
res.send("✅ Server is running correctly on Render");
});

app.get("/health", (req, res) => {
res.json({ ok: true, status: "healthy" });
});

/* ---------- API ROUTE EXAMPLE ---------- */
app.post("/api/test", (req, res) => {
res.json({
ok: true,
message: "API working",
body: req.body,
});
});

/* ---------- START SERVER ---------- */
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
console.log(`🚀 Server listening on port ${PORT}`);
});
