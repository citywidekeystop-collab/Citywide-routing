app.get("/admin", requireAdmin, async (req, res) => {
  const key = req.query.key;

  res.send(`
  <!doctype html>
  <html>
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>Citywide Leads — Marketplace Dashboard</title>
      <style>
        :root{
          --bg:#0b1220;
          --panel:#0f1b33;
          --panel2:#0b162c;
          --line:#223055;
          --txt:#e8eefc;
          --mut:#9fb3e8;
          --good:#23c55e;
          --warn:#f59e0b;
          --bad:#ef4444;
          --pill:#1f2b4d;
          --btn:#1a2a52;
        }
        *{box-sizing:border-box}
        body{
          margin:0;
          font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial;
          color:var(--txt);
          background:
            radial-gradient(900px 600px at 10% 10%, rgba(0,140,255,.20), transparent 55%),
            radial-gradient(800px 520px at 90% 20%, rgba(0,255,200,.14), transparent 60%),
            radial-gradient(700px 500px at 50% 90%, rgba(255,0,150,.10), transparent 60%),
            linear-gradient(180deg, #050914 0%, var(--bg) 60%, #050914 100%);
        }
        a{color:inherit}
        .app{display:grid; grid-template-columns: 270px 1fr; min-height:100vh}
        .side{
          background:rgba(15,27,51,.92);
          border-right:1px solid var(--line);
          padding:14px;
          position:sticky; top:0; height:100vh;
        }
        .brand{font-weight:900; font-size:16px; letter-spacing:.3px}
        .sub{color:var(--mut); font-size:12px; margin-top:4px}
        .nav{margin-top:16px; display:flex; flex-direction:column; gap:8px}
        .nav button{
          width:100%; text-align:left; padding:10px 12px; border-radius:12px;
          border:1px solid var(--line); background:rgba(11,18,32,.7); color:var(--txt);
          cursor:pointer;
        }
        .nav button.active{background:rgba(26,42,82,.9)}
        .main{padding:14px}
        .topbar{
          display:flex; gap:10px; align-items:center; justify-content:space-between;
          background:rgba(15,27,51,.85); border:1px solid var(--line);
          padding:12px; border-radius:16px;
        }
        .filters{display:flex; gap:8px; flex-wrap:wrap}
        select,input,button{
          background:rgba(11,18,32,.75); color:var(--txt);
          border:1px solid var(--line); border-radius:12px;
          padding:10px 10px; outline:none;
        }
        button{cursor:pointer}
        .btn{background:rgba(26,42,82,.9)}
        .layout{display:grid; grid-template-columns: 1.15fr .85fr; gap:12px; margin-top:12px}
        @media (max-width: 980px){ .app{grid-template-columns:1fr} .side{position:relative;height:auto} .layout{grid-template-columns:1fr} }
        .panel{
          background:rgba(15,27,51,.86); border:1px solid var(--line);
          border-radius:16px; padding:12px;
        }
        .kpis{display:grid; grid-template-columns: repeat(4, 1fr); gap:10px}
        @media (max-width: 980px){ .kpis{grid-template-columns:repeat(2,1fr)} }
        .kpi{
          background:rgba(11,18,32,.6); border:1px solid var(--line);
          border-radius:16px; padding:12px;
        }
        .kpi .label{color:var(--mut); font-size:12px}
        .kpi .val{font-size:22px; font-weight:900; margin-top:6px}
        .split{display:flex; gap:10px; align-items:center; justify-content:space-between}
        .tabs{display:flex; gap:8px}
        .tab{padding:8px 10px; border-radius:999px; border:1px solid var(--line); background:rgba(11,18,32,.6); cursor:pointer}
        .tab.active{background:rgba(26,42,82,.9)}
        table{width:100%; border-collapse:collapse}
        th,td{border-bottom:1px solid var(--line); padding:10px; font-size:13px; vertical-align:top}
        th{color:var(--mut); text-align:left; position:sticky; top:0; background:rgba(15,27,51,.95)}
        .scroll{max-height:540px; overflow:auto; border-radius:14px}
        .pill{display:inline-block; padding:4px 10px; border-radius:999px; font-size:12px; border:1px solid var(--line); background:rgba(31,43,77,.65)}
        .st-new{border-color: rgba(35,197,94,.35)}
        .st-sent{border-color: rgba(245,158,11,.35)}
        .st-closed{border-color: rgba(239,68,68,.35)}
        .st-spam{border-color: rgba(156,163,175,.35)}
        .card{
          border:1px solid var(--line); background:rgba(11,18,32,.6);
          border-radius:16px; padding:12px; margin-bottom:10px;
        }
        .card h4{margin:0 0 8px 0}
        .mut{color:var(--mut)}
        .actions{display:flex; gap:8px; flex-wrap:wrap; margin-top:10px}
        .map{
          height:360px; border-radius:16px; border:1px solid var(--line);
          background:rgba(11,18,32,.6);
          display:flex; align-items:center; justify-content:center; color:var(--mut);
        }
        .mini{font-size:12px}
        .two{display:grid; grid-template-columns:1fr 1fr; gap:10px}
      </style>
    </head>
    <body>
      <div class="app">
        <aside class="side">
          <div class="brand">Citywide Leads</div>
          <div class="sub">Marketplace Dashboard (Angi-style)</div>
          <div class="nav">
            <button class="active" onclick="view('leads')">Leads</button>
            <button onclick="view('providers')">Providers</button>
            <button onclick="view('billing')">Billing</button>
            <button onclick="view('settings')">Settings</button>
          </div>
          <div class="sub" style="margin-top:14px">
            Tip: bookmark this page with your key.
          </div>
        </aside>

        <main class="main">
          <div class="topbar">
            <div>
              <div style="font-weight:900">Leads Inbox</div>
              <div class="mut mini">Filter • Assign • Text/Call • Track status</div>
            </div>

            <div class="filters">
              <input id="q" placeholder="Search phone / zip / service" />
              <select id="status">
                <option value="">All Status</option>
                <option value="new">New</option>
                <option value="sent">Sent</option>
                <option value="closed">Closed</option>
                <option value="spam">Spam</option>
              </select>
              <select id="service">
                <option value="">All Services</option>
                <option value="lockout">Lockout</option>
                <option value="rekey">Rekey</option>
                <option value="car key">Car Key</option>
                <option value="commercial">Commercial</option>
              </select>
              <button class="btn" onclick="refresh()">Refresh</button>
            </div>
          </div>

          <div class="panel" style="margin-top:12px">
            <div class="kpis" id="kpis"></div>
          </div>

          <div class="layout">
            <section class="panel">
              <div class="split">
                <div style="font-weight:900">Lead Feed</div>
                <div class="tabs">
                  <div class="tab active" id="tabCards" onclick="setMode('cards')">Cards</div>
                  <div class="tab" id="tabTable" onclick="setMode('table')">Table</div>
                </div>
              </div>

              <div id="cardsWrap" style="margin-top:10px"></div>

              <div id="tableWrap" class="scroll" style="display:none; margin-top:10px">
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
            </section>

            <aside class="panel">
              <div class="split">
                <div style="font-weight:900">Dispatch Panel</div>
                <div class="mut mini" id="counts"></div>
              </div>

              <div style="margin-top:10px" class="two">
                <div class="card">
                  <div style="font-weight:800">Quick Add Provider</div>
                  <div class="mut mini" style="margin:6px 0 10px 0">Add a provider to assign leads.</div>
                  <input id="pName" placeholder="Provider name" style="width:100%; margin-bottom:8px" />
                  <input id="pPhone" placeholder="+1..." style="width:100%; margin-bottom:8px" />
                  <button class="btn" style="width:100%" onclick="addProvider()">Add Provider</button>
                </div>

                <div class="card">
                  <div style="font-weight:800">Quick SMS</div>
                  <div class="mut mini" style="margin:6px 0 10px 0">Send a message to any number.</div>
                  <input id="smsTo" placeholder="To: +1..." style="width:100%; margin-bottom:8px" />
                  <input id="smsBody" placeholder="Message..." style="width:100%; margin-bottom:8px" />
                  <button class="btn" style="width:100%" onclick="sendSmsManual()">Send SMS</button>
                </div>
              </div>

              <div style="margin-top:12px; font-weight:900">Map View</div>
              <div class="mut mini" style="margin:6px 0 10px 0">
                Pins turn on when we add ZIP→lat/lng or capture address in the form.
              </div>
              <div class="map" id="mapBox">Map placeholder (next)</div>
            </aside>
          </div>
        </main>
      </div>

      <script>
        const KEY = ${JSON.stringify(key)};
        let mode = "cards";
        let leads = [];
        let providers = [];

        function apiUrl(path){
          return path + (path.includes("?") ? "&" : "?") + "key=" + encodeURIComponent(KEY);
        }

        async function api(path, opts){
          const res = await fetch(apiUrl(path), opts);
          return res.json();
        }

        function sanitizePhone(p){
          return String(p||"").replace(/[^0-9+]/g,"");
        }

        function statusPill(s){
          const st = (s||"new").toLowerCase();
          const cls = st==="new"?"st-new":st==="sent"?"st-sent":st==="closed"?"st-closed":"st-spam";
          return '<span class="pill '+cls+'">'+st.toUpperCase()+'</span>';
        }

        function providerOptions(selectedId){
          const opts = ['<option value="">Unassigned</option>'];
          for(const p of providers){
            const sel = String(p.id)===String(selectedId) ? "selected" : "";
            opts.push('<option value="'+p.id+'" '+sel+'>'+p.name+' ('+p.phone+')</option>');
          }
          return opts.join("");
        }

        function computeKPIs(items){
          const k = {
            total: items.length,
            new: items.filter(x=>(x.status||"new")==="new").length,
            sent: items.filter(x=>x.status==="sent").length,
            closed: items.filter(x=>x.status==="closed").length,
            providers: providers.filter(p=>p.active).length
          };
          document.getElementById("kpis").innerHTML = `
            <div class="kpi"><div class="label">Leads (loaded)</div><div class="val">${k.total}</div></div>
            <div class="kpi"><div class="label">New</div><div class="val">${k.new}</div></div>
            <div class="kpi"><div class="label">Sent</div><div class="val">${k.sent}</div></div>
            <div class="kpi"><div class="label">Closed</div><div class="val">${k.closed}</div></div>
          `;
          document.getElementById("counts").innerText = "Providers: " + k.providers;
        }

        function applyFilters(){
          const q = (document.getElementById("q").value||"").toLowerCase().trim();
          const st = document.getElementById("status").value;
          const sv = document.getElementById("service").value.toLowerCase().trim();

          return leads.filter(l=>{
            const phone = String(l.phone||"").toLowerCase();
            const zip = String(l.zip||"").toLowerCase();
            const service = String(l.service||"").toLowerCase();
            const matchQ = !q || phone.includes(q) || zip.includes(q) || service.includes(q);
            const matchS = !st || (String(l.status||"new")===st);
            const matchV = !sv || service.includes(sv);
            return matchQ && matchS && matchV;
          });
        }

        async function setStatus(id, status){
          await api("/admin/api/leads/"+id+"/status", {
            method:"POST",
            headers:{ "Content-Type":"application/json" },
            body: JSON.stringify({ status })
          });
          await refresh();
        }

        async function assignProvider(id, providerId){
          await api("/admin/api/leads/"+id+"/assign", {
            method:"POST",
            headers:{ "Content-Type":"application/json" },
            body: JSON.stringify({ providerId: providerId ? Number(providerId) : null })
          });
          await refresh();
        }

        async function sendSms(to, body){
          const r = await api("/admin/api/sms", {
            method:"POST",
            headers:{ "Content-Type":"application/json" },
            body: JSON.stringify({ to, body })
          });
          if(!r.ok) alert(r.error||"SMS failed"); else alert("SMS sent");
        }

        async function addProvider(){
          const name = document.getElementById("pName").value.trim();
          const phone = document.getElementById("pPhone").value.trim();
          if(!name || !phone) return alert("Enter provider name + phone");
          const r = await api("/admin/api/providers", {
            method:"POST",
            headers:{ "Content-Type":"application/json" },
            body: JSON.stringify({ name, phone, active:true })
          });
          if(!r.ok) return alert(r.error||"Add provider failed");
          document.getElementById("pName").value="";
          document.getElementById("pPhone").value="";
          await refresh();
        }

        async function sendSmsManual(){
          const to = document.getElementById("smsTo").value.trim();
          const body = document.getElementById("smsBody").value.trim();
          if(!to || !body) return alert("Enter To + Message");
          await sendSms(to, body);
        }

        function renderCards(items){
          const wrap = document.getElementById("cardsWrap");
          wrap.innerHTML = items.map(l=>{
            const t = new Date(l.created_at).toLocaleString();
            const phone = l.phone || "";
            const zip = l.zip || "";
            const service = l.service || "";
            const status = l.status || "new";

            const providerLabel = l.provider_name
              ? (l.provider_name + " (" + (l.provider_phone||"") + ")")
              : "Unassigned";

            return `
              <div class="card">
                <div class="split">
                  <h4 style="margin:0">Lead #${l.id} ${statusPill(status)}</h4>
                  <div class="mut mini">${t}</div>
                </div>
                <div class="mut mini" style="margin-top:6px">Service</div>
                <div style="font-weight:800">${service || "—"}</div>
                <div class="mut mini" style="margin-top:6px">Phone • ZIP</div>
                <div style="font-weight:800">${phone || "—"} • ${zip || "—"}</div>

                <div class="mut mini" style="margin-top:10px">Assign Provider</div>
                <select style="width:100%" onchange="assignProvider(${l.id}, this.value)">
                  ${providerOptions(l.assigned_provider_id)}
                </select>
                <div class="mut mini" style="margin-top:6px">Current: ${providerLabel}</div>

                <div class="actions">
                  <a href="tel:${sanitizePhone(phone)}"><button>Call Lead</button></a>
                  <button class="btn" onclick="sendSms('${phone}','Citywide Leads: We got your request. Reply YES to confirm.')">Text Lead</button>

                  <select onchange="setStatus(${l.id}, this.value)">
                    <option value="new" ${status==="new"?"selected":""}>New</option>
                    <option value="sent" ${status==="sent"?"selected":""}>Sent</option>
                    <option value="closed" ${status==="closed"?"selected":""}>Closed</option>
                    <option value="spam" ${status==="spam"?"selected":""}>Spam</option>
                  </select>
                </div>
              </div>
            `;
          }).join("") || '<div class="mut">No leads found</div>';
        }

        function renderTable(items){
          document.getElementById("tbody").innerHTML = items.map(l=>{
            const t = new Date(l.created_at).toLocaleString();
            const phone = l.phone || "";
            const zip = l.zip || "";
            const service = l.service || "";
            const status = l.status || "new";

            const assigned = l.provider_name ? (l.provider_name + " (" + (l.provider_phone||"") + ")") : "Unassigned";

            return `
              <tr>
                <td>${t}</td>
                <td>${phone}</td>
                <td>${service}</td>
                <td>${zip}</td>
                <td>
                  ${statusPill(status)}<br/>
                  <select onchange="setStatus(${l.id}, this.value)">
                    <option value="new" ${status==="new"?"selected":""}>New</option>
                    <option value="sent" ${status==="sent"?"selected":""}>Sent</option>
                    <option value="closed" ${status==="closed"?"selected":""}>Closed</option>
                    <option value="spam" ${status==="spam"?"selected":""}>Spam</option>
                  </select>
                </td>
                <td>
                  <div class="mut mini">${assigned}</div>
                  <select onchange="assignProvider(${l.id}, this.value)">
                    ${providerOptions(l.assigned_provider_id)}
                  </select>
                </td>
                <td>
                  <a href="tel:${sanitizePhone(phone)}"><button>Call</button></a>
                  <button class="btn" onclick="sendSms('${phone}','Citywide Leads: We got your request. Reply YES to confirm.')">Text</button>
                </td>
              </tr>
            `;
          }).join("") || "<tr><td colspan='7' class='mut'>No leads</td></tr>";
        }

        function setMode(m){
          mode = m;
          document.getElementById("tabCards").classList.toggle("active", m==="cards");
          document.getElementById("tabTable").classList.toggle("active", m==="table");
          document.getElementById("cardsWrap").style.display = m==="cards" ? "block" : "none";
          document.getElementById("tableWrap").style.display = m==="table" ? "block" : "none";
          render();
        }

        function render(){
          const items = applyFilters();
          computeKPIs(items);
          if(mode==="cards") renderCards(items);
          else renderTable(items);
        }

        async function refresh(){
          // Providers
          const pr = await api("/admin/api/providers");
          providers = pr.providers || [];

          // Leads (try joined endpoint if you have it; fallback to basic)
          const lr = await api("/admin/api/leads");
          leads = lr.leads || [];

          render();
        }

        // Live filtering
        document.getElementById("q").addEventListener("input", render);
        document.getElementById("status").addEventListener("change", render);
        document.getElementById("service").addEventListener("change", render);

        // Initial
        refresh();

        // Basic nav (placeholder)
        function view(section){
          alert("Section: " + section + " (we can build this next)");
        }
      </script>
    </body>
  </html>
  `);
});
