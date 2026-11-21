(function(){
'use strict';
const picker=document.getElementById('package-picker');
const form=document.getElementById('order-form');
const result=document.getElementById('agreement-result');
const btn=document.getElementById('start-order-button');
const planTitle=document.getElementById('selected-plan-title');
const total=document.getElementById('package-total');
const featureList=document.getElementById('plan-features');
const agreementText=document.getElementById('agreement-text');
const versionText=document.getElementById('agreement-version');
let data=null;
const requestKey=window.crypto?.randomUUID?.()||('00000000-0000-4000-8000-'+Math.random().toString(16).slice(2).padEnd(12,'0').slice(0,12));
const money=cents=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(cents/100);
function text(el,value){el.textContent=value}
function renderPlan(){
 const p=data?.packages.find(x=>x.name===picker.value);
 text(planTitle,p?p.name:'Select a Package');
 text(total,p?money(p.cents):'');
 featureList.replaceChildren();
 if(p)for(const item of p.details){const li=document.createElement('li');li.textContent=item;featureList.appendChild(li)}
 btn.disabled=!p;
}
async function init(){
 try{
  const r=await fetch('/api/packages',{credentials:'same-origin'});
  if(!r.ok)throw Error('Unable to load packages');
  data=await r.json();
  for(const p of data.packages){const opt=document.createElement('option');opt.value=p.name;opt.textContent=p.name+' — '+money(p.cents);picker.appendChild(opt)}
  const requested=new URLSearchParams(location.search).get('package');
  if(requested && data.packages.some(x=>x.name===requested))picker.value=requested;
  versionText.textContent='Agreement version: '+data.agreementVersion;
  agreementText.textContent=data.agreementText;
  renderPlan();
 }catch(e){result.hidden=false;result.className='result bad';text(result,'Unable to load the agreement. Please try again later.')}
}
picker.addEventListener('change',renderPlan);
form.addEventListener('submit',async ev=>{
 ev.preventDefault();
 if(!data||!picker.value||!form.reportValidity())return;
 const b=Object.fromEntries(new FormData(form).entries());
 const name=String(b.name||'').trim(),signedName=String(b.signedName||'').trim();
 if(name.toLocaleLowerCase()!==signedName.toLocaleLowerCase()){
  result.hidden=false;result.className='result bad';text(result,'Your electronic signature must match your legal name above.');return;
 }
 const payload={name,email:b.email,business:b.business||'',phone:b.phone||'',package:picker.value,signedName,
  agreed:form.elements.namedItem('agreed').checked,eSignConsent:form.elements.namedItem('eSignConsent').checked,privacyConsent:form.elements.namedItem('privacyConsent').checked,
  agreementVersion:data.agreementVersion,idempotencyKey:requestKey,website:b.website||''};
 btn.disabled=true;text(btn,'Recording agreement…');
 result.hidden=true;
 try{
  const r=await fetch('/api/checkout/start',{method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json'},credentials:'same-origin',body:JSON.stringify(payload)});
  const body=await r.json();
  if(!r.ok||!body.ok)throw Error(body.message||'Unable to record your agreement.');
  if(body.next==='stripe_checkout' && body.url){
    const url=new URL(body.url);
    if(url.protocol!=='https:' || url.hostname!=='checkout.stripe.com')throw Error('Secure payment URL could not be verified.');
    window.location.assign(url.toString());return;
  }
  result.hidden=false;result.className='result good';
  text(result,body.message||'Your signed package agreement was recorded.');
  btn.hidden=true;
 }catch(e){result.hidden=false;result.className='result bad';text(result,e.message||'Unable to continue.');btn.disabled=false;text(btn,'Sign Agreement & Continue')}
});
init();
})();