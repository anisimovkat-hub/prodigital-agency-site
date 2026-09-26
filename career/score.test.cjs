const assert=require('node:assert/strict');
const {score,questions}=require('./app.js');
for(let d=0;d<5;d++){
 const answers=[0,0,0,0,0,d,d,d,5,0];answers[d]=4;
 assert.deepEqual(score(answers).chosen,[d]);assert.equal(score(answers).points[d],17);
 const b=[...answers];b[8]=0;b[9]=2;assert.deepEqual(score(b).points,score(answers).points);
}
assert.equal(score([5,5,5,5,5,5,5,5,5,0]).uncertain,true);
assert.equal(score([2,2,2,2,2,5,5,5,5,0]).uncertain,true);
assert.deepEqual(score([4,4,0,0,0,5,5,5,5,0]).chosen,[0,1]);
assert.equal(score([0,0,0,0,0,5,5,5,5,0]).uncertain,true);
assert.throws(()=>score([]));assert.throws(()=>score(Array(10)));assert.throws(()=>score([null,0,0,0,0,0,0,0,0,0]));
assert.throws(()=>score([6,0,0,0,0,0,0,0,0,0]));
assert.equal(questions.length,10);
console.log('Passed: 5 contrasting profiles, background/time invariance, tie, broad tie, unknown, negative interest, incomplete/invalid inputs');
