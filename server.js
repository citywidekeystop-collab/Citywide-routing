import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import twilio from "twilio";
import pg from "pg";
const { Pool } = pg;
const app = express();

// Middleware
app.use(cors());
app.use(bodyParser.json());

// ENV
const DATABASE_URL = process.env.DATABASE_URL; // must exist in Render Env Vars

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false } // important for hosted Postgres
});
const {
  TWILIO_ACCOUNT_SID,
  TWILIO_AUTH_TOKEN,
  TWILIO_FROM_NUMBER,
  PORT = 10000
} = process.env;

const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
// ==============================
// STEP A — DATABASE SETUP
// ==============================
async function initDb() {
  const sql = `
    CREATE TABLE IF NOT EXISTS leads (
      id SERIAL PRIMARY KEY,
      created_at TIMESTAMP DEFAULT NOW(),
      phone TEXT,
      raw JSONB
    );
  `;
  await pool.query(sql);
  console.log("Database ready: leads table exists");
}

async function initDb() {
  // 1) Leads table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS leads (
      id SERIAL PRIMARY KEY,
      created_at TIMESTAMP DEFAULT NOW(),
      first_name TEXT,
      last_name  TEXT,
      email      TEXT,
      phone      TEXT,
      service    TEXT,
      details    TEXT,
      zip        TEXT,
      status     TEXT DEFAULT 'new',
      assigned_provider_id INT,
      raw JSONB
    );
  `);

  // 2) Providers table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS providers (
      id SERIAL PRIMARY KEY,
      created_at TIMESTAMP DEFAULT NOW(),
      name TEXT NOT NULL,
      phone TEXT NOT NULL,
      active BOOLEAN DEFAULT TRUE
    );
  `);

  // 3) Add columns safely (if you previously created a smaller leads table)
  await pool.query(`ALTER TABLE leads ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'new';`);
  await pool.query(`ALTER TABLE leads ADD COLUMN IF NOT EXISTS assigned_provider_id INT;`);
  await pool.query(`ALTER TABLE leads ADD COLUMN IF NOT EXISTS zip TEXT;`);
  await pool.query(`ALTER TABLE leads ADD COLUMN IF NOT EXISTS service TEXT;`);
  await pool.query(`ALTER TABLE leads ADD COLUMN IF NOT EXISTS details TEXT;`);
  await pool.query(`ALTER TABLE leads ADD COLUMN IF NOT EXISTS email TEXT;`);
  await pool.query(`ALTER TABLE leads ADD COLUMN IF NOT EXISTS first_name TEXT;`);
  await pool.query(`ALTER TABLE leads ADD COLUMN IF NOT EXISTS last_name TEXT;`);

  console.log("✅ DB ready: leads/providers tables ready");
}

// Health check
app.get("/", (req, res) => {
  res.send("Citywide routing server running");
});

// Lead endpoint
app.post("/lead/new", async (req, res) => {
  try {
    console.log("📥 Lead received:", req.body);

    const phone =
      req.body.phone ||
      req.body.Phone ||
      req.body?.fields?.Phone ||
      "UNKNOWN";

    const message = `🚨 New Lead Received\nPhone: ${phone}`;

    await client.messages.create({
      from: TWILIO_FROM_NUMBER,
      to: "+14108166818", // YOUR test number
      body: message
    });

    console.log("✅ SMS sent");
    res.status(200).json({ ok: true });
  } catch (err) {
    console.error("❌ Error:", err);
    res.status(500).json({ ok: false, error: err.message });
  }
});
// ============================
// ADMIN API ENDPOINTS
// ============================

