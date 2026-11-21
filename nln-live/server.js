
'use strict';
const express = require('express');
const helmet = require('helmet');
const { Pool } = require('pg');
const path = require('node:path');
const fs = require('node:fs');
const crypto = require('node:crypto');

const app = express();
const PORT = Number(process.env.PORT || 10000);
const publicDir = path.join(__dirname, 'public');
const domain = String(process.env.SITE_URL || '').replace(/\/+$/, '');
const pool = process.env.DATABASE_URL ? new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 4,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
  ...(process.env.PGSSL === 'true' ? { ssl: { rejectUnauthorized: false } } : {})
}) : null;
let dbReady = false;
const launchReady = () => Boolean(
  dbReady && domain.startsWith('https://') &&
  process.env.SEARCH_INDEXING_ENABLED === 'true' &&
  process.env.INTAKE_OPEN === 'true'
);
const pages = Object.freeze([
  '/', '/website-design', '/websites-for-contractors', '/google-business-profile-help',
  '/business-launch', '/ecommerce-websites', '/pricing', '/portfolio', '/contact',
  '/privacy', '/terms'
]);

app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
app.use((req, res, next) => {
  if (!launchReady() || req.path.startsWith('/admin') || req.path.startsWith('/api')) {
    res.set('X-Robots-Tag', 'noindex, nofollow');
  }
  res.set('Cache-Control', req.path.startsWith('/api') || req.path.startsWith('/admin') ? 'no-store' : 'public, max-age=300');
  next();
});
app.use(express.json({ limit: '12kb', strict: true }));
app.use('/assets', express.static(path.join(publicDir,'assets'), { index: false, extensions: false, maxAge: '1h' }));
const escapeHtml = s => String(s || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

async function initDb(){
  if (!pool) return;
  await pool.query("CREATE TABLE IF NOT EXISTS nln_business_inquiries (" +
    "id BIGSERIAL PRIMARY KEY, full_name VARCHAR(100) NOT NULL, business_name VARCHAR(130)," +
    "email VARCHAR(180) NOT NULL, phone VARCHAR(35), requested_service VARCHAR(80) NOT NULL," +
    "requested_package VARCHAR(80), domain_choice VARCHAR(20), preferred_domain VARCHAR(180)," +
    "details TEXT NOT NULL, source_page VARCHAR(150), consent_at TIMESTAMPTZ NOT NULL," +
    "status VARCHAR(20) NOT NULL DEFAULT 'NEW', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()," +
    "updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())");
  dbReady = true;
  console.log('NLN inquiry database ready');
}
initDb().catch(err => { dbReady = false; console.error('NLN DB init unavailable:', err.code || 'error'); });

function servePage(req,res,filename){
  let html;
  try { html = fs.readFileSync(path.join(publicDir,filename), 'utf8'); }
  catch(e) { return res.status(404).send('Page not found'); }
  const route = filename === 'index.html' ? '/' : '/' + filename.replace('.html','');
  const canonical = domain && domain.startsWith('https://')
    ? '<link rel="canonical" href="' + escapeHtml(domain + route) + '">' : '';
  const verification = process.env.GSC_VERIFICATION_TOKEN
    ? '<meta name="google-site-verification" content="' + escapeHtml(process.env.GSC_VERIFICATION_TOKEN) + '">' : '';
  res.type('html').send(html.replace('<!--CANONICAL-->',canonical).replace('<!--GSC_VERIFICATION-->', verification));
}
for(const route of pages){
  const filename = route === '/' ? 'index.html' : route.slice(1) + '.html';
  app.get(route, (req,res)=>servePage(req,res,filename));
}
app.get('/index.html',(req,res)=>res.redirect(301,'/'));
app.get('/:slug.html',(req,res)=>{const route='/'+req.params.slug;if(pages.includes(route))return res.redirect(301,route);res.status(404).send('Not found')});
app.get('/admin',(req,res)=>servePage(req,res,'admin.html'));

app.get('/robots.txt',(req,res)=>{
  res.type('text/plain').send('User-agent: *\nAllow: /\n' +
    (launchReady()? 'Sitemap: ' + domain + '/sitemap.xml\n' : ''));
});
app.get('/sitemap.xml',(req,res)=>{
  if(!launchReady())return res.status(503).type('text/plain').send('Sitemap available after launch verification');
  res.type('application/xml').send('<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' +
    pages.filter(p=>!['/terms','/privacy'].includes(p)).map(p=>
      '<url><loc>' + escapeHtml(domain+p) + '</loc></url>').join('') + '</urlset>');
});
app.get('/health',async(req,res)=>{
  if(!pool)return res.status(503).json({ok:false,site:'ready-for-setup',leadStorage:'not-connected'});
  try { await pool.query('SELECT 1');dbReady=true;res.json({ok:true,site:'staging',leadStorage:'connected',searchIndexing:launchReady()}); }
  catch(e){dbReady=false;res.status(503).json({ok:false,leadStorage:'unavailable'}); }
});

const attempts = new Map();
function requestLimit(req,res,next){
  const now = Date.now(), ip = req.ip || 'unknown';
  const past = (attempts.get(ip)||[]).filter(t => now-t<60*60*1000);
  if(past.length >= 8)return res.status(429).json({ok:false,message:'Too many requests. Please try again later.'});
  past.push(now);attempts.set(ip,past);
  if(attempts.size>5000){for(const [k,v] of attempts){if(!v.length||now-v[v.length-1]>3600000)attempts.delete(k)}}
  next();
}
function isSameOrigin(req){
  if(req.get('sec-fetch-site') === 'cross-site') return false;
  const origin = req.get('origin');
  if(!origin)return true;
  const host = req.get('host');
  return !!host && (origin === 'https://' + host || origin === 'http://' + host);
}
app.post('/api/inquiries',requestLimit,async(req,res)=>{
  if(req.get('content-type')?.split(';')[0].trim() !== 'application/json')return res.status(415).json({ok:false,message:'Invalid request format'});
  if(!isSameOrigin(req))return res.status(403).json({ok:false,message:'Request source not allowed'});
  if(req.body?.website) return res.json({ok:true,message:'Thanks for getting in touch.'}); // spam honeypot
  if(!pool || !dbReady || process.env.INTAKE_OPEN !== 'true')return res.status(503).json({ok:false,message:'The inquiry service is not available yet. Please try again later.'});
  const b=req.body||{};
  const name=String(b.name||'').trim().slice(0,100);
  const email=String(b.email||'').trim().toLowerCase().slice(0,180);
  const business=String(b.business||'').trim().slice(0,130);
  const phone=String(b.phone||'').trim().slice(0,35);
  const service=String(b.service||'Website Development').trim().slice(0,80);
  const pkg=String(b.package||'Not selected').trim().slice(0,80);
  const domainChoice=String(b.domainChoice||'later').trim();
  const domainName=String(b.domainName||'').trim().slice(0,180);
  const details=String(b.details||'').trim().slice(0,3000);
  const source=String(b.source||'contact').trim().slice(0,150);
  if(name.length<2||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||details.length<12||
    !['new','existing','later'].includes(domainChoice)||b.consent!==true)
    return res.status(400).json({ok:false,message:'Please enter your name, valid email, project details and consent.'});
  if(phone && !/^[+()\-\d .]{7,35}$/.test(phone))return res.status(400).json({ok:false,message:'Please enter a valid phone number.'});
  if(domainName && !/^[a-z0-9](?:[a-z0-9.-]{0,176}[a-z0-9])?$/i.test(domainName))
    return res.status(400).json({ok:false,message:'Please enter a valid domain name or leave it blank.'});
  try{
    const q='INSERT INTO nln_business_inquiries (full_name,business_name,email,phone,requested_service,requested_package,domain_choice,preferred_domain,details,source_page,consent_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,NOW()) RETURNING id';
    const saved=await pool.query(q,[name,business,email,phone,service,pkg,domainChoice,domainName,details,source]);
    res.status(201).json({ok:true,id:String(saved.rows[0].id),message:'Your request was received. NLN will review the details.'});
    if(process.env.RESEND_API_KEY && process.env.LEAD_FROM_EMAIL && process.env.LEAD_NOTIFY_EMAIL){
      fetch('https://api.resend.com/emails',{
        method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+process.env.RESEND_API_KEY},
        body:JSON.stringify({from:process.env.LEAD_FROM_EMAIL,to:[process.env.LEAD_NOTIFY_EMAIL],
          subject:'New NLN website inquiry #'+saved.rows[0].id,
          text:'New NLN business inquiry saved. Open your NLN admin inbox to review. Reference '+saved.rows[0].id})
      }).catch(()=>console.error('NLN notification delivery failed'));
    }
  }catch(e){console.error('NLN inquiry save error:', e.code || 'db-error');res.status(503).json({ok:false,message:'We could not save the request. Please try again later.'});}
});

