(async function(){
'use strict';
const message=document.getElementById('order-status'),heading=document.getElementById('order-heading');
const sessionId=new URLSearchParams(location.search).get('session_id');
if(!sessionId){heading.textContent='Order details';message.textContent='Choose a package to start your project.';return}
try{
 const r=await fetch('/api/payment-status?session_id='+encodeURIComponent(sessionId),{credentials:'same-origin'});
 const status=await r.json();
 if(!r.ok||!status.ok)throw Error(status.message||'We could not verify the payment yet.');
 if(status.status==='PAID'){
   heading.textContent='Payment confirmed';
   message.textContent='Your payment was verified. NLN will contact you to begin onboarding your project.';
 }else{
   heading.textContent='Payment verification in progress';
   message.textContent='Your payment is being verified securely. Keep your Stripe receipt for reference.';
 }
}catch(e){heading.textContent='Confirmation pending';message.textContent='We cannot verify the payment status yet. Please use the receipt or contact NLN for assistance.'}
})();