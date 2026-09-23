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
 const generator=load('generatedQuestions',{
  './traits.js':traits,
  openai:{default:class{chat={completions:{create:async()=>{
   calls++;
   return {choices:[{message:{content:JSON.stringify({questions:[1,2].map(i=>({type:i===1?'mcq':'open',options:i===1?[{key:'a',text:'A ball',symbol:'⚽',shape:null},{key:'b',text:'A block',symbol:null,shape:'square'}]:null,answerKey:i===1?'a':null,visual:null,prompt:`What could you try in imaginary situation ${i}?`,rubric:['3 - Clear relevant idea and explanation.','2 - Relevant idea partly explained.','1 - Related idea without explanation.','0 - No interpretable relevant idea.']}))})}}]};
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
 const report=await scoring.scoreSubmission(round.map(q=>({questionId:q.id,answer:q.type==='mcq'?'a':'I would ask what they need.'})));
 assert.equal(graded.length,1);assert.equal(graded[0].answer,'I would ask what they need.');assert.deepEqual([...graded[0].rubric],[...round[1].rubric]);
 assert.equal(report.traits.length,14);
 assert.equal(report.overall.earned,5);assert.equal(report.overall.possible,6);
 assert.equal(report.responses[0].correct,true);
 assert.equal(report.responses[1].band,2);
 assert.equal(report.traits.find(t=>t.key==='sensitivity_others').group,'social_emotional');
 now+=2*60*60*1000+1;
 assert.equal(generator.generatedQuestionById(round[0].id),undefined);
});