// Get providers
app.get("/admin", requireAdmin, async (req, res) => {
  const key = req.query.key;
  res.send(`
  <html>
    <head>
      <meta name="viewport" content="width=device-width,initial-scale=1"/>
      <title>Citywide Admin</title>
      <style>
        body{font-family:Arial;margin:0;background:#0b1220;color:#e8eefc}
        .top{display:flex;gap:12px;align-items:center;justify-content:space-between;padding:14px 16px;background:#0f1b33;position:sticky;top:0}
        .brand{font-weight:800}
        .box{background:#0f1b33;border:1px solid #223055;border-radius:12px;padding:12px}
        .grid{display:grid;grid-template-columns: 1.2fr .8fr;gap:12px;padding:12px}
        @media(max-width:980px){.grid{grid-template-columns:1fr}}
        table{width:100%;border-collapse:collapse}
        th,td{border-bottom:1px solid #223055;padding:10px;font-size:13px;vertical-align:top}
        th{color:#9fb3e8;text-align:left}
        select,input,button{background:#0b1220;color:#e8eefc;border:1px solid #223055;border-radius:10px;padding:8px}
        button{cursor:pointer}
        .pill{padding:4px 10px;border-radius:999px;font-size:12px;display:inline-block}
        .new{background:#0b3d2e}
        .sent{background:#2b3b10}
        .closed{background:#3a1520}
        .spam{background:#2b2b2b}
        .rowActions{display:flex;gap:8px;flex-wrap:wrap}
        .muted{color:#9fb3e8}
        .map{height:360px;border-radius:12px;overflow:hidden;background:#0b1220;border:1px solid #223055}
        .small{font-size:12px}
      </style>
    </head>
    <body>
      <div class="top">
        <div>
          <div class="brand">Citywide Routing Dashboard</div>
          <div class="muted small">Live Lead Intake • Admin Console</div>
        </div>
        <div style="display:flex;gap:10px;align-items:center">
          <input id="search" placeholder="Search phone / zip / service" />
          <button onclick="refresh()">Refresh</button>
        </div>
      </div>

      <div class="grid">
        <div class="box">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
            <div style="font-weight:700">Leads (latest 300)</div>
            <div class="muted small" id="counts"></div>
          </div>
          <div style="overflow:auto;max-height:520px">
            <table>
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Phone</th>
                  <th>Service</th>
                  <th>ZIP</th>
                  <th>Status</th>
                  <th>Assigned</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody id="tbody"></tbody>
            </table>
          </div>
        </div>

        <div class="box">
          <div style="font-weight:700;margin-bottom:8px">Map View (Phase 1)</div>
          <div class="muted small" style="margin-bottom:10px">
            Map will pin leads once we add ZIP→lat/lng lookup or collect address fields.
          </div>
          <div class="map" id="mapBox" style="display:flex;align-items:center;justify-content:center">
            <div class="muted">Map placeholder (next upgrade)</div>
          </div>

          <hr style="border:0;border-top:1px solid #223055;margin:14px 0"/>

          <div style="font-weight:700;margin-bottom:8px">Quick Add Provider</div>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            <input id="pName" placeholder="Provider name" />
            <input id="pPhone" placeholder="Provider phone +1..." />
            <button onclick="addProvider()">Add</button>
          </div>
          <div class="muted small" style="margin-top:8px">Providers appear in the “Assigned” dropdowns.</div>
        </div>
      </div>

      <script>
        const KEY = ${JSON.stringify(key)};

        let providers = [];
        let leads = [];

        function pillClass(status){
          return status === 'new' ? 'new' :
                 status === 'sent' ? 'sent' :
                 status === 'closed' ? 'closed' : 'spam';
        }

        function fmtTime(ts){
          try { return new Date(ts).toLocaleString(); } catch(e){ return ts; }
        }

        async function api(path, opts){
          const res = await fetch(path + (path.includes('?') ? '&' : '?') + 'key=' + encodeURIComponent(KEY), opts);
          return res.json();
        }

        async function loadProviders(){
          const r = await api('/admin/api/providers');
          if(!r.ok){ alert(r.error||'Failed providers'); return; }
          providers = r.providers || [];
        }

        async function loadLeads(){
          const r = await api('/admin/api/leads');
          if(!r.ok){ alert(r.error||'Failed leads'); return; }
          leads = r.leads || [];
        }

        function providerOptions(selectedId){
          const opts = ['<option value="">Unassigned</option>'];
          for(const p of providers){
            const sel = String(p.id) === String(selectedId) ? 'selected' : '';
            opts.push(\`<option value="\${p.id}" \${sel}>\${p.name} (\${p.phone})</option>\`);
          }
          return opts.join('');
        }

        async function setStatus(id, status){
          await api('/admin/api/leads/' + id + '/status', {
            method:'POST',
            headers:{'Content-Type':'application/json'},
            body: JSON.stringify({ status })
          });
          await refresh();
        }

        async function assignProvider(id, providerId){
          const payload = { providerId: providerId ? Number(providerId) : null };
          await api('/admin/api/leads/' + id + '/assign', {
            method:'POST',
            headers:{'Content-Type':'application/json'},
            body: JSON.stringify(payload)
          });
          await refresh();
        }

        async function sendSms(to, body){
          const r = await api('/admin/api/sms', {
            method:'POST',
            headers:{'Content-Type':'application/json'},
            body: JSON.stringify({ to, body })
          });
          if(!r.ok) alert(r.error||'SMS failed');
          else alert('SMS sent');
        }

        async function addProvider(){
          const name = document.getElementById('pName').value.trim();
          const phone = document.getElementById('pPhone').value.trim();
          if(!name || !phone) return alert('Enter provider name and phone');
          const r = await api('/admin/api/providers', {
            method:'POST',
            headers:{'Content-Type':'application/json'},
            body: JSON.stringify({ name, phone, active:true })
          });
          if(!r.ok) return alert(r.error||'Add provider failed');
          document.getElementById('pName').value = '';
          document.getElementById('pPhone').value = '';
          await refresh();
        }

        function render(){
          const q = (document.getElementById('search').value || '').toLowerCase().trim();
          const filtered = leads.filter(l => {
            if(!q) return true;
            return String(l.phone||'').toLowerCase().includes(q) ||
                   String(l.zip||'').toLowerCase().includes(q) ||
                   String(l.service||'').toLowerCase().includes(q);
          });

          const counts = {
            new: filtered.filter(l=>l.status==='new').length,
            sent: filtered.filter(l=>l.status==='sent').length,
            closed: filtered.filter(l=>l.status==='closed').length,
            spam: filtered.filter(l=>l.status==='spam').length,
          };
          document.getElementById('counts').innerText =
            \`New: \${counts.new} • Sent: \${counts.sent} • Closed: \${counts.closed} • Spam: \${counts.spam}\`;

          const tbody = document.getElementById('tbody');
          tbody.innerHTML = filtered.map(l => {
            const status = l.status || 'new';
            const providerLabel = l.provider_name ? (l.provider_name + ' (' + (l.provider_phone||'') + ')') : 'Unassigned';

            return \`
              <tr>
                <td>\${fmtTime(l.created_at)}</td>
                <td>\${l.phone||''}<div class="muted small">\${l.email||''}</div></td>
                <td>\${l.service||''}</td>
                <td>\${l.zip||''}</td>
                <td>
                  <span class="pill \${pillClass(status)}">\${status.toUpperCase()}</span><br/>
                  <select onchange="setStatus(\${l.id}, this.value)">
                    <option value="new" \${status==='new'?'selected':''}>New</option>
                    <option value="sent" \${status==='sent'?'selected':''}>Sent</option>
                    <option value="closed" \${status==='closed'?'selected':''}>Closed</option>
                    <option value="spam" \${status==='spam'?'selected':''}>Spam</option>
                  </select>
                </td>
                <td>
                  <div class="muted small">\${providerLabel}</div>
                  <select onchange="assignProvider(\${l.id}, this.value)">
                    \${providerOptions(l.assigned_provider_id)}
                  </select>
                </td>
                <td>
                  <div class="rowActions">
                    <a href="tel:\${(l.phone||'').replace(/[^0-9+]/g,'')}" style="text-decoration:none">
                      <button>Call Lead</button>
                    </a>
                    <button onclick="sendSms(l.phone, 'Citywide Leads: We received your request. Reply YES to confirm.')">Text Lead</button>
                    \${l.provider_phone ? \`
                      <a href="tel:\${(l.provider_phone||'').replace(/[^0-9+]/g,'')}" style="text-decoration:none">
                        <button>Call Provider</button>
                      </a>
                      <button onclick="sendSms(l.provider_phone, 'New lead assigned. Check dashboard now.')">Text Provider</button>
                    \` : \`\`}
                  </div>
                </td>
              </tr>
            \`;
          }).join('') || "<tr><td colspan='7'>No leads found</td></tr>";
        }

        async function refresh(){
          await loadProviders();
          await loadLeads();
          render();
        }

        document.getElementById('search').addEventListener('input', render);

        refresh();
      </script>
    </body>
  </html>
  `);
});
  try {
    const r = await pool.query(
      "SELECT id, name, phone, active FROM providers ORDER BY active DESC, name ASC"
    );
    res.json({ ok: true, providers: r.rows });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// Add provider
app.post("/admin/api/providers", requireAdmin, async (req, res) => {
  try {
    const { name, phone, active = true } = req.body;
    if (!name || !phone) return res.status(400).json({ ok: false, error: "name and phone required" });

    const r = await pool.query(
      "INSERT INTO providers (name, phone, active) VALUES ($1,$2,$3) RETURNING *",
      [name, phone, active]
    );
    res.json({ ok: true, provider: r.rows[0] });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// Get leads
app.get("/admin/api/leads", requireAdmin, async (req, res) => {
  try {
    const r = await pool.query(`
      SELECT l.id, l.created_at, l.phone, l.email, l.service, l.zip, l.status,
             l.assigned_provider_id
      FROM leads l
      ORDER BY l.created_at DESC
      LIMIT 300
    `);
    res.json({ ok: true, leads: r.rows });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// Update lead status
app.post("/admin/api/leads/:id/status", requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { status } = req.body;
    const allowed = ["new", "sent", "closed", "spam"];
    if (!allowed.includes(status)) return res.status(400).json({ ok: false, error: "bad status" });

    await pool.query("UPDATE leads SET status=$1 WHERE id=$2", [status, id]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// Assign provider
app.post("/admin/api/leads/:id/assign", requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { providerId } = req.body; // number or null

    await pool.query("UPDATE leads SET assigned_provider_id=$1 WHERE id=$2", [
      providerId || null,
      id
    ]);

    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// Send SMS (admin)
app.post("/admin/api/sms", requireAdmin, async (req, res) => {
  try {
    const { to, body } = req.body;
    if (!to || !body) return res.status(400).json({ ok: false, error: "to and body required" });

    await client.messages.create({
      from: process.env.TWILIO_FROM_NUMBER,
      to,
      body
    });

    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});
// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
