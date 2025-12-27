// ============================
// CITYWIDE ROUTING - SERVER.JS
// ============================

// ---------- Imports ----------
const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bodyParser = require('body-parser');
const path = require('path');

// ---------- App Setup ----------
const app = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// ---------- Database ----------
const db = new sqlite3.Database('./database.db', (err) => {
if (err) {
console.error('DB connection error:', err);
} else {
console.log('DB ready');
}
});

// ---------- Create Tables ----------
db.serialize(() => {
db.run(`
CREATE TABLE IF NOT EXISTS leads (
id INTEGER PRIMARY KEY AUTOINCREMENT,
name TEXT,
phone TEXT,
service TEXT,
city TEXT,
created_at DATETIME DEFAULT CURRENT_TIMESTAMP
)
`);
});

// ---------- Health Check ----------
app.get('/', (req, res) => {
res.send('Citywide Routing Server Running');
});

// ---------- Lead Intake ----------
app.post('/api/lead', (req, res) => {
const { name, phone, service, city } = req.body;

if (!phone || !service) {
return res.status(400).json({ error: 'Missing required fields' });
}

db.run(
`INSERT INTO leads (name, phone, service, city)
VALUES (?, ?, ?, ?)`,
[name || '', phone, service, city || ''],
function (err) {
if (err) {
console.error(err);
return res.status(500).json({ error: 'DB insert failed' });
}
res.json({ success: true, lead_id: this.lastID });
}
);
});

// ---------- Dashboard API ----------
app.get('/api/leads', (req, res) => {
db.all(
`SELECT * FROM leads ORDER BY created_at DESC`,
[],
(err, rows) => {
if (err) {
console.error(err);
return res.status(500).json({ error: 'DB error' });
}
res.json(rows);
}
);
});

// ---------- Dashboard Page ----------
app.get('/dashboard', (req, res) => {
res.send(`
<!DOCTYPE html>
<html>
<head>
<title>Citywide Dashboard</title>
<style>
body { font-family: Arial; background:#0f172a; color:white; padding:20px }
table { width:100%; border-collapse: collapse }
th, td { padding:10px; border-bottom:1px solid #334155 }
th { background:#1e293b }
</style>
</head>
<body>
<h2>📊 Citywide Leads</h2>
<table>
<thead>
<tr>
<th>Name</th><th>Phone</th><th>Service</th><th>City</th><th>Time</th>
</tr>
</thead>
<tbody id="rows"></tbody>
</table>

<script>
fetch('/api/leads')
.then(r => r.json())
.then(data => {
const rows = document.getElementById('rows');
data.forEach(l => {
rows.innerHTML += \`
<tr>
<td>\${l.name}</td>
<td>\${l.phone}</td>
<td>\${l.service}</td>
<td>\${l.city}</td>
<td>\${l.created_at}</td>
</tr>\`;
});
});
</script>
</body>
</html>
`);
});

// ---------- Start Server ----------
app.listen(PORT, () => {
console.log('Server running on port', PORT);
});
