import assert from 'node:assert/strict'
import test from 'node:test'
import { buildGearImageImportInputs } from '../app/features/gear-score/gear-image-import-inputs.js'
import gears from '../app/utils/gear.js'

test('an unresolved import slot does not consume stats recognized on later rows', () => {
  const lines = [
    createLine('Attack/Intensity', 84),
    createLine('', 0, true, 'Unenchanted placeholder'),
    createLine('Attack/Intensity %', 9),
    createLine('Minimum Damage', 31),
    createLine('Accuracy', 39),
  ]

  const result = buildGearImageImportInputs(
    lines,
    gears['[9000] Accessories'].Glasses,
  )

  assert.deepEqual(result.statTypes, [
    'Attack/Intensity',
    'Maximum Damage',
    'Attack/Intensity %',
    'Minimum Damage',
    'Accuracy',
  ])
  assert.deepEqual(result.statInputs, [84, '', 9, 31, 39])
})

function createLine(stat, value, ignored = false, reason = 'Ready to apply') {
  return {
    stat,
    value,
    ignored,
    reason,
  }
}
