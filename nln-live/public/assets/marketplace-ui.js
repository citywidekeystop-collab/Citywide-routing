(function(){
'use strict';
const customer=document.getElementById('mp-customer-form');
const provider=document.getElementById('mp-provider-form');
const active=customer||provider;
if(!active)return;
const endpoint=customer?'/api/marketplace/request':'/api/marketplace/provider';
const result=document.getElementById(customer?'mp-customer-result':'mp-provider-result');
const button=active.querySelector('button[type="submit"]');
let categories=[];
async function setup(){
 try{
  const response=await fetch('/api/marketplace/categories',{credentials:'same-origin'});
  if(!response.ok)throw new Error('Service category list unavailable.');
  const data=await response.json();
  categories=data.categories;
  if(customer){
   const selection=document.getElementById('mp-customer-category');
   for(const category of categories){
    const option=document.createElement('option');option.value=category;option.textContent=category;selection.appendChild(option);
   }
   const requested=new URLSearchParams(location.search).get('category');
   if(requested&&categories.includes(requested))selection.value=requested;
  }
 }catch(_){
  result.hidden=false;result.className='mp-status bad';
  result.textContent='Service categories are unavailable right now. Please try again later.';
  button.disabled=true;
 }
}
active.addEventListener('submit',async event=>{
 event.preventDefault();
 if(!active.reportValidity())return;
 const inputs=Object.fromEntries(new FormData(active).entries());
 const cats=provider?Array.from(active.querySelectorAll('input[name="categories"]:checked')).map(x=>x.value):[];
 if(provider&&cats.length===0){
  result.hidden=false;result.className='mp-status bad';
  result.textContent='Select at least one type of service you offer.';return;
 }
 const payload=customer?{
  category:String(inputs.category||''),
  zip:String(inputs.zip||'').trim(),
  timeframe:String(inputs.timeframe||''),
  name:String(inputs.name||'').trim(),
  email:String(inputs.email||'').trim(),
  phone:String(inputs.phone||'').trim(),
  details:String(inputs.details||'').trim(),
  consent:active.elements.namedItem('consent').checked,
  website:inputs.website||''
 }:{
  business:String(inputs.business||'').trim(),
  name:String(inputs.name||'').trim(),
  email:String(inputs.email||'').trim(),
  phone:String(inputs.phone||'').trim(),
  city:String(inputs.city||'').trim(),
  state:String(inputs.state||'').trim(),
  zipCodes:String(inputs.zipCodes||'').trim(),
  categories:cats,
  businessWebsite:String(inputs.businessWebsite||'').trim(),
  license:String(inputs.license||'').trim(),
  notes:String(inputs.notes||'').trim(),
  consent:active.elements.namedItem('consent').checked,
  website:inputs.website||''
 };
 button.disabled=true;
 const label=button.textContent;
 button.textContent='Submitting…';
 result.hidden=true;
 try{
  const response=await fetch(endpoint,{
   method:'POST',credentials:'same-origin',
   headers:{'Content-Type':'application/json','Accept':'application/json'},
   body:JSON.stringify(payload)
  });
  const body=await response.json();
  if(!response.ok||!body.ok)throw new Error(body.message||'Your information could not be saved.');
  result.hidden=false;result.className='mp-status good';
  result.textContent=body.message+(body.id?' Reference: '+body.id.slice(0,8).toUpperCase()+'.':'');
  active.prepend(result);
  result.setAttribute('tabindex','-1');
  result.focus({preventScroll:true});
  result.scrollIntoView({behavior:'smooth',block:'center'});
  button.textContent='Received';
 }catch(e){
  result.hidden=false;result.className='mp-status bad';
  result.textContent=e.message||'Unable to save right now.';
  button.textContent=label;button.disabled=false;
 }
});
setup();
})();