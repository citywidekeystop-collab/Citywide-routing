
(function(){
'use strict';
const input=document.getElementById('key'),panel=document.getElementById('admin-panel'),list=document.getElementById('list'),stats=document.getElementById('stats'),notice=document.getElementById('notice');
let key='';
function message(s,good){notice.textContent=s;notice.className='result '+(good?'good':'bad');notice.hidden=false}
function element(tag,cls,text){const el=document.createElement(tag);if(cls)el.className=cls;if(text!==undefined)el.textContent=text;return el}
async function request(path,opts={}){
 const r=await fetch(path,{...opts,headers:{'x-admin-key':key,'Content-Type':'application/json',...(opts.headers||{})}});
 if(!r.ok)throw new Error(r.status===401?'Admin key incorrect or missing.':'The inbox could not be loaded.');
 return r;
}
async function load(){
 list.replaceChildren();notice.hidden=true;
 try{
  const result=await (await request('/api/admin/inquiries')).json();const items=result.items||[];
  stats.replaceChildren();
  stats.appendChild(element('div','stat','Total inquiries: '+items.length));
  stats.appendChild(element('div','stat','New inquiries: '+items.filter(x=>x.status==='NEW').length));
  for(const r of items){
   const row=element('article','admin-row');
   row.appendChild(element('strong','',r.full_name+' · '+r.requested_service+' · #'+r.id));
   row.appendChild(element('p','',r.business_name||'Business name not specified'));
   row.appendChild(element('p','',r.email+' | '+(r.phone||'No phone')));
   row.appendChild(element('p','',r.requested_package+' | '+r.domain_choice+' | '+(r.preferred_domain||'No domain selected')));
   row.appendChild(element('p','',r.details));
   row.appendChild(element('p','small',new Date(r.created_at).toLocaleString()));
   const action=element('div','admin-action');
   const sel=element('select');
   for(const status of ['NEW','CONTACTED','QUOTED','BOOKED','COMPLETE','CLOSED']){
    const o=element('option','',status);o.value=status;o.selected=r.status===status;sel.appendChild(o);
   }
   const btn=element('button','btn sm','Save status');btn.type='button';
   btn.addEventListener('click',async()=>{btn.disabled=true;try{await request('/api/admin/inquiries/'+encodeURIComponent(r.id),{method:'PATCH',body:JSON.stringify({status:sel.value})});message('Status saved.',true)}catch(e){message(e.message,false)}finally{btn.disabled=false}});
   action.append(sel,btn);row.appendChild(action);list.appendChild(row);
  }
  if(!items.length)list.appendChild(element('p','note','No customer inquiries have been received yet.'));
  const orderContainer=document.getElementById('orders');
  if(orderContainer){
   orderContainer.replaceChildren();
   try{
    const allOrders=(await (await request('/api/admin/orders')).json()).items||[];
    const orders=allOrders.filter(o=>document.getElementById('show-qa')?.checked||!String(o.customer_name||'').startsWith('NLN QA TEST ONLY'));
    if(!orders.length)orderContainer.appendChild(element('p','note','No signed package orders yet.'));
    for(const order of orders){
     const row=element('article','admin-row');
     row.appendChild(element('strong','',order.package_name+' — '+new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(order.amount_cents/100)));
     row.appendChild(element('p','',order.customer_name+' · '+order.email+' · '+(order.phone||'No phone')));
     row.appendChild(element('p','',order.business_name||'Business not specified'));
     row.appendChild(element('p','',('Status: '+order.status)+' · Signed: '+new Date(order.agreed_at).toLocaleString()));
     row.appendChild(element('p','small','Agreement: '+order.agreement_version+' · Signature: '+order.signed_name));
     orderContainer.appendChild(row);
    }
   }catch(e){orderContainer.appendChild(element('p','note','Unable to load signed package orders.'))}
  }
  await loadMarketplace();
  panel.hidden=false;
 }catch(e){message(e.message,false);panel.hidden=true}
}

async function loadMarketplace(){
 const counts=document.getElementById('mp-admin-stats');
 const reqBox=document.getElementById('mp-admin-requests');
 const proBox=document.getElementById('mp-admin-providers');
 if(!counts||!reqBox||!proBox)return;
 counts.replaceChildren();reqBox.replaceChildren();proBox.replaceChildren();
 try{
  const data=await (await request('/api/admin/marketplace')).json();
  const showQA=document.getElementById('show-qa')?.checked;
  const requests=(data.requests||[]).filter(r=>showQA||r.email!=='nln-mp-qa@example.com');
  const pros=(data.providers||[]).filter(p=>showQA||p.email!=='nln-pro-qa@example.com');
  const approved=pros.filter(p=>p.status==='APPROVED');
  counts.appendChild(element('div','stat','Requests: '+requests.length));
  counts.appendChild(element('div','stat','Pending pros: '+pros.filter(p=>p.status==='PENDING').length));
  counts.appendChild(element('div','stat','Approved pros: '+approved.length));
  const matchCounts=new Map((data.potentialMatches||[]).map(x=>[x.id,x.potential_pros]));
  if(!requests.length)reqBox.appendChild(element('p','note','No customer requests received yet.'));
  for(const job of requests){
   const row=element('article','admin-row');
   row.appendChild(element('strong','',job.category+' · '+job.zip_code+' · '+job.timeframe));
   row.appendChild(element('p','',job.full_name+' · '+job.email+' · '+job.phone));
   row.appendChild(element('p','',job.details));
   row.appendChild(element('p','small','Status: '+job.status+' · '+new Date(job.created_at).toLocaleString()));
   row.appendChild(element('p','small','Matching verified pros: '+(matchCounts.get(job.id)||0)));
   const matchingPros=approved.filter(p=>p.categories.includes(job.category)&&p.zip_codes.includes(job.zip_code));
   if(matchingPros.length){
    const select=element('select');
    for(const p of matchingPros){const o=element('option','',p.business_name+' · '+p.city+', '+p.state);o.value=p.id;select.appendChild(o)}
    const btn=element('button','btn sm','Record candidate');btn.type='button';
    btn.addEventListener('click',async()=>{
     btn.disabled=true;
     try{
      await request('/api/admin/marketplace/matches',{method:'POST',body:JSON.stringify({requestId:job.id,providerId:select.value})});
      message('Internal candidate recorded. Customer/pro notifications still require manual follow-up.',true);
     }catch(e){message(e.message,false)}
     finally{btn.disabled=false}
    });
    row.append(select,btn);
   }
   reqBox.appendChild(row);
  }
  if(!pros.length)proBox.appendChild(element('p','note','No professional applications received yet.'));
  for(const pro of pros){
   const row=element('article','admin-row');
   row.appendChild(element('strong','',pro.business_name+' · '+pro.status));
   row.appendChild(element('p','',pro.contact_name+' · '+pro.email+' · '+pro.phone));
   row.appendChild(element('p','',pro.city+', '+pro.state+' · ZIP codes: '+pro.zip_codes.join(', ')));
   row.appendChild(element('p','',pro.categories.join(', ')));
   if(pro.website)row.appendChild(element('p','',pro.website));
   if(pro.license_details)row.appendChild(element('p','', 'License information: '+pro.license_details));
   if(pro.notes)row.appendChild(element('p','',pro.notes));
   row.appendChild(element('p','small','Applied: '+new Date(pro.created_at).toLocaleString()));
   const opts=element('select');
   for(const status of ['PENDING','APPROVED','REJECTED']){
    const o=element('option','',status);o.value=status;o.selected=status===pro.status;opts.appendChild(o);
   }
   const note=element('textarea');note.rows=2;note.maxLength=1200;
   note.placeholder='Verification review notes (required to approve)';
   note.value=pro.review_note||'';
   const btn=element('button','btn sm','Save review');btn.type='button';
   btn.addEventListener('click',async()=>{
    if(opts.value==='APPROVED'&&note.value.trim().length<15){
     message('Record how you verified this business before approving.',false);return;
    }
    btn.disabled=true;
    try{
     await request('/api/admin/marketplace/providers/'+encodeURIComponent(pro.id),{
      method:'PATCH',body:JSON.stringify({status:opts.value,reviewNote:note.value})
     });
     message('Provider review saved.',true);
     await loadMarketplace();
    }catch(e){message(e.message,false)}
    finally{btn.disabled=false}
   });
   const control=element('div','stack');control.append(opts,note,btn);row.appendChild(control);proBox.appendChild(row);
  }
 }catch(e){counts.appendChild(element('p','note','Could not load Marketplace records.'))}
}

document.getElementById('unlock').addEventListener('click',()=>{key=input.value.trim();if(!key){message('Enter your administrator key.',false);return}load()});
document.getElementById('refresh').addEventListener('click',load);
document.getElementById('show-qa')?.addEventListener('change',load);
document.getElementById('export').addEventListener('click',async()=>{
 try{const r=await request('/api/admin/export.csv');const blob=await r.blob();const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='nln-business-inquiries.csv';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)}catch(e){message(e.message,false)}
});
})();
