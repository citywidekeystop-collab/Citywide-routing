'use strict';
const crypto = require('node:crypto');
const express = require('express');

const AGREEMENT_VERSION = 'nln-services-v1-2026-11-21';
const PACKAGES = Object.freeze({
  'Starter Website': { cents:19900, details: ['One custom mobile-friendly web page','Click-to-call and business inquiry form','Basic SEO page setup'] },
  'Business Essentials': { cents:39900, details: ['Up to three custom web pages','Service information and contact details','Business photos, map and social link integration'] },
  'Business Growth': { cents:69900, details: ['Up to five custom web pages','Enhanced SEO and keyword research','Google Business Profile setup assistance where eligible'] },
  'Professional Website': { cents:99900, details: ['Up to five custom web pages and local SEO','Booking and payment integration configuration','Analytics and conversion tracking setup'] },
  'Complete Business Launch': { cents:199900, details: ['Up to ten custom web pages and one business logo','Google Ads and eligible Business Profile setup assistance','Facebook, Instagram and TikTok business account setup assistance'] },
  'Complete Business & Marketing Premium': { cents:399550, details: ['Twenty-five or more custom web pages and branding','Advanced business setup and lead capture tools','Marketing, booking, and call handling options subject to agreed scope; third-party service costs are separate'] }
});
const terms = [
  'NLN will provide the deliverables listed in the selected website package at the published fixed upfront price. Additional services are not automatically included.',
  'The customer authorizes NLN to begin work after verified payment and completed onboarding, and will supply accurate content, assets, required credentials through approved secure channels, and feedback.',
  'Any domain registration, ongoing hosting, paid advertising spend, premium integrations or other outside services must be separately described and accepted before charging.',
  'Google rankings, advertising results, customer volume, and third-party account verification or approval cannot be guaranteed.',
  'A separate project schedule, revision scope, cancellation/refund arrangements and continuing-service terms will be provided for review before a real payment is activated. Recurring charges require separate explicit enrollment.'
].join('\n');
const hash = s => crypto.createHash('sha256').update(s).digest('hex');
const signatureVersionHash = hash(AGREEMENT_VERSION + '\n' + terms + '\n' + JSON.stringify(PACKAGES));
const checkoutOn = ()=>process.env.CHECKOUT_ENABLED==='true' &&
 process.env.AGREEMENT_APPROVED==='true' &&
 /^sk_(test|live)_/.test(String(process.env.STRIPE_SECRET_KEY||'')) &&
 String(process.env.STRIPE_WEBHOOK_SECRET||'').startsWith('whsec_');
