
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
  panel.hidden=false;
 }catch(e){message(e.message,false);panel.hidden=true}
}
document.getElementById('unlock').addEventListener('click',()=>{key=input.value.trim();if(!key){message('Enter your administrator key.',false);return}load()});
document.getElementById('refresh').addEventListener('click',load);
document.getElementById('export').addEventListener('click',async()=>{
 try{const r=await request('/api/admin/export.csv');const blob=await r.blob();const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='nln-business-inquiries.csv';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)}catch(e){message(e.message,false)}
});
})();
