const assert = require('node:assert/strict');
const {tracks, questions, evaluate} = require('./model.js');

assert.equal(tracks.length, 8);
assert.equal(questions.length, 19);
for (let target = 0; target < tracks.length; target++) {
  const answers = Array(16).fill(0);
  answers[target] = 4;
  answers[target + 8] = 4;
  answers.push(0, 0, 0);
  const result = evaluate(answers);
  assert.deepEqual(result.primary, [target]);
  assert.equal(result.scores[target], 8);
  const withDifferentContext = [...answers];
  withDifferentContext.splice(16, 3, 2, 2, 2);
  assert.deepEqual(evaluate(withDifferentContext).primary, [target]);
}
const unknown = [...Array(16).fill(5), 3, 3, 3];
assert.equal(evaluate(unknown).uncertain, true);
const neutral = [...Array(16).fill(2), 3, 3, 3];
assert.equal(evaluate(neutral).uncertain, true);
const tie = [...Array(16).fill(0), 3, 3, 3];
tie[0] = tie[8] = tie[1] = tie[9] = 4;
assert.deepEqual(evaluate(tie).primary, [0, 1]);
const broad = [...Array(16).fill(4), 3, 3, 3];
assert.equal(evaluate(broad).uncertain, true);
assert.throws(() => evaluate([]));
assert.throws(() => evaluate(Array(19).fill(null)));
assert.throws(() => evaluate([...Array(16).fill(0), 9, 0, 0]));
console.log('Career model: 8 distinct profiles, context independence, unknown, neutral, ties and invalid input PASS');
