import assert from 'node:assert/strict'
import test from 'node:test'
import { assignTraitNotesToLines } from '../app/features/gear-score/stat-notes.js'

test('assigns each active note to its first relevant entered line', () => {
  const backNote = {
    id: 'back',
    appliesTo: ['Back Attack Damage'],
  }

  const assignments = assignTraitNotesToLines({
    traits: [backNote],
    statTypes: ['Critical Damage', 'Back Attack Damage', 'Back Attack Damage'],
    lineIndexes: [0, 1, 2],
  })

  assert.deepEqual(assignments.get(1), [backNote])
  assert.equal(assignments.has(2), false)
})

test('groups multiple notes behind one stat trigger', () => {
  const strengthNote = {
    id: 'strength',
    appliesTo: ['Basic Stats %', 'Strength/Magic'],
  }
  const hpNote = {
    id: 'hp',
    appliesTo: ['Basic Stats %'],
  }

  const assignments = assignTraitNotesToLines({
    traits: [strengthNote, hpNote],
    statTypes: ['Basic Stats %', 'Strength/Magic'],
    lineIndexes: [0, 1],
  })

  assert.deepEqual(assignments.get(0), [strengthNote, hpNote])
  assert.equal(assignments.size, 1)
})

test('ignores active notes without a relevant entered line', () => {
  const assignments = assignTraitNotesToLines({
    traits: [{ id: 'minimum', appliesTo: ['Minimum Damage'] }],
    statTypes: ['Critical Damage', 'Minimum Damage'],
    lineIndexes: [0],
  })

  assert.equal(assignments.size, 0)
})
