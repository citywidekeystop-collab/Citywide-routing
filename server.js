const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");

const app = express();
app.use(cors());
app.use(bodyParser.json());

// ✅ ROOT PAGE (fixes "Cannot GET /")
app.get("/", (req, res) => {
  res.send("Citywide Leads API is running");
});

// ✅ HEALTH CHECK
app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

// ✅ LEAD ENDPOINT (Wix will send leads here)
app.post("/lead", (req, res) => {
  console.log("New lead received:", req.body);
  res.json({ success: true });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("Server running on port", PORT);
});
Add root route and lead endpoint
