
(function(){
'use strict';
const menu=document.getElementById('menu-toggle');
if(menu) menu.addEventListener('click',()=>{const nav=document.getElementById('topnav');const open=nav.classList.toggle('open');menu.setAttribute('aria-expanded',String(open))});
const form=document.getElementById('lead-form');
if(!form)return;
const params=new URLSearchParams(location.search);
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
 finally{button.disabled=false;button.textContent='Request My Free Consultation'}
});
})();
