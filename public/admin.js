'use strict';
const statusTypes = ['new','contacted','booked','completed','closed'];
const assignmentTypes = ['unassigned','Citywide','partner'];
let leads = [];
const tbody = document.getElementById('leadRows');
const errorEl = document.getElementById('adminError');
function element(tag, text, className) {
  const el = document.createElement(tag); if (text != null) el.textContent = text;
  if (className) el.className = className; return el;
}
function line(main, sub) { const container = element('div');container.append(element('strong',main),element('br'),element('small',sub));return container; }
function selector(items, chosen, change) {
  const select = element('select');
  for (const item of items) { const option = element('option',item);option.value=item;option.selected=item===chosen;select.append(option); }
  select.addEventListener('change',change);return select;
}
async function saveRow(lead, field, value) {
  const next = { status: lead.status, assignedTo: lead.assigned_to };
  next[field] = value;
  try {
    const res = await fetch(`/api/admin/leads/${encodeURIComponent(lead.id)}`, { method:'PATCH', headers:{'content-type':'application/json'}, body:JSON.stringify(next) });
    if (!res.ok) throw new Error('Could not save lead change');
    lead.status = next.status; lead.assigned_to = next.assignedTo;
    errorEl.textContent = '';render();
  } catch (e) { errorEl.textContent=e.message;render(); }
}
function render() {
  document.getElementById('countAll').textContent = leads.length;
  document.getElementById('countNew').textContent = leads.filter(l=>l.status==='new').length;
  document.getElementById('countBooked').textContent = leads.filter(l=>l.status==='booked').length;
  document.getElementById('countAlerts').textContent = leads.filter(l=>l.notification_status==='failed').length;
  const status = document.getElementById('statusFilter').value;
  const needle = document.getElementById('searchLeads').value.trim().toLowerCase();
  const rows = leads.filter(l => (status==='all'||l.status===status) && [l.full_name,l.zip_code,l.job_type,l.phone,l.city,l.project_details].some(x=>String(x||'').toLowerCase().includes(needle)));
  tbody.replaceChildren();
  if (!rows.length) { const tr=element('tr');const td=element('td','No matching requests');td.colSpan=7;tr.append(td);tbody.append(tr);return; }
  for (const l of rows) {
    const tr = element('tr');
    const created = new Date(l.created_at);
    const received=element('td');received.append(line(created.toLocaleString(),`#${l.id.slice(0,8)}`));
    const customer = element('td');const contact=line(l.full_name,l.phone);const phoneLink=element('a',l.phone);phoneLink.href=`tel:${l.phone.replace(/[^+\d]/g,'')}`;contact.replaceChild(phoneLink,contact.querySelector('small'));customer.append(contact);
    if (l.email) { const mail=element('a',l.email);mail.href=`mailto:${encodeURIComponent(l.email)}`;customer.append(element('br'),mail); }
    const request=element('td');request.append(element('strong',l.job_type),element('div',`${l.service_category} • ${l.property_type} • ${l.urgency}`,'details'));if(l.project_details)request.append(element('p',l.project_details,'details'));
    const area=element('td');area.append(line(`${l.city||'—'}, ${l.zip_code}`,l.street_address||'Street not supplied'));
    const s=element('td');s.append(selector(statusTypes,l.status,e=>saveRow(l,'status',e.target.value)));
    const a=element('td');a.append(selector(assignmentTypes,l.assigned_to,e=>saveRow(l,'assignedTo',e.target.value)));
    const alert=element('td',l.notification_status==='failed'?'ALERT FAILED':l.notification_status);
    if(l.notification_status==='failed')alert.style.color='#ba3434';
    tr.append(received,customer,request,area,s,a,alert);tbody.append(tr);
  }
}
async function refresh() {
  try {const r=await fetch('/api/admin/leads',{cache:'no-store'});if(!r.ok)throw new Error('Unable to fetch dispatch requests');const data=await r.json();leads=data.leads||[];errorEl.textContent='';render();}
  catch (e) {errorEl.textContent=e.message;}
}
document.getElementById('refreshBtn').addEventListener('click',refresh);
document.getElementById('searchLeads').addEventListener('input',render);
document.getElementById('statusFilter').addEventListener('change',render);
refresh();setInterval(refresh,20000);
