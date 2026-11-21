'use strict';
const crypto=require('node:crypto');
const CATEGORIES=Object.freeze(['Locksmith','Plumbing','Electrical','HVAC','House Cleaning','Handyman','Landscaping','Painting','Roofing','Appliance Repair','Moving','Auto Repair']);
const TIMEFRAMES=Object.freeze(['As soon as possible','This week','Flexible']);
const STATES=new Set('AL AK AZ AR CA CO CT DE DC FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY'.split(' '));
const bounded=(s,n=180)=>String(s??'').trim().slice(0,n);
const mail=s=>s.length<=180&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
const phone=s=>/^[+()\-\d .]{7,35}$/.test(s);
const postal=s=>/^\d{5}$/.test(s);
const bad=()=>({ok:false,message:'Please check the required fields and try again.'});
async function initMarketplaceTables(pool){
 if(!pool)return;
 await pool.query("CREATE TABLE IF NOT EXISTS nln_marketplace_requests ("+
   "id UUID PRIMARY KEY, full_name VARCHAR(100) NOT NULL, email VARCHAR(180) NOT NULL, phone VARCHAR(35) NOT NULL,"+
   "category VARCHAR(45) NOT NULL, zip_code VARCHAR(5) NOT NULL, timeframe VARCHAR(40) NOT NULL, details TEXT NOT NULL,"+
   "status VARCHAR(25) NOT NULL DEFAULT 'NEW', consent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),"+
   "created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())");
 await pool.query("CREATE TABLE IF NOT EXISTS nln_marketplace_providers ("+
   "id UUID PRIMARY KEY, contact_name VARCHAR(100) NOT NULL, business_name VARCHAR(130) NOT NULL,"+
   "email VARCHAR(180) NOT NULL, phone VARCHAR(35) NOT NULL, city VARCHAR(90) NOT NULL, state VARCHAR(2) NOT NULL,"+
   "categories TEXT[] NOT NULL, zip_codes TEXT[] NOT NULL, website VARCHAR(220), license_details VARCHAR(180), notes TEXT,"+
   "status VARCHAR(25) NOT NULL DEFAULT 'PENDING', review_note TEXT, reviewed_at TIMESTAMPTZ,"+
   "consent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),"+
   "updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())");
 await pool.query("CREATE TABLE IF NOT EXISTS nln_marketplace_matches ("+
   "request_id UUID NOT NULL REFERENCES nln_marketplace_requests(id),"+
   "provider_id UUID NOT NULL REFERENCES nln_marketplace_providers(id),"+
   "matched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), PRIMARY KEY(request_id,provider_id))");
}
function alertAdmin(id,label){
 const key=process.env.RESEND_API_KEY,from=process.env.LEAD_FROM_EMAIL,to=process.env.LEAD_NOTIFY_EMAIL;
 if(!(key&&from&&to))return;
 fetch('https://api.resend.com/emails',{method:'POST',
  headers:{Authorization:'Bearer '+key,'Content-Type':'application/json'},
  body:JSON.stringify({from,to:[to],subject:'NLN '+label+' '+id,
   text:'New '+label+' '+id+'. Review in the private NLN admin inbox.'})
 }).catch(()=>console.error('NLN marketplace notification unavailable'));
}
function registerMarketplaceRoutes(app,{pool,isDatabaseReady,requestLimit,isSameOrigin,adminAuth}){
 app.get('/api/marketplace/categories',(req,res)=>res.json({categories:CATEGORIES,timeframes:TIMEFRAMES,pilot:'Maryland',serviceAvailability:'not-guaranteed'}));
 function validateRequest(req,res){
  if(req.get('content-type')?.split(';')[0].trim()!=='application/json'||!isSameOrigin(req)){
   res.status(403).json(bad());return false;
  }
  if(!pool||!isDatabaseReady()){res.status(503).json({ok:false,message:'Intake is temporarily unavailable.'});return false}
  return true;
 }
 app.post('/api/marketplace/request',requestLimit,async(req,res)=>{
  if(!validateRequest(req,res))return;
  const b=req.body||{};if(b.website)return res.status(200).json({ok:true,message:'Thank you.'});
  const name=bounded(b.name,100),email=bounded(b.email,180).toLowerCase(),contact=bounded(b.phone,35);
  const category=bounded(b.category,45),zip=bounded(b.zip,5),time=bounded(b.timeframe,40),details=bounded(b.details,3000);
  if(name.length<2||!mail(email)||!phone(contact)||!CATEGORIES.includes(category)||
     !postal(zip)||!TIMEFRAMES.includes(time)||details.length<15||b.consent!==true)return res.status(400).json(bad());
  const id=crypto.randomUUID();
  try{
   await pool.query("INSERT INTO nln_marketplace_requests(id,full_name,email,phone,category,zip_code,timeframe,details) VALUES($1,$2,$3,$4,$5,$6,$7,$8)",[id,name,email,contact,category,zip,time,details]);
   res.status(201).json({ok:true,id,message:'Your request was received for review. No professional has been assigned yet. NLN will contact you if a suitable pro is available.'});
   alertAdmin(id,'service request');
  }catch(e){console.error('Marketplace request error',e.code||'db');res.status(503).json({ok:false,message:'Your request could not be saved.'})}
 });
 app.post('/api/marketplace/provider',requestLimit,async(req,res)=>{
  if(!validateRequest(req,res))return;
  const b=req.body||{};if(b.website)return res.status(200).json({ok:true,message:'Thank you.'});
  const name=bounded(b.name,100),business=bounded(b.business,130),email=bounded(b.email,180).toLowerCase(),contact=bounded(b.phone,35);
  const city=bounded(b.city,90),state=bounded(b.state,2).toUpperCase(),website=bounded(b.businessWebsite,220),license=bounded(b.license,180),notes=bounded(b.notes,1500);
  const categories=Array.isArray(b.categories)?[...new Set(b.categories.map(x=>bounded(x,45)))]:[];
  const zips=[...new Set(bounded(b.zipCodes,320).split(/[,;\s]+/).map(x=>x.trim()).filter(Boolean))];
  if(name.length<2||business.length<2||!mail(email)||!phone(contact)||!city||!STATES.has(state)||
   !categories.length||categories.length>6||categories.some(x=>!CATEGORIES.includes(x))||
   !zips.length||zips.length>20||zips.some(x=>!postal(x))||
   (website&&!/^https:\/\/[a-z0-9.-]+\.[a-z]{2,}(?:\/[^\s]*)?$/i.test(website))||b.consent!==true)return res.status(400).json(bad());
  const id=crypto.randomUUID();
  try{
   await pool.query("INSERT INTO nln_marketplace_providers(id,contact_name,business_name,email,phone,city,state,categories,zip_codes,website,license_details,notes) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)",[id,name,business,email,contact,city,state,categories,zips,website||null,license||null,notes||null]);
   res.status(201).json({ok:true,id,message:'Your application was received. Verification and approval are required before any professional listing or matching.'});
   alertAdmin(id,'provider application');
  }catch(e){console.error('Marketplace provider error',e.code||'db');res.status(503).json({ok:false,message:'Your application could not be saved.'})}
 });
 app.get('/api/admin/marketplace',adminAuth,async(req,res)=>{
  if(!isDatabaseReady())return res.status(503).json({ok:false});
  try{
   const [requests,providers,matches]=await Promise.all([
    pool.query('SELECT id,full_name,email,phone,category,zip_code,timeframe,details,status,created_at FROM nln_marketplace_requests ORDER BY created_at DESC LIMIT 150'),
    pool.query('SELECT id,contact_name,business_name,email,phone,city,state,categories,zip_codes,website,license_details,notes,status,review_note,reviewed_at,created_at FROM nln_marketplace_providers ORDER BY created_at DESC LIMIT 150'),
    pool.query("SELECT r.id,COUNT(p.id)::integer AS potential_pros FROM (SELECT id,category,zip_code FROM nln_marketplace_requests ORDER BY created_at DESC LIMIT 150) r LEFT JOIN nln_marketplace_providers p ON p.status='APPROVED' AND r.category=ANY(p.categories) AND r.zip_code=ANY(p.zip_codes) GROUP BY r.id")
   ]);
   res.set('Cache-Control','no-store').json({ok:true,requests:requests.rows,providers:providers.rows,potentialMatches:matches.rows});
  }catch(e){res.status(503).json({ok:false})}
 });
 app.patch('/api/admin/marketplace/providers/:id',adminAuth,async(req,res)=>{
  const status=bounded(req.body?.status,25).toUpperCase(),note=bounded(req.body?.reviewNote,1200);
  if(!['APPROVED','REJECTED','PENDING'].includes(status)||(status==='APPROVED'&&note.length<15))
   return res.status(400).json({ok:false,message:'Approval requires a verification review note.'});
  try{
   const r=await pool.query('UPDATE nln_marketplace_providers SET status=$1,review_note=$2,reviewed_at=NOW(),updated_at=NOW() WHERE id=$3 RETURNING id,status',[status,note,req.params.id]);
   res.json({ok:r.rowCount===1,status:r.rows[0]?.status});
  }catch(e){res.status(503).json({ok:false})}
 });
 app.post('/api/admin/marketplace/matches',adminAuth,async(req,res)=>{
  const requestId=bounded(req.body?.requestId,50),providerId=bounded(req.body?.providerId,50);
  if(!/^[0-9a-f-]{36}$/i.test(requestId)||!/^[0-9a-f-]{36}$/i.test(providerId))return res.status(400).json({ok:false});
  try{
   const match=await pool.query("SELECT r.id FROM nln_marketplace_requests r JOIN nln_marketplace_providers p ON p.id=$2 WHERE r.id=$1 AND p.status='APPROVED' AND r.category=ANY(p.categories) AND r.zip_code=ANY(p.zip_codes)",[requestId,providerId]);
   if(!match.rowCount)return res.status(409).json({ok:false,message:'No approved matching pro is available.'});
   await pool.query('INSERT INTO nln_marketplace_matches(request_id,provider_id) VALUES($1,$2) ON CONFLICT DO NOTHING',[requestId,providerId]);
   await pool.query("UPDATE nln_marketplace_requests SET status='REVIEWED',updated_at=NOW() WHERE id=$1 AND status='NEW'",[requestId]);
   res.json({ok:true,message:'Private matching suggestion recorded. No automatic customer or provider notification has been sent.'});
  }catch(e){res.status(503).json({ok:false})}
 });
}
module.exports={CATEGORIES,initMarketplaceTables,registerMarketplaceRoutes};
