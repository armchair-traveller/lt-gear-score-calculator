import assert from 'node:assert/strict'
import test from 'node:test'
import gears from '../app/utils/gear.js'
import {
  getGearPlanEntryCalculatorPath,
} from '../app/features/gear-plan/gear-share-url.js'
import {
  encodeShareState,
  parseShareState,
} from '../app/features/gear-score/share-url.js'

const plannerGearCases = [
  ['[sLv5] Accessories', 'Cloak', '5'],
  ['[9999] Armor', 'Helmet', '5'],
  ['[9999] Badge 6', 'Badge', null],
  ['[9000] Accessories', 'Crystal', '4'],
  ['[8000] Weapons', 'Weapon', '4'],
  ['[8000] Weapons', 'Stone', '4'],
]

test('planner gear links preserve calculator encoding and final enchant rules', () => {
  for (const [gearType, pieceType, expectedEnchantLevel] of plannerGearCases) {
    const entry = createEntry(gearType, pieceType)
    const path = getGearPlanEntryCalculatorPath(entry)
    const url = new URL(path, 'https://example.test')

    assert.equal(url.pathname, '/')
    assert.equal(url.searchParams.get('it'), encodeShareState(entry))
    assert.equal(url.searchParams.get('el'), expectedEnchantLevel)
    assert.deepEqual(parseShareState(url.searchParams.get('it')), {
      gearName: gearType,
      pieceName: pieceType,
      statNames: entry.statType,
      statValues: entry.statInput,
    })
  }
})

test('planner slot models use their stored entry for calculator links', () => {
  const entry = createEntry('[9999] Armor', 'Chestplate')

  assert.equal(
    getGearPlanEntryCalculatorPath({
      id: '[9999] Armor::Chestplate',
      entry,
      result: { eligible: true },
    }),
    getGearPlanEntryCalculatorPath(entry),
  )
})

test('empty and malformed planner entries do not produce calculator links', () => {
  const validEntry = createEntry('[sLv5] Accessories', 'Cloak')
  const malformedEntries = [
    null,
    undefined,
    {},
    { entry: null },
    { ...validEntry, gearType: '[unknown] Gear' },
    { ...validEntry, statType: validEntry.statType.slice(0, 4) },
    { ...validEntry, statInput: [1, 1, 0, 0, 0] },
    { ...validEntry, statInput: [1, 1, Number.NaN, 0, 0] },
  ]

  for (const entry of malformedEntries) {
    assert.equal(getGearPlanEntryCalculatorPath(entry), null)
  }
})

function createEntry(gearType, pieceType) {
  const statType = gears[gearType][pieceType].Optimal.slice()
  return {
    gearType,
    pieceType,
    statType,
    statInput: statType.map((_, index) => index < 3 ? index + 1 : 0),
  }
}
