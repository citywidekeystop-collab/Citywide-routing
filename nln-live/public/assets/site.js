
(function(){
'use strict';
const menu=document.getElementById('menu-toggle');
if(menu) menu.addEventListener('click',()=>{const nav=document.getElementById('topnav');const open=nav.classList.toggle('open');menu.setAttribute('aria-expanded',String(open))});
const form=document.getElementById('lead-form');
if(!form)return;
const params=new URLSearchParams(location.search);
const service=form.elements.namedItem('service');
const requestedService=new Map([
 ['branding','Logo & Branding'],
 ['leads','Lead Capture & Campaign Setup']
]).get(params.get('service'));
if(service && requestedService) service.value=requestedService;

const choice=form.elements.namedItem('package');
if(choice&&params.has('package')&&Array.from(choice.options).some(x=>x.value===params.get('package')))choice.value=params.get('package');
const result=document.getElementById('result');
form.addEventListener('submit',async ev=>{
 ev.preventDefault();
 if(!form.reportValidity())return;
 const button=form.querySelector('button[type="submit"]');button.disabled=true;button.textContent='Sending request…';
 result.textContent='';result.className='result';result.hidden=true;
 try{
  const raw=Object.fromEntries(new FormData(form).entries());
  const payload={
   name:String(raw.name||'').trim(),business:String(raw.business||'').trim(),
   email:String(raw.email||'').trim(),phone:String(raw.phone||'').trim(),
   service:String(raw.service||''),package:String(raw.package||''),
   domainChoice:String(raw.domainChoice||'later'),domainName:String(raw.domainName||'').trim(),
   details:String(raw.details||'').trim(),consent:form.elements.namedItem('consent').checked,
   website:String(raw.website||''),source:location.pathname
  };
  const response=await fetch('/api/inquiries',{method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json'},body:JSON.stringify(payload),credentials:'same-origin'});
  const answer=await response.json();
  if(!response.ok||!answer.ok)throw new Error(answer.message||'Unable to submit the request.');
  form.reset();
  result.hidden=false;result.className='result good';result.textContent='Request received! Your reference is #'+answer.id+'. We will review your project details.';
 }catch(err){result.hidden=false;result.className='result bad';result.textContent=err.message||'Unable to send. Please try again.'}
 finally{button.disabled=false;button.textContent='Send My Message'}
});
})();

(function installLiveChat() {
  if (/^\/(?:admin|start|order-confirmation|checkout|payment)(?:[/.]|$)/i.test(location.pathname)) return;
  window.Tawk_API = window.Tawk_API || {};
  window.Tawk_LoadStart = new Date();
  const widget = document.createElement('script');
  widget.async = true;
  widget.src = 'https://embed.tawk.to/6b04bd9f8e6f59d4de49986f/1k8589dn6';
  widget.crossOrigin = 'anonymous';
  document.head.appendChild(widget);
})();
