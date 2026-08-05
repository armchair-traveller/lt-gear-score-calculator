import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildGearComparisonFragment,
  buildGearComparisonUrl,
  createGearComparisonPayload,
  GEAR_COMPARISON_FRAGMENT_KEY,
  mapGearLinesToDamageChanges,
  MAX_GEAR_COMPARISON_FRAGMENT_LENGTH,
  parseGearComparisonFragment,
} from '../app/features/gear-score/damage-comparison-interop.js'

test('maps every supported gear stat shape and aggregates target collisions', () => {
  const statTypes = [
    'Basic Stats',
    'Strength/Magic',
    'Only Strength/Magic',
    'Basic Stats %',
    'Strength/Magic %',
    'Attack/Intensity',
    'Attack/Intensity %',
    'Critical Damage',
    'Minimum Damage',
    'Maximum Damage',
    'Dual Damage',
    'Static Damage',
    'Static Damage %',
    'Normal Added',
    'Normal Added Damage',
    'Normal Added %',
    'Boss Added',
    'Boss Added Damage',
    'Boss Added %',
    'Normal Amplification',
    'Boss Amplification',
    'Back Attack Damage',
  ]
  const statInputs = [
    1_000,
    '2000',
    3_000,
    4,
    5,
    241,
    14,
    101,
    11,
    12,
    20,
    40_001,
    16,
    100,
    200,
    3,
    400,
    500,
    6,
    5.1,
    4.8,
    30,
  ]

  assert.deepEqual(mapGearLinesToDamageChanges(statTypes, statInputs), {
    changes: {
      strength: [6_000, 9],
      attack: [241, 14],
      critical: [101, 0],
      minimum: [31, 0],
      maximum: [32, 0],
      static: [40_001, 16],
      normalAdded: [300, 3],
      bossAdded: [900, 6],
      normalAmp: [5.1, 0],
      bossAmp: [4.8, 0],
      back: [30, 0],
    },
    omitted: [],
  })
})

test('lists unsupported positive lines without emitting invalid or nonpositive values', () => {
  assert.deepEqual(
    mapGearLinesToDamageChanges(
      [
        'Accuracy',
        'Defense Penetration',
        'Cooldown Reduction',
        'Movement Speed',
        'Critical Damage',
        'Basic Stats',
        'Maximum Damage',
        'Static Damage',
      ],
      ['211', 0, 5.6, '', '12 trailing text', -20, Number.POSITIVE_INFINITY, Number.NaN],
    ),
    {
      changes: {},
      omitted: [
        { stat: 'Accuracy', value: 211 },
        { stat: 'Cooldown Reduction', value: 5.6 },
      ],
    },
  )
})

test('creates the versioned single-current-candidate payload with item metadata', () => {
  assert.deepEqual(createGearComparisonPayload({
    gearType: '[9999] Armor',
    pieceType: 'Helmet',
    enchantLevel: '5',
    statTypes: ['Basic Stats', 'Accuracy'],
    statInputs: ['19001', 211],
  }), {
    kind: 'lt-gear-comparison',
    version: 1,
    source: 'lt-gear-score-calculator',
    candidates: [{
      id: 'current',
      label: '[9999] Armor · Helmet',
      item: {
        gearType: '[9999] Armor',
        pieceType: 'Helmet',
        enchantLevel: 5,
      },
      changes: {
        strength: [19_001, 0],
      },
      omitted: [{ stat: 'Accuracy', value: 211 }],
    }],
  })
})

test('omits unavailable enchant metadata and accepts a caller-provided label', () => {
  const payload = createGearComparisonPayload({
    gearType: '[sLv5] Accessories',
    pieceType: 'Ring',
    enchantLevel: '',
    label: 'My current ring',
  })

  assert.deepEqual(payload.candidates[0], {
    id: 'current',
    label: 'My current ring',
    item: {
      gearType: '[sLv5] Accessories',
      pieceType: 'Ring',
    },
    changes: {},
    omitted: [],
  })
})

