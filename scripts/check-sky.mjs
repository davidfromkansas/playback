import assert from 'node:assert/strict'
const { timeOfDay } = await import('../src/lib/timeOfDay.ts')
for (const [hour, expected] of [[0,'night'],[4,'night'],[5,'sunset'],[6,'sunset'],[7,'day'],[16,'day'],[17,'sunset'],[19,'sunset'],[20,'night'],[23,'night']]) {
  assert.equal(timeOfDay(new Date(2026,9,21,hour), ''), expected, `Hour ${hour}`)
}
for (const sky of ['day','sunset','night']) assert.equal(timeOfDay(new Date(2026,9,21,12), `?sky=${sky}`), sky)
assert.equal(timeOfDay(new Date(2026,9,21,12), '?sky=invalid'), 'day')
console.log('Local-time boundaries and URL overrides pass')
