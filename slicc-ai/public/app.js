const icons={
 research:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v17M5 7h14M7 7l-4 7h8L7 7Zm10 0-4 7h8l-4-7ZM9 21h6"/></svg>',
 appeals:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m3 10 9-7 9 7M4 10h16M5 10v9m5-9v9m4-9v9m5-9v9M3 21h18M2 19h20"/></svg>',
 documents:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Zm0 0v6h6M8 13h8M8 17h8"/></svg>',
 membership:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="8" r="3"/><path d="M2 21v-2a7 7 0 0 1 14 0v2M17 6a3 3 0 0 1 0 6m4 9v-2a6 6 0 0 0-4-5.65"/></svg>'
};
let current='research', last=null;
async function load(){
 try{
  const r=await fetch('/api/bots');const data=await r.json();
  const cards=document.querySelector('#cards');
  data.agents.forEach(a=>{
   const item=document.createElement('article');item.className='agent';item.dataset.id=a.id;
   const icon=document.createElement('div');icon.className='symbol';icon.innerHTML=icons[a.id]||'';
   const h=document.createElement('h2');h.textContent=a.name;
   const p=document.createElement('p');p.textContent=a.description;
   const btn=document.createElement('button');btn.type='button';btn.textContent='Preview specialist';btn.addEventListener('click',()=>select(a.id));
   item.append(icon,h,p,btn);cards.appendChild(item);
  });await select('research');
 }catch{document.querySelector('#answer').textContent='Preview temporarily unavailable. Try reloading the page.';}
}
async function select(id){
 current=id;
 document.querySelectorAll('.agent').forEach(c=>c.classList.toggle('active',c.dataset.id===id));
 const r=await fetch('/api/demo/'+encodeURIComponent(id)); if(!r.ok)throw new Error('Demo unavailable');
 const item=await r.json();last=item;
 document.querySelector('#botTitle').textContent=item.agent.name;
 document.querySelector('#question').textContent=item.question;
 document.querySelector('#answer').textContent=item.response;
 document.querySelector('#mode').textContent='SCRIPTED DEMO';
}
document.querySelector('#print').addEventListener('click',()=>window.print());
document.querySelector('#copy').addEventListener('click',async()=>{
 if(!last)return;
 const text='SLICC sample (not legal advice)\n'+last.question+'\n\n'+last.response;
 try{await navigator.clipboard.writeText(text);document.querySelector('#copy').textContent='Copied';setTimeout(()=>document.querySelector('#copy').textContent='Copy example',1200);}catch{document.querySelector('#copy').textContent='Copy unavailable';}
});
load();