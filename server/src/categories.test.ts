import test from 'node:test';
import assert from 'node:assert/strict';
import { validateGeneratedRound, publicQuestion, ageRules } from './generatedQuestions.js';
import { TRAIT_ORDER, TRAITS } from './traits.js';
const rubric=['3 - Relevant idea with a reason.','2 - Relevant idea partly explained.','1 - Related idea without a reason.','0 - No interpretable relevant idea.'];
const item=(n:number)=>({type:n%2===0?'mcq':'open',prompt:`Look at these objects in puzzle ${n}. What would you pick?`,rubric,visual:null,options:n%2===0?[{key:'a',text:'A ball',symbol:'⚽',shape:null,points:3},{key:'b',text:'A block',symbol:null,shape:'square',points:1}]:null,answerKey:n%2===0?'a':null});
test('all category groups retain image order',()=>{
 assert.equal(TRAIT_ORDER.length,24);
 assert.deepEqual(TRAIT_ORDER.slice(8,14),['perfectionism','strong_ideas','questions_authority','motivation_focus','humor','sensitivity_others']);
 assert.deepEqual(TRAIT_ORDER.slice(14,19),['extensive_vocabulary','advanced_reading','self_motivated_writing','viewpoint_mood_intention','advanced_spelling']);
 assert.deepEqual(TRAIT_ORDER.slice(19),['how_things_work','mental_math','strategy_games','categories_hierarchies','intuitive_problem_solving']);
 assert.equal(TRAITS.extensive_vocabulary.group,'verbal_linguistic');
 assert.equal(TRAITS.mental_math.group,'logical_mathematical');
});
test('rounds enforce exact count, interaction variety and matching choice keys',()=>{
 for(const count of [2,5,6])assert.equal(validateGeneratedRound(JSON.stringify({questions:Array.from({length:count},(_,i)=>item(i))}),count,5).length,count);
 assert.throws(()=>validateGeneratedRound(JSON.stringify({questions:[item(1),item(3)]}),2));
 assert.throws(()=>validateGeneratedRound(JSON.stringify({questions:[item(0),item(0)]}),2));
 assert.throws(()=>validateGeneratedRound(JSON.stringify({questions:[{...item(0),answerKey:'z'},item(1)]}),2));
 assert.throws(()=>validateGeneratedRound(JSON.stringify({questions:[item(0)]}),5));
});
test('age limits reject long prompts and choices and missing picture variety',()=>{
 assert.equal(ageRules(5).maxOptions,3);
 assert.throws(()=>validateGeneratedRound(JSON.stringify({questions:[{...item(0),prompt:'word '.repeat(36)},item(1)]}),2,5));
 assert.throws(()=>validateGeneratedRound(JSON.stringify({questions:[{...item(0),options:[{key:'a',text:'a '.repeat(7),symbol:'⚽',shape:null},{key:'b',text:'Block',symbol:'🧱',shape:null}]},item(1)]}),2,5));
 assert.throws(()=>validateGeneratedRound(JSON.stringify({questions:[{...item(0),options:item(0).options!.map(o=>({...o,symbol:null,shape:null}))},item(1)]}),2,5));
});
test('picture choices stay visible while rubrics and keys stay private',()=>{
 const q=publicQuestion({id:'test',trait:'observant',type:'mcq',format:'classification',ageBand:[5,5],weight:1,prompt:'Which one is round?',rubric,answerKey:'a',optionScores:{a:3,b:1},options:[{key:'a',text:'Ball',symbol:'⚽'},{key:'b',text:'Block',figure:{shapes:[{kind:'square',fill:'solid'}]}}]});
 assert.equal(q.type,'mcq');assert.equal(q.options![0]!.symbol,'⚽');assert.ok(q.options![1]!.figure);assert.ok(!('rubric' in q));assert.ok(!('answerKey' in q));assert.ok(!('optionScores' in q));assert.match(q.speechText,/Ball, Block/);
});
