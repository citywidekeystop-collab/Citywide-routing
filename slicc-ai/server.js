import express from 'express';
import OpenAI from 'openai';
import { instructions } from './prompt.js';

const app = express();
app.disable('x-powered-by');
const port = Number(process.env.PORT || 10000);
const configured = Boolean(process.env.OPENAI_API_KEY && process.env.OPENAI_WEBHOOK_SECRET);
const maxCalls = Math.min(20,Math.max(1,Number(process.env.MAX_TEST_CALLS || 5)));
const maxSeconds = Math.min(300,Math.max(30,Number(process.env.MAX_CALL_SECONDS || 180)));
let accepted = 0;
const processed = new Set();
const client = configured ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY, webhookSecret: process.env.OPENAI_WEBHOOK_SECRET }) : null;

app.get('/', (_req,res)=>res.type('text').send('SLICC voice demo backend. No real legal advice. Phone integration not active until configured.'));
app.get('/health', (_req,res)=>res.json({service:'slicc-voice-pilot',running:true,configured,acceptingCalls:configured && process.env.ENABLE_TEST_CALLS==='true', acceptedTestCalls:accepted, maxCalls}));

async function action(sessionId,kind,payload){
  const r=await fetch('https://api.openai.com/v1/live/sessions/'+encodeURIComponent(sessionId)+'/'+kind,{
    method:'POST',
    headers:{Authorization:'Bearer '+process.env.OPENAI_API_KEY,'Content-Type':'application/json'},
    body:payload?JSON.stringify(payload):undefined,
    signal:AbortSignal.timeout(15000)
  });
  if(!r.ok){console.error('Live control failed:',kind,r.status);throw new Error('Live control failed: '+r.status);}
}

app.post('/webhooks/openai',express.text({type:'application/json',limit:'128kb'}),async(req,res)=>{
  if(!configured)return res.status(503).send('Not configured');
  let event;
  try{event=await client.webhooks.unwrap(req.body,req.headers);}
  catch{return res.status(400).send('Invalid webhook signature');}
  if(event.type!=='live.transport.incoming')return res.sendStatus(200);
  if(processed.has(event.id))return res.sendStatus(200);
  const sid=event.data?.session_id;
  if(event.data?.type!=='sip'||typeof sid!=='string'||!sid.startsWith('live_'))return res.sendStatus(400);
  // Test-only guard: keep inactive until the owner explicitly enables testing in Render.
  const allowed=process.env.ENABLE_TEST_CALLS==='true' && accepted<maxCalls;
  processed.add(event.id);
  try {
    if(!allowed)await action(sid,'reject',{status_code:486});
    else {
      await action(sid,'accept',{session:{type:'live',model:'gpt-live-1',instructions,audio:{output:{voice:'marin'}},delegation:{type:'client'}}});
      accepted+=1;
      // Bound this proof-of-concept call to limit exposure to unexpected charges.
      setTimeout(()=>{action(sid,'hangup').catch(()=>{});},maxSeconds*1000).unref?.();
    }
    return res.sendStatus(200);
  }catch{
    processed.delete(event.id);
    return res.sendStatus(503);
  }
});
app.listen(port,'0.0.0.0',()=>console.log('SLICC listening on port '+port+', configured='+configured));