const stripeClient = ()=>require('stripe')(process.env.STRIPE_SECRET_KEY);
function registerWebhook(app, pool, isDatabaseReady) {
 app.post('/api/stripe/webhook',express.raw({type:'application/json', limit:'256kb'}),async(req,res)=>{
  if(!checkoutOn())return res.status(503).send('Not configured');
  let event;
  try {
    event=stripeClient().webhooks.constructEvent(req.body,req.headers['stripe-signature'],process.env.STRIPE_WEBHOOK_SECRET);
  } catch (_) { return res.status(400).send('Invalid signature'); }
  if(event.type==='checkout.session.completed' && event.data.object.payment_status==='paid' && isDatabaseReady()) {
    const session=event.data.object, id=String(session.metadata?.nln_order_id||'');
    const paidAmount=Number(session.amount_total);
    try {
      await pool.query(
       "UPDATE nln_service_orders SET status='PAID', paid_at=NOW(), updated_at=NOW() WHERE id=$1 AND stripe_session_id=$2 AND amount_cents=$3 AND status='PENDING_PAYMENT'",
       [id,session.id,paidAmount]
      );
    } catch (_) { return res.status(500).send('Database error'); }
  }
  res.status(200).json({received:true});
 });
}
function registerRoutes(app, {pool,isDatabaseReady,requestLimit,isSameOrigin}) {
 app.get('/api/packages',(req,res)=>{
  res.json({packages:Object.entries(PACKAGES).map(([name,p])=>({name,cents:p.cents,details:p.details})),agreementVersion:AGREEMENT_VERSION,agreementText:terms});
 });
 app.post('/api/checkout/start',requestLimit,async(req,res)=>{
  if(req.get('content-type')?.split(';')[0].trim()!=='application/json'||!isSameOrigin(req))return res.status(403).json({message:'Invalid request'});
  if(!pool||!isDatabaseReady())return res.status(503).json({message:'Unable to save your agreement right now.'});
  const b=req.body||{},name=String(b.name||'').trim().slice(0,100),email=String(b.email||'').trim().toLowerCase().slice(0,180);
  const signature=String(b.signedName||'').trim().slice(0,100),business=String(b.business||'').trim().slice(0,130);
  const phone=String(b.phone||'').trim().slice(0,35),packageName=String(b.package||'');
  const p=PACKAGES[packageName];
  const requestKey=String(b.idempotencyKey||'');
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(requestKey))return res.status(400).json({message:'Invalid checkout request. Reload the page and try again.'});
  if(!p||name.length<2||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||signature.toLocaleLowerCase()!==name.toLocaleLowerCase()
   ||b.agreed!==true||b.eSignConsent!==true||b.agreementVersion!==AGREEMENT_VERSION) {
    return res.status(400).json({message:'Select a package and provide a matching electronic signature, email and consent.'});
  }
  if(phone&&!/^[+()\-\d .]{7,35}$/.test(phone))return res.status(400).json({message:'Enter a valid phone number.'});
  if(b.website)return res.json({ok:true});
  const id=crypto.randomUUID();
  const auditHash=hash((req.ip||'')+'|'+(req.get('user-agent')||'')+'|'+id);
  const record=[id,name,business,email,phone,packageName,p.cents,AGREEMENT_VERSION,signatureVersionHash,signature,auditHash,requestKey];
  let storedOrderId=id;
  try{
    const ins=await pool.query("INSERT INTO nln_service_orders (id,customer_name,business_name,email,phone,package_name,amount_cents,agreement_version,agreement_hash,signed_name,signature_audit_hash,idempotency_key,status,agreed_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'AGREEMENT_RECEIVED',NOW()) ON CONFLICT (idempotency_key) DO NOTHING RETURNING id",record);
    if(!ins.rowCount){
      const existing=await pool.query('SELECT id,email,package_name,amount_cents FROM nln_service_orders WHERE idempotency_key=$1 LIMIT 1',[requestKey]);
      if(!existing.rowCount||existing.rows[0].email!==email||existing.rows[0].package_name!==packageName||existing.rows[0].amount_cents!==p.cents)
        return res.status(409).json({message:'This request was already used. Please reload the page.'});
      storedOrderId=existing.rows[0].id;
    }
  }catch(e){console.error('NLN agreement save error',e.code||'unknown');return res.status(503).json({message:'Unable to save your agreement right now.'})}
  if(!checkoutOn()){
    return res.status(202).json({ok:true,orderId:storedOrderId,next:'agreement_recorded',message:'Your package and service agreement have been recorded. NLN will contact you to arrange the next step.'});
  }
  const site=String(process.env.SITE_URL||process.env.RENDER_EXTERNAL_URL||'').replace(/\/+$/,'');
  if(!site.startsWith('https://'))return res.status(503).json({message:'Secure checkout address not configured.'});
  try{
    const stripe=stripeClient();
    const session=await stripe.checkout.sessions.create({
      mode:'payment',
      customer_email:email,
      client_reference_id:storedOrderId,
      line_items:[{price_data:{currency:'usd',unit_amount:p.cents,product_data:{name:'NLN — '+packageName,description:'Website development and setup services under agreement '+AGREEMENT_VERSION}},quantity:1}],
      payment_method_types:['card'],
      metadata:{nln_order_id:storedOrderId,agreement_version:AGREEMENT_VERSION},
      payment_intent_data:{metadata:{nln_order_id:storedOrderId}},
      success_url:site+'/order-confirmation?session_id={CHECKOUT_SESSION_ID}',
      cancel_url:site+'/start?package='+encodeURIComponent(packageName)
    },{idempotencyKey:'nln-checkout-'+storedOrderId});
    await pool.query("UPDATE nln_service_orders SET status='PENDING_PAYMENT',stripe_session_id=$1,updated_at=NOW() WHERE id=$2",[session.id,id]);
    res.json({ok:true,orderId:storedOrderId,next:'stripe_checkout',url:session.url});
  }catch(e){
    console.error('NLN secure checkout create failed:',e.type||e.code||'unavailable');
    res.status(503).json({ok:false,message:'Unable to open secure payment. Your agreement was saved; please contact NLN.'});
  }
 });
 app.get('/api/payment-status',requestLimit,async(req,res)=>{
  const sessionId=String(req.query.session_id||'');
  if(!/^cs_(test|live)_[a-zA-Z0-9]{8,200}$/.test(sessionId)||!checkoutOn()||!isDatabaseReady())
   return res.status(400).json({ok:false,message:'Payment status is not available for that session.'});
  try{
   const stripe=stripeClient();
   const session=await stripe.checkout.sessions.retrieve(sessionId);
   const record=await pool.query('SELECT status FROM nln_service_orders WHERE stripe_session_id=$1 LIMIT 1',[sessionId]);
   if(!record.rowCount)return res.status(404).json({ok:false,message:'Order not found'});
   const webhookConfirmed=record.rows[0].status==='PAID';
   const processorConfirmed=session.payment_status==='paid';
   res.set('Cache-Control','no-store').json({ok:true,status:webhookConfirmed&&processorConfirmed?'PAID':'VERIFYING'});
  }catch(_){return res.status(503).json({ok:false,message:'Unable to verify the payment yet.'})}
 });
}
async function initOrderTable(pool){
 if(!pool)return;
 await pool.query("CREATE TABLE IF NOT EXISTS nln_service_orders ("+
 "id UUID PRIMARY KEY, customer_name VARCHAR(100) NOT NULL, business_name VARCHAR(130),"+
 "email VARCHAR(180) NOT NULL, phone VARCHAR(35), package_name VARCHAR(90) NOT NULL,"+
 "amount_cents INTEGER NOT NULL, agreement_version VARCHAR(60) NOT NULL, agreement_hash VARCHAR(64) NOT NULL,"+
 "signed_name VARCHAR(100) NOT NULL, signature_audit_hash VARCHAR(64) NOT NULL, agreed_at TIMESTAMPTZ NOT NULL,"+
 "status VARCHAR(40) NOT NULL DEFAULT 'AGREEMENT_RECEIVED', stripe_session_id VARCHAR(150),"+
 "paid_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())");
 await pool.query('ALTER TABLE nln_service_orders ADD COLUMN IF NOT EXISTS idempotency_key UUID');
 await pool.query('CREATE UNIQUE INDEX IF NOT EXISTS nln_service_orders_idempotency ON nln_service_orders(idempotency_key)');
}
module.exports={AGREEMENT_VERSION,PACKAGES,terms,signatureVersionHash,checkoutOn,initOrderTable,registerWebhook,registerRoutes};