function adminAuth(req,res,next){
  const expected = String(process.env.ADMIN_KEY||'');
  const supplied = String(req.get('x-admin-key')||'');
  if(expected.length<32 || supplied.length!==expected.length ||
     !crypto.timingSafeEqual(Buffer.from(supplied),Buffer.from(expected)))
    return res.status(401).json({ok:false,message:'Not authorized'});
  next();
}
app.get('/api/admin/inquiries',adminAuth,async(req,res)=>{
  if(!dbReady)return res.status(503).json({ok:false});
  try{const result=await pool.query('SELECT * FROM nln_business_inquiries ORDER BY created_at DESC LIMIT 250');res.json({ok:true,items:result.rows})}
  catch(e){res.status(503).json({ok:false})}
});
app.patch('/api/admin/inquiries/:id',adminAuth,async(req,res)=>{
  const status=String(req.body?.status||'').toUpperCase();
  if(!['NEW','CONTACTED','QUOTED','BOOKED','COMPLETE','CLOSED'].includes(status))return res.status(400).json({ok:false});
  try{
    const q=await pool.query('UPDATE nln_business_inquiries SET status=$1,updated_at=NOW() WHERE id=$2 RETURNING id',[status,req.params.id]);
    res.json({ok:q.rowCount===1});
  }catch(e){res.status(503).json({ok:false})}
});
app.get('/api/admin/export.csv',adminAuth,async(req,res)=>{
  try{
    const result=await pool.query('SELECT id,created_at,full_name,business_name,email,phone,requested_service,requested_package,domain_choice,preferred_domain,details,source_page,status FROM nln_business_inquiries ORDER BY created_at DESC LIMIT 1000');
    const keys=Object.keys(result.rows[0]||{id:1,created_at:1,full_name:1,business_name:1,email:1,phone:1,requested_service:1,requested_package:1,domain_choice:1,preferred_domain:1,details:1,source_page:1,status:1});
    const csv=[keys.join(',')].concat(result.rows.map(row=>keys.map(k=>'"'+String(row[k]??'').replaceAll('"','""').replace(/^[=+\-@\t\r]/,'\'$&')+'"').join(','))).join('\r\n');
    res.set('Content-Disposition','attachment; filename="nln-business-inquiries.csv"');
    res.type('text/csv').send(csv);
  }catch(e){res.status(503).json({ok:false})}
});
app.use((req,res)=>res.status(404).send('Not found'));
app.listen(PORT, '0.0.0.0',()=>console.log('NLN marketing site listening on '+PORT));
