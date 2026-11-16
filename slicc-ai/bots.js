// SLICC test agents. No verified court-law database, customer records or payment processor is connected.
export const agents = {
  research: {
    id: 'research', name: 'Legal Research', icon: 'scale',
    description: 'Explains general legal concepts and routes jurisdiction-specific research for human verification.',
    instructions: 'Explain general criminal-law terminology in plain English. You have no verified live source library. Never invent a statute, citation, case, rule, deadline or interpretation. When asked for law specific to a state or a case, state that you cannot verify it and direct the user to the official court or a licensed attorney.'
  },
  appeals: {
    id: 'appeals', name: 'Appeals & Court Procedures', icon: 'landmark',
    description: 'Explains appeals, sentencing and post-conviction concepts without guessing deadlines.',
    instructions: 'Explain general procedural concepts and questions a person might bring to a lawyer. Do not calculate filing deadlines, predict outcomes or give individual case strategy. Urgent case deadlines require immediate consultation with a licensed lawyer and current official court rules.'
  },
  documents: {
    id: 'documents', name: 'Documents & Print Center', icon: 'file-text',
    description: 'Creates educational outlines and non-filing checklists for printing.',
    instructions: 'Prepare only educational outlines and lawyer-meeting checklists, never final court filings, legal advice, signatures or invented case citations. Do not claim a PDF was created or shared without verified tools and permission. Do not send documents to families.'
  },
  membership: {
    id: 'membership', name: 'Family Membership Support', icon: 'users',
    description: 'Explains hypothetical subscriptions, rollover minutes and family account features.',
    instructions: 'Explain SLICC product concepts as proposals only: no real account, payment, usage, subscriber, rollover balance or pricing is connected. Do not claim subscriptions, charges, refunds or changes were processed. Never expose inmate information to a relative absent explicit verified authorization.'
  }
};
export const agentList = Object.values(agents).map(({id,name,icon,description})=>({id,name,icon,description}));
const demos={
  research: {
    question:'What is the difference between a statute and a court opinion?',
    response:'A statute is a law passed by a legislature. A court opinion explains how judges resolved a particular legal dispute and may interpret statutes. Which authorities matter depends on the court and jurisdiction. This demonstration has no connected legal-source library, so it cannot verify specific state laws or cases.'
  },
  appeals: {
    question:'What is a notice of appeal?',
    response:'A notice of appeal is generally a formal document telling a court that someone wants appellate review of a decision. Requirements and deadlines vary by court and case type. Never use this demonstration to calculate a deadline; check current official court rules and speak with a licensed attorney promptly.'
  },
  documents: {
    question:'Can you make a checklist to prepare for meeting an attorney?',
    response:'Educational checklist (not a court filing): 1. Write down the court and case type without entering private information here. 2. Gather copies of orders and correspondence. 3. List questions about procedures and next steps. 4. Ask the attorney to verify deadlines. 5. Confirm what you can safely share. In a future authorized system, this checklist could be printable.'
  },
  membership: {
    question:'How would rollover minutes work for family subscriptions?',
    response:'Proposed feature: unused included minutes can carry into the next billing cycle, subject to a clearly disclosed rollover cap and expiration policy. This demonstration is not connected to subscriptions, account balances, correctional phone minutes or payment processing.'
  }
};
export function getDemo(agentId){
  const agent=agents[agentId];if(!agent)return null;
  return {agent:{id:agent.id,name:agent.name}, ...demos[agentId],mode:'scripted-demo',disclaimer:'Fictional demonstration only. Not legal advice. No current legal sources, accounts, or prison phone systems are connected.'};
}
export function routeAgent(message){
  const s=String(message||'').toLowerCase();
  if(/\b(payment|subscription|rollover|minutes|billing|renew|family|plan|refund|account)\b/.test(s))return 'membership';
  if(/\b(print|document|form|letter|packet|paperwork|checklist|pdf|draft)\b/.test(s))return 'documents';
  if(/\b(appeal|sentence|sentencing|post.conviction|hearing|filing deadline|petition|motion|trial court|procedure)\b/.test(s))return 'appeals';
  return 'research';
}
const sharedSafety=String.raw\`You are a SLICC pilot AI assisting with general U.S. legal education, NOT legal advice.
Do not request or repeat private case details, contact information, inmate numbers, or identifying data.
This pilot has NO verified current legal database or court docket. NEVER claim you reviewed a law or case or that a citation is verified. Do not invent authorities or deadlines; explicitly say when verification is required.
Do not recommend individual case strategy, predict outcomes, or claim attorney-client privilege.
For potentially urgent deadlines, tell the user to promptly consult official court rules and a licensed attorney.
Keep responses under 140 words and easy to understand on a telephone.
Never claim that any payment, print, sharing, saved record, or attorney referral was completed.
\`;
export async function runSpecialist({agentId,question,openai,model=process.env.SLICC_TEXT_MODEL||'gpt-5.4-mini'}){
  if(!agents[agentId])throw new Error('Unknown specialist');
  const q=String(question||'').trim();
  if(!q||q.length>1200)throw new Error('Enter a question up to 1200 characters');
  if(!openai)throw new Error('OpenAI project is not yet configured');
  const result=await openai.responses.create({
    model, store:false, max_output_tokens:350,
    instructions:sharedSafety+'\\nSpecialist role: '+agents[agentId].instructions,
    input:q
  },{timeout:25000,maxRetries:0});
  const reply=(result.output_text||'').trim();
  if(!reply)throw new Error('No specialist response');
  return {agent:{id:agentId,name:agents[agentId].name},response:reply,mode:'ai-pilot',disclaimer:'AI-generated general information. Not checked against current law. Not legal advice.'};
}
export async function runRoutedQuestion({question,openai}){
  const agentId=routeAgent(question);
  return runSpecialist({agentId,question,openai});
}
