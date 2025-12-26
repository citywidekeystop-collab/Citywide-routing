import express from "express";

const app = express();
const PORT = process.env.PORT || 10000;

const ADMIN_TOKEN = "belpre334";

app.use(express.json());

app.get("/", (req, res) => {
res.send("Citywide Routing Server is running ✅");
});

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
res.json({ success: true });
});

app.listen(PORT, () => {
console.log(`🚀 Server running on port ${PORT}`);
});
