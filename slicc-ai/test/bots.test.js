import test from 'node:test';
import assert from 'node:assert/strict';
import {agentList,agents,getDemo,routeAgent,runSpecialist} from '../bots.js';

test('exactly four specialists are available',()=>{
 assert.equal(agentList.length,4);
 assert.deepEqual(Object.keys(agents),['research','appeals','documents','membership']);
});
test('each specialist has a safe sample answer',()=>{
 for(const a of agentList){
  const demo=getDemo(a.id);
  assert.ok(demo.question);
  assert.ok(demo.response);
  assert.equal(demo.mode,'scripted-demo');
 }
 assert.equal(getDemo('unknown'),null);
});
test('routing chooses appropriate specialist',()=>{
 assert.equal(routeAgent('What is an appeal?'),'appeals');
 assert.equal(routeAgent('Make a document checklist'),'documents');
 assert.equal(routeAgent('What is a rollover minute?'),'membership');
 assert.equal(routeAgent('Explain case law'),'research');
});
test('AI specialist never claims data is verified in its system instructions',async()=>{
 let request;
 const openai={responses:{create:async(input)=>{request=input;return {output_text:'General legal-information test answer.'};}}};
 const result=await runSpecialist({agentId:'research',question:'What is an appeal?',openai});
 assert.equal(result.mode,'ai-pilot');
 assert.equal(request.store,false);
 assert.match(request.instructions,/NO verified current legal database/);
 assert.equal(result.response,'General legal-information test answer.');
});
test('agent refuses empty questions',async()=>{
 await assert.rejects(runSpecialist({agentId:'research',question:'',openai:{}}));
});
