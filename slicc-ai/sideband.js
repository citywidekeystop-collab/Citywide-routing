import WebSocket from 'ws';
import { randomUUID } from 'node:crypto';
import { runRoutedQuestion } from './bots.js';

// GPT-Live client-delegation sideband. Trial only; no transcript persistence.
export function attachSpecialists(sessionId,openai){
  if(!process.env.OPENAI_API_KEY)return null;
  const ws=new WebSocket('wss://api.openai.com/v1/live/sessions/'+encodeURIComponent(sessionId)+'/attach',{
    headers:{Authorization:'Bearer '+process.env.OPENAI_API_KEY}
  });
  let transcript='';
  const handled=new Set();
  let pending=Promise.resolve();
  function send(delegationId,content){
    if(ws.readyState!==WebSocket.OPEN)return;
    ws.send(JSON.stringify({
      type:'session.commentary.append',
      event_id:randomUUID(),delegation_id:delegationId,
      content:String(content||'').slice(0,1400)
    }));
  }
  ws.on('message',(raw)=>{
    let e;try{e=JSON.parse(raw.toString());}catch{return;}
    if(e.type==='session.input_transcript.delta'&&typeof e.delta==='string'){
      transcript=(transcript+e.delta).slice(-2400);
      return;
    }
    if(e.type==='session.delegation.created'){
      const id=e.delegation?.id;
      if(!id||handled.has(id))return;
      handled.add(id);
      const question=transcript.slice(-1200).trim();
      pending=pending.then(async()=>{
        if(!question){
          send(id,'I can explain general court procedures, but I need a general topic first. Please avoid giving private case information.');
          return;
        }
        try{
          const r=await runRoutedQuestion({question,openai});
          send(id,r.agent.name+': '+r.response);
        }catch(err){
          console.error('SLICC specialist error',err?.name||'Unknown');
          send(id,'The specialist is unavailable right now. I cannot verify case-specific laws or deadlines. Please consult current official court resources or a licensed attorney.');
        }
      }).catch(()=>{});
    }
    if(e.type==='session.closed')ws.close();
  });
  ws.on('error',(err)=>console.error('SLICC sideband connection error',err?.code||'unknown'));
  ws.on('close',()=>{transcript='';handled.clear();});
  return ws;
}
