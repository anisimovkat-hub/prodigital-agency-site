const assert=require('node:assert/strict');
const {tracks,questions,evaluate,profiles}=require('./model.js');
const paths=require('./paths.js');
assert.equal(tracks.length,16);
assert.equal(questions.length,27);
assert.deepEqual(Object.keys(profiles).sort(),tracks.map(t=>t.id).sort());
assert.deepEqual(Object.keys(paths).sort(),tracks.map(t=>t.id).sort());
for(const track of tracks){assert.equal(track.roles.length,3);assert.ok(track.study.length>=3&&track.read.length>=3&&track.try&&paths[track.id].jobs&&paths[track.id].clients&&paths[track.id].youtube&&paths[track.id].portfolio)}
const answersFor=dimension=>[...questions.slice(0,18).map(q=>q.dimension===dimension?0:2),...Array(6).fill(3),['none'],0,2];
for(const dimension of 'RIASEC'){
 const result=evaluate(answersFor(dimension));
 assert.equal(result.uncertain,false,dimension);
 assert.ok(result.primary.length>=1&&result.primary.length<=3,dimension);
 assert.equal(result.dimensions[dimension],1);
}
const noSignal=[...Array(18).fill(3),...Array(6).fill(3),['none'],0,3];
assert.equal(evaluate(noSignal).uncertain,true);
const allYes=[...Array(18).fill(0),...Array(6).fill(3),['none'],0,3];
assert.equal(evaluate(allYes).uncertain,true);
const basic=answersFor('A'),withSkills=[...basic];withSkills[24]=['text'];
assert.equal(evaluate(withSkills).ranked.length,16);
assert.ok(evaluate(withSkills).ranked.find(x=>tracks[x.index].id==='content').score>evaluate(basic).ranked.find(x=>tracks[x.index].id==='content').score);
const context=[...basic];context[25]=2;context[26]=1;
assert.deepEqual(evaluate(context).ranked.map(x=>x.score),evaluate(basic).ranked.map(x=>x.score));
assert.throws(()=>evaluate([]));
assert.throws(()=>evaluate([...basic.slice(0,24),['none','text'],0,2]));
assert.throws(()=>evaluate([...basic.slice(0,24),[],0,2]));
console.log('Career model: 27 questions, 16 complete paths, six interests, uncertainty, skills and contexts PASS');
