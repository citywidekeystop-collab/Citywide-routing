'use strict';
const bounded=(s,n=180)=>String(s??'').trim().slice(0,n);
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
function registerMarketplaceArchive(app,{pool,isDatabaseReady,adminAuth}){
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
module.exports={initMarketplaceTables,registerMarketplaceArchive};
