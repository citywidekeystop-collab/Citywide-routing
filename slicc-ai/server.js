import express from 'express';
import OpenAI from 'openai';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { timingSafeEqual } from 'node:crypto';
import { instructions } from './prompt.js';
import { agentList,agents,getDemo,runSpecialist,routeAgent } from './bots.js';
import { attachSpecialists } from './sideband.js';

const app=express();
app.disable('x-powered-by');
const port=Number(process.env.PORT||10000);
const keyReady=Boolean(process.env.OPENAI_API_KEY);
const webhookReady=Boolean(process.env.OPENAI_WEBHOOK_SECRET);
const phoneConfigured=keyReady&&webhookReady;
const maxCalls=Math.min(20,Math.max(1,Number(process.env.MAX_TEST_CALLS||5)));
const maxSeconds=Math.min(300,Math.max(30,Number(process.env.MAX_CALL_SECONDS||180)));
let accepted=0;
const processed=new Set();
const client=keyReady?new OpenAI({apiKey:process.env.OPENAI_API_KEY,webhookSecret:process.env.OPENAI_WEBHOOK_SECRET}):null;
const publicDir=path.join(path.dirname(fileURLToPath(import.meta.url)),'public');

app.use((_req,res,next)=>{
 res.set('X-Content-Type-Options','nosniff');
 res.set('Referrer-Policy','no-referrer');
 res.set('Cache-Control','no-store');
 res.set('Content-Security-Policy',"default-src 'self'; img-src 'self' data:; script-src 'self'; style-src 'self' 'unsafe-inline'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'");
 next();
});
app.use(express.static(publicDir,{index:'index.html',extensions:['html'],maxAge:0}));
app.get('/health',(_req,res)=>res.json({
 service:'slicc-ai-voice-pilot',running:true,
 specialistCount:agentList.length, specialistsReady:true,
 apiKeyConfigured:keyReady,phoneWebhookConfigured:phoneConfigured,
 acceptingCalls:phoneConfigured&&process.env.ENABLE_TEST_CALLS==='true',
 acceptedTestCalls:accepted,maxTestCalls:maxCalls,
 testMode:true,legalSourceLibraryConnected:false,realBillingConnected:false,
 callrailConnected:false
}));
app.get('/api/bots',(_req,res)=>res.json({agents:agentList,mode:'scripted-demo',legalSourceLibraryConnected:false}));
app.get('/api/demo/:id',(req,res)=>{
 const d=getDemo(req.params.id);
 if(!d)return res.status(404).json({error:'Specialist not found'});
 res.json(d);
});
function authorized(request){
 const token=process.env.SLICC_TEST_TOKEN;
 if(!token||token.length<20)return false;
 const supplied=request.get('Authorization')||'';
 const expected='Bearer '+token;
 const a=Buffer.from(supplied),b=Buffer.from(expected);
 return a.length===b.length&&timingSafeEqual(a,b);
}
// Private, development-only endpoint. Never expose on an unauthenticated public form.
app.post('/api/internal/assist',express.json({limit:'4kb'}),async(req,res)=>{
 if(!authorized(req))return res.status(403).json({error:'Private test access is not configured or authorized'});
 if(!client)return res.status(503).json({error:'Set OpenAI API key in Render first'});
 const question=typeof req.body?.question==='string'?req.body.question:'';
 if(question.length<3||question.length>1200)return res.status(400).json({error:'Question must be 3–1200 characters'});
 const agentId=typeof req.body?.agentId==='string'&&agents[req.body.agentId]?req.body.agentId:routeAgent(question);
 try{
  const output=await runSpecialist({agentId,question,openai:client});
  res.json(output);
 }catch(err){
  console.error('SLICC test specialist request failed',err?.name||'Unknown');
  res.status(503).json({error:'Specialist temporarily unavailable; no result was saved'});
 }
});
async function callControl(sessionId,kind,payload){
 const response=await fetch('https://api.openai.com/v1/live/sessions/'+encodeURIComponent(sessionId)+'/'+kind,{
  method:'POST',headers:{Authorization:'Bearer '+process.env.OPENAI_API_KEY,'Content-Type':'application/json'},
  body:payload?JSON.stringify(payload):undefined,
  signal:AbortSignal.timeout(15000)
 });
 if(!response.ok)throw new Error('Call control returned '+response.status);
}
app.post('/webhooks/openai',express.text({type:'application/json',limit:'128kb'}),async(req,res)=>{
 if(!phoneConfigured)return res.status(503).send('Phone project not configured');
 let event;
 try{event=await client.webhooks.unwrap(req.body,req.headers);}catch{return res.status(400).send('Invalid webhook signature');}
 if(event.type!=='live.transport.incoming')return res.sendStatus(200);
 if(processed.has(event.id))return res.sendStatus(200);
 const sid=event.data?.session_id;
 if(event.data?.type!=='sip'||typeof sid!=='string'||!sid.startsWith('live_'))return res.sendStatus(400);
 const allowed=process.env.ENABLE_TEST_CALLS==='true'&&accepted<maxCalls;
 processed.add(event.id);
 try{
  if(!allowed){await callControl(sid,'reject',{status_code:486});}
  else{
   await callControl(sid,'accept',{session:{type:'live',model:'gpt-live-1',instructions,audio:{output:{voice:'marin'}},delegation:{type:'client'}}});
   accepted++;
   attachSpecialists(sid,client);
   setTimeout(()=>callControl(sid,'hangup').catch(()=>{}),maxSeconds*1000).unref?.();
  }
  return res.sendStatus(200);
 }catch{
  processed.delete(event.id);
  return res.sendStatus(503);
 }
});
app.listen(port,'0.0.0.0',()=>console.log('SLICC pilot on port '+port+'; specialists='+agentList.length+'; phoneConfigured='+phoneConfigured));