test('round-trips the payload through an ltgear URL fragment', () => {
  const payload = createGearComparisonPayload({
    gearType: '[9000] Accessories',
    pieceType: 'Stockings',
    statTypes: ['Dual Damage'],
    statInputs: [117],
  })
  const fragment = buildGearComparisonFragment(payload)
  const params = new URLSearchParams(fragment.slice(1))

  assert.equal(params.get(GEAR_COMPARISON_FRAGMENT_KEY), JSON.stringify(payload))
  assert.deepEqual(parseGearComparisonFragment(fragment), payload)
  assert.deepEqual(
    parseGearComparisonFragment(`https://damage.example/calculator${fragment}`),
    payload,
  )
  assert.equal(parseGearComparisonFragment('#other=value'), null)
})

test('rejects malformed, duplicated, mismatched, and oversized fragments', () => {
  const payload = createGearComparisonPayload({
    gearType: '[9999] Armor',
    pieceType: 'Helmet',
    statTypes: ['Critical Damage'],
    statInputs: [101],
  })
  const withPayload = overrides => buildGearComparisonFragment({
    ...payload,
    ...overrides,
  })

  assert.equal(parseGearComparisonFragment('#ltgear=%7Bbad-json'), null)
  assert.equal(
    parseGearComparisonFragment(`${buildGearComparisonFragment(payload)}&ltgear=%7B%7D`),
    null,
  )
  assert.equal(parseGearComparisonFragment(withPayload({ kind: 'other' })), null)
  assert.equal(parseGearComparisonFragment(withPayload({ version: 2 })), null)
  assert.equal(parseGearComparisonFragment(withPayload({ source: 'other' })), null)
  assert.equal(parseGearComparisonFragment(withPayload({ candidates: [] })), null)
  assert.equal(
    parseGearComparisonFragment(`#ltgear=${'x'.repeat(MAX_GEAR_COMPARISON_FRAGMENT_LENGTH)}`),
    null,
  )
})

test('rejects malformed candidate values when parsing', () => {
  const payload = createGearComparisonPayload({
    gearType: '[9999] Armor',
    pieceType: 'Helmet',
    statTypes: ['Critical Damage'],
    statInputs: [101],
  })
  const candidate = payload.candidates[0]
  const withCandidate = candidateOverrides => buildGearComparisonFragment({
    ...payload,
    candidates: [{ ...candidate, ...candidateOverrides }],
  })

  assert.equal(parseGearComparisonFragment(withCandidate({ id: 'upgrade' })), null)
  assert.equal(parseGearComparisonFragment(withCandidate({ changes: {} })), null)
  assert.equal(parseGearComparisonFragment(withCandidate({ changes: { attack: [-1, 0] } })), null)
  assert.equal(parseGearComparisonFragment(withCandidate({ changes: { normalAmp: [5, 1] } })), null)
  assert.equal(parseGearComparisonFragment(withCandidate({ changes: { unknown: [1, 0] } })), null)
  assert.equal(parseGearComparisonFragment(withCandidate({ omitted: [{ stat: 'Accuracy', value: 0 }] })), null)
  assert.equal(parseGearComparisonFragment(withCandidate({ item: { gearType: '', pieceType: 'Helmet' } })), null)
})

test('puts ltgear in the URL hash without adding a server query parameter', () => {
  const payload = createGearComparisonPayload({
    gearType: '[8000] Weapons',
    pieceType: 'Weapon',
    statTypes: ['Critical Damage'],
    statInputs: [101],
  })
  const url = new URL(buildGearComparisonUrl(
    'https://damage.example/calculator?display=compact#old',
    payload,
  ))

  assert.equal(url.search, '?display=compact')
  assert.equal(url.searchParams.has(GEAR_COMPARISON_FRAGMENT_KEY), false)
  assert.deepEqual(parseGearComparisonFragment(url.toString()), payload)
})
