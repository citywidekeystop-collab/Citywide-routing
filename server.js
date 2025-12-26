import express from "express";

const app = express();
const PORT = process.env.PORT || 10000;

// ===== CONFIG =====
const ADMIN_TOKEN = "belpre334";

// ===== MIDDLEWARE =====
app.use(express.json());

// ===== HEALTH CHECK =====
app.get("/", (req, res) => {
res.send("Citywide Routing Server is running ✅");
});

// ===== LEAD ENDPOINT =====
app.post("/lead/new", (req, res) => {
const token =
req.query.token ||
req.body.token ||
req.headers["x-admin-token"];

console.log("🔐 Incoming token:", token);
console.log("📦 Body:", JSON.stringify(req.body, null, 2));

if (token !== ADMIN_TOKEN) {
console.log("❌ Unauthorized: token missing or invalid");
return res.status(401).json({ error: "Unauthorized" });
}

console.log("✅ AUTHORIZED LEAD RECEIVED");
console.log("📨 FULL PAYLOAD:", JSON.stringify(req.body, null, 2));

// TODO: route lead, store, notify, etc.

res.json({
success: true,
message: "Lead received successfully",
});
});

// ===== START SERVER =====
app.listen(PORT, () => {
console.log(`🚀 Server running on port ${PORT}`);
});
