const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const ts=require('typescript');
function load(name, modules, extras={}) {
 const exports={};
 const source=fs.readFileSync(path.join(__dirname, '../src/'+name+'.ts'),'utf8');
 vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require:n=>modules[n]??require(n),process:{env:{OPENAI_API_KEY:'sk-test'}},console,...extras});
 return exports;
}
test('fresh AI questions retain private rubrics, grade using AI, and expire', async()=>{
 let now=1000, calls=0;
 class Clock extends Date {static now(){return now;}}
 const traits=load('traits',{});
 const blueprints=load('assessmentBlueprints',{'./traits.js':traits});
 const generator=load('generatedQuestions',{
  './traits.js':traits,
  './assessmentBlueprints.js':blueprints,
  openai:{default:class{chat={completions:{create:async()=>{
   calls++;
   return {choices:[{message:{content:JSON.stringify({questions:[1,2].map(i=>({type:i===1?'mcq':'open',options:i===1?[{key:'a',text:'A ball',symbol:'⚽',shape:null,points:3},{key:'b',text:'A block',symbol:null,shape:'square',points:1}]:null,answerKey:i===1?'a':null,visual:null,prompt:`What could you try in imaginary situation ${i}?`,skillFacet:`response facet ${i}`,targetEvidence:'The child suggests a relevant response to the situation.',alignmentRationale:'The response directly supplies evidence for the selected category.',rubric:['3 - Clear relevant idea and explanation.','2 - Relevant idea partly explained.','1 - Related idea without explanation.','0 - No interpretable relevant idea.']}))})}}]};
  }}};}},
 },{Date:Clock});
 const round=await generator.generateRound(5,'sensitivity_others',2);
 assert.equal(calls,2);assert.equal(round.length,2);
 assert.ok(generator.generatedQuestionById(round[0].id));
 assert.ok(!('rubric' in generator.publicQuestion(round[0])));
 let graded;
 const scoring=load('scoring',{
 './generatedQuestions.js':generator,'./traits.js':traits,
 './grader.js':{gradeOpenAnswers:async items=>{graded=items;return items.map((it,i)=>({id:it.id,points:2,note:'A relevant suggestion.',...(i===1?{incomplete:true}:{})}));}},
 });
 const report=await scoring.scoreSubmission(round.map(q=>({questionId:q.id,answer:q.type==='mcq'?'b':'I would ask what they need.'})));
 assert.equal(graded.length,1);assert.equal(graded[0].answer,'I would ask what they need.');assert.deepEqual([...graded[0].rubric],[...round[1].rubric]);
 assert.equal(report.traits.length,24);
 assert.equal(report.overall.earned,3);assert.equal(report.overall.possible,6);
 assert.equal(report.responses[0].correct,false);assert.equal(report.responses[0].band,1);
 assert.equal(report.responses[1].band,2);
 assert.equal(report.traits.find(t=>t.key==='sensitivity_others').group,'social_emotional');
 now+=2*60*60*1000+1;
 assert.equal(generator.generatedQuestionById(round[0].id),undefined);
});

test('every category sends its exact blueprint through generation and review', async()=>{
 const calls=[];
 const traits=load('traits',{});
 const blueprints=load('assessmentBlueprints',{'./traits.js':traits});
 const response=JSON.stringify({questions:[1,2].map(i=>({
  type:i===1?'mcq':'open',
  options:i===1?[{key:'a',text:'A ball',symbol:'⚽',shape:null,points:3},{key:'b',text:'A block',symbol:null,shape:'square',points:1}]:null,
  answerKey:i===1?'a':null,visual:null,
  prompt:`Try this different activity number ${i}. What would you choose?`,
  skillFacet:`distinct facet ${i}`,
  targetEvidence:'The child gives an observable response for this category.',
  alignmentRationale:'The response directly demonstrates the requested assessment construct.',
  rubric:['3 - Clear relevant response.','2 - Mostly relevant response.','1 - Partly relevant response.','0 - No interpretable relevant response.'],
 }))});
 const generator=load('generatedQuestions',{
  './traits.js':traits,
  './assessmentBlueprints.js':blueprints,
  openai:{default:class{chat={completions:{create:async request=>{calls.push(request);return {choices:[{message:{content:response}}]};}}};}},
 });
 for(const key of traits.TRAIT_ORDER){
  const before=calls.length;
  const round=await generator.generateRound(7,key,2);
  assert.equal(calls.length,before+2,`${key} should have generation and review passes`);
  assert.ok(round.every(question=>question.trait===key),`${key} was not retained on generated questions`);
  for(const call of calls.slice(before)){
   const payload=JSON.parse(call.messages.at(-1).content);
   assert.equal(payload.category.key,key,`${key} sent the wrong category to AI`);
   assert.equal(JSON.stringify(payload.assessmentBlueprint),JSON.stringify(blueprints.ASSESSMENT_BLUEPRINTS[key]),`${key} sent the wrong blueprint to AI`);
   assert.equal(payload.age,7);
   assert.equal(payload.count,2);
   assert.ok(payload.ageRequirements.guidance.length>20);
  }
  const publicRound=round.map(generator.publicQuestion);
  assert.ok(publicRound.every(question=>question.trait===key));
  assert.ok(publicRound.every(question=>!('rubric' in question)&&!('answerKey' in question)&&!('targetEvidence' in question)));
 }
 assert.equal(calls.length,traits.TRAIT_ORDER.length*2);
});
