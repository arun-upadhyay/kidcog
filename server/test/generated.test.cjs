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

// ---- validation and repair: rounds must not be thrown away for fixable reasons ----
function fixtures(){
 const rubric=['3 - Clear relevant idea and explanation.','2 - Relevant idea partly explained.','1 - Related idea without explanation.','0 - No interpretable relevant idea.'];
 const common={visual:null,targetEvidence:'The child picks the item that fits the rule.',alignmentRationale:'Choosing the match shows the child applied the rule.',rubric};
 // Deliberately NO pictures on any option: pictures are optional now.
 const mcq=(extra={})=>({...common,type:'mcq',prompt:'Which of these animals can swim in the water?',skillFacet:'rule application',answerKey:'a',
  options:[{key:'a',text:'Fish',symbol:null,shape:null,points:3},{key:'b',text:'Cat',symbol:null,shape:null,points:0},{key:'c',text:'Dog',symbol:null,shape:null,points:1}],...extra});
 const open={...common,type:'open',prompt:'What would you pack for a trip to the beach?',skillFacet:'planning ahead',options:null,answerKey:null};
 const round=(...items)=>JSON.stringify({questions:items});
 const bad=round(mcq({options:[{key:'a',text:'Fish',symbol:null,shape:null,points:3},{key:'b',text:'Fish',symbol:null,shape:null,points:0}]}),open);
 return {mcq,open,round,bad,good:round(mcq(),open)};
}
function loadGenerator(create,extras={}){
 const traits=load('traits',{});
 const blueprints=load('assessmentBlueprints',{'./traits.js':traits});
 return load('generatedQuestions',{'./traits.js':traits,'./assessmentBlueprints.js':blueprints,
  openai:{default:class{chat={completions:{create}}}}},{console:{info(){},warn(){},log(){},error(){}},...extras});
}

test('a round with no pictures at all is accepted', () => {
 // This exact case failed with "Round must mix picture choices, multiple
 // choice, and spoken answers." Pictures are optional; the open/mcq mix is not.
 const {good}=fixtures();
 const g=loadGenerator(async()=>{throw new Error('no model call expected');});
 assert.equal(g.validateGeneratedRound(good,2,5).length,2);
 const {mcq,round}=fixtures();
 assert.throws(()=>g.validateGeneratedRound(round(mcq(),mcq({prompt:'Which of these things can fly up high?',skillFacet:'other facet'})),2,5),
  /at least 1 multiple-choice and 1 spoken question\(s\); got 2 and 0/);
});

test('mechanical slips are corrected instead of discarding the round', () => {
 const {mcq,open,round}=fixtures();
 const g=loadGenerator(async()=>{throw new Error('no model call expected');});
 const messy=mcq({answerKey:'"A"',visual:'draw a sun',
  options:[{key:'a',text:'Fish',symbol:'fish card',shape:null,points:2},{key:'b',text:'Cat',symbol:null,shape:null,points:0},{key:'c',text:'Dog',symbol:null,shape:null,points:1}],
  rubric:['0- Nothing relevant here.','1 – Related but unexplained.','2: Relevant, partly explained.','3 - Clear idea with a reason.']});
 const [q]=g.validateGeneratedRound(round(messy,open),2,5);
 assert.equal(q.answerKey,'a');
 assert.equal(q.options[0].points,3);          // clear favourite given full points
 assert.equal(q.options[0].symbol,null);       // "fish card" is not a picture
 assert.equal(q.visual,null);
 // Array.from: the rebuilt array comes from the test sandbox's realm.
 assert.deepEqual(Array.from(q.rubric,b=>b.slice(0,4)),['3 - ','2 - ','1 - ','0 - ']);
 // A tie for best answer is a content question, so it is NOT silently fixed.
 const tie=mcq({options:[{key:'a',text:'Fish',symbol:null,shape:null,points:2},{key:'b',text:'Duck',symbol:null,shape:null,points:2},{key:'c',text:'Dog',symbol:null,shape:null,points:0}]});
 assert.throws(()=>g.validateGeneratedRound(round(tie,open),2,5),/Question 1 \(mcq\): The best answer must be the only 3-point choice/);
});

test('errors name the question so the repair knows what to fix', () => {
 const {mcq,open,round,bad}=fixtures();
 const g=loadGenerator(async()=>{throw new Error('no model call expected');});
 assert.throws(()=>g.validateGeneratedRound(bad,2,5),/^Error: Question 1 \(mcq\): Duplicate choices/);
 assert.throws(()=>g.validateGeneratedRound(round(open,mcq({answerKey:'z'})),2,5),/^Error: Question 2 \(mcq\): Invalid choices/);
});

test('the format sent to OpenAI forces four rubric bands and two to four choices', () => {
 // Before, the schema allowed any number of bands while validation demanded
 // exactly four, so a round could be well-formed for OpenAI and still fail.
 let sent;
 const g=loadGenerator(async req=>{sent=req.response_format.json_schema.schema;return {choices:[{message:{content:fixtures().good}}]};});
 return g.generateRound(5,'sensitivity_others',2).then(()=>{
  const item=sent.properties.questions.items.properties;
  assert.equal(item.rubric.minItems,4); assert.equal(item.rubric.maxItems,4);
  assert.equal(item.options.minItems,2); assert.equal(item.options.maxItems,4);
 });
});

test('repair gets a second attempt, each fed the latest failure', async () => {
 const {bad,good}=fixtures(); const seen=[]; let calls=0;
 const g=loadGenerator(async req=>{
  calls++; const user=JSON.parse(req.messages[1].content);
  if(user.validationFailure) seen.push(user.validationFailure);
  return {choices:[{message:{content:calls<4?bad:good}}]};
 });
 assert.equal((await g.generateRound(5,'sensitivity_others',2)).length,2);
 assert.equal(calls,4); assert.equal(seen.length,2);
 assert.match(seen[0],/Question 1 \(mcq\): Duplicate choices/);
});

test('repair stops after two attempts, and never starts once time is short', async () => {
 const {bad}=fixtures(); let calls=0;
 const g=loadGenerator(async()=>{calls++;return {choices:[{message:{content:bad}}]};});
 await assert.rejects(g.generateRound(5,'sensitivity_others',2),/Duplicate choices/);
 assert.equal(calls,4); // generate + review + 2 repairs

 let now=0; calls=0;
 class Clock extends Date {static now(){return now;}}
 const slow=loadGenerator(async()=>{calls++; now+=100_000; return {choices:[{message:{content:bad}}]};},{Date:Clock});
 await assert.rejects(slow.generateRound(5,'sensitivity_others',2),/Duplicate choices/);
 assert.equal(calls,2); // 200s already spent: a repair could not finish before the app gives up
});
