import assert from 'node:assert/strict'
import test from 'node:test'
import gears from '../app/utils/gear.js'
import {
  getDisplayedRollPercent,
  getLineMaxValue,
  normalizeExtraction,
} from '../server/utils/gear-image-import.js'

const screenshotExtraction = {
  gearType: '[9999] Armor',
  pieceType: 'Chestplate',
  confidence: 0.99,
  lines: [
    createLine('Lv. 5 Dual Maximum Damage +117 [70%]', 'Dual Maximum Damage', 117, 70),
    createLine('Lv. 5 Basic Stats +9% [32%]', 'Basic Stats', 9, 32),
    createLine('Lv. 5 Attack / Elemental Intensity +303 [91%]', 'Attack / Elemental Intensity', 303, 91),
    createLine('Lv. 5 Attack / Elemental Intensity +21% [91%]', 'Attack / Elemental Intensity', 21, 91),
    createLine('Lv. 5 Basic Stats +24011 [92%]', 'Basic Stats', 24011, 92),
  ],
}

test('normalizes every enchant line from the supplied Chestplate screenshot', () => {
  const result = normalizeExtraction(screenshotExtraction, '[sLv5] Accessories', 'Cloak', gears)

  assert.equal(result.gearType, '[9999] Armor')
  assert.equal(result.pieceType, 'Chestplate')
  assert.equal(result.inputEnchantLevel, 5)
  assert.equal(result.confidence, 0.99)
  assert.deepEqual(
    result.lines.map(({ stat, value, rollPercent, status }) => ({ stat, value, rollPercent, status })),
    [
      { stat: 'Maximum Damage', value: 117, rollPercent: 70, status: 'matched' },
      { stat: 'Basic Stats %', value: 9, rollPercent: 32, status: 'matched' },
      { stat: 'Attack/Intensity', value: 303, rollPercent: 91, status: 'matched' },
      { stat: 'Attack/Intensity %', value: 21, rollPercent: 91, status: 'matched' },
      { stat: 'Basic Stats', value: 24011, rollPercent: 92, status: 'matched' },
    ],
  )
  assert.equal(new Set(result.lines.map((line) => line.stat)).size, 5)
})

test('uses level-aware stat caps as a checksum for the visible rolls', () => {
  const item = gears['[9999] Armor'].Chestplate
  const expected = [
    ['Maximum Damage', 166, 117, 70],
    ['Basic Stats %', 28, 9, 32],
    ['Attack/Intensity', 331, 303, 91],
    ['Attack/Intensity %', 23, 21, 91],
    ['Basic Stats', 25901, 24011, 92],
  ]

  expected.forEach(([stat, maxValue, value, rollPercent]) => {
    const calculatedMax = getLineMaxValue(item.Stats[stat], '[9999] Armor', 5)
    assert.equal(calculatedMax, maxValue)
    assert.equal(getDisplayedRollPercent(value, calculatedMax), rollPercent)
  })
})

test('repairs a uniquely provable percent glyph error and rejects an ambiguous dropped digit', () => {
  const corrupted = structuredClone(screenshotExtraction)
  corrupted.lines[1] = createLine('Lv. 5 Basic Stats +98 [32%]', 'Basic Stats', 98, 32)
  corrupted.lines[4] = createLine('Lv. 5 Basic Stats +2401 [92%]', 'Basic Stats', 2401, 92)

  const result = normalizeExtraction(corrupted, '[9999] Armor', 'Chestplate', gears)

  assert.deepEqual(
    pickLine(result.lines[1]),
    {
      stat: 'Basic Stats %',
      value: 9,
      status: 'matched',
      reason: 'Corrected using the visible roll percentage',
    },
  )
  assert.deepEqual(
    pickLine(result.lines[4]),
    {
      stat: 'Basic Stats',
      value: 2401,
      status: 'needs_review',
      reason: 'Value does not match the visible 92% roll',
    },
  )
  assert.equal(result.confidence, 0.8)
})

test('repairs the supplied Crystal screenshot single-digit OCR substitution', () => {
  const extraction = {
    gearType: '[9000] Accessories',
    pieceType: 'Crystal',
    confidence: 0.98,
    lines: [
      createLine('Lv. 2 Dual Static Damage +16872 [75%]', 'Dual Static Damage', 16872, 75, 2),
      createLine('Lv. 2 Basic Stats +5% [38%]', 'Basic Stats', 5, 38, 2),
      createLine('Lv. 2 Attack / Elemental Intensity +2 [1%]', 'Attack / Elemental Intensity', 2, 1, 2),
      createLine('Lv. 2 Boss Damage Amplification +3.1% [93%]', 'Boss Damage Amplification', 3.1, 93, 2),
      createLine('Lv. 2 Dual Critical Damage +71 [87%]', 'Dual Critical Damage', 71, 87, 2),
    ],
  }

  const result = normalizeExtraction(extraction, '[sLv5] Accessories', 'Cloak', gears)

  assert.equal(result.gearType, '[9000] Accessories')
  assert.equal(result.pieceType, 'Crystal')
  assert.equal(result.inputEnchantLevel, 2)
  assert.equal(result.confidence, 0.98)
  assert.deepEqual(
    result.lines.map(({ stat, value, rollPercent, status }) => ({ stat, value, rollPercent, status })),
    [
      { stat: 'Static Damage', value: 18872, rollPercent: 75, status: 'matched' },
      { stat: 'Basic Stats %', value: 5, rollPercent: 38, status: 'matched' },
      { stat: 'Attack/Intensity', value: 2, rollPercent: 1, status: 'matched' },
      { stat: 'Boss Amplification', value: 3.1, rollPercent: 93, status: 'matched' },
      { stat: 'Critical Damage', value: 71, rollPercent: 87, status: 'matched' },
    ],
  )
  assert.equal(result.lines[0].reason, 'Corrected using the visible roll percentage')
})

test('does not guess unrelated OCR digit substitutions', () => {
  const extraction = {
    gearType: '[9000] Accessories',
    pieceType: 'Crystal',
    confidence: 0.98,
    lines: [
      createLine('Lv. 2 Dual Static Damage +18000 [75%]', 'Dual Static Damage', 18000, 75, 2),
    ],
  }

  const [line] = normalizeExtraction(extraction, '[9000] Accessories', 'Crystal', gears).lines

  assert.deepEqual(pickLine(line), {
    stat: 'Static Damage',
    value: 18000,
    status: 'needs_review',
    reason: 'Value does not match the visible 75% roll',
  })
})

test('does not rewrite a value to compensate for a misread roll percentage', () => {
  const extraction = {
    gearType: '[sLv5] Accessories',
    pieceType: 'Cloak',
    confidence: 0.98,
    lines: [
      createLine('Lv. 2 Dual Critical Damage +11 [11%]', 'Dual Critical Damage', 11, 11, 2),
    ],
  }

  const [line] = normalizeExtraction(extraction, '[sLv5] Accessories', 'Cloak', gears).lines

  assert.deepEqual(pickLine(line), {
    stat: 'Critical Damage',
    value: 11,
    status: 'needs_review',
    reason: 'Value does not match the visible 11% roll',
  })
})

test('validates each value against its own enchant level', () => {
  const extraction = {
    ...screenshotExtraction,
    lines: [
      createLine('Lv. 4 Attack / Elemental Intensity +303 [91%]', 'Attack / Elemental Intensity', 303, 91, 4),
    ],
  }

  const [line] = normalizeExtraction(extraction, '[9999] Armor', 'Chestplate', gears).lines
  assert.equal(line.status, 'needs_review')
  assert.equal(line.reason, 'Value does not match the visible 91% roll')
})

test('preserves decimal precision when validating roll percentages', () => {
  const extraction = {
    gearType: '[9999] Armor',
    pieceType: 'Helmet',
    confidence: 1,
    lines: [
      createLine('Lv. 5 Normal Damage Amplification +5.5 [91%]', 'Normal Damage Amplification', 5.5, 91),
    ],
  }

  const [line] = normalizeExtraction(extraction, '[9999] Armor', 'Helmet', gears).lines
  assert.equal(getLineMaxValue(gears['[9999] Armor'].Helmet.Stats['Normal Amplification'], '[9999] Armor', 5), 6)
  assert.equal(line.stat, 'Normal Amplification')
  assert.equal(line.value, 5.5)
  assert.equal(line.status, 'matched')
})

test('falls back only when the extracted equipment identity is invalid', () => {
  const invalidIdentity = {
    ...screenshotExtraction,
    gearType: 'Unknown gear',
    pieceType: 'Unknown piece',
    lines: [],
  }

  const result = normalizeExtraction(invalidIdentity, '[9999] Armor', 'Chestplate', gears)
  assert.equal(result.gearType, '[9999] Armor')
  assert.equal(result.pieceType, 'Chestplate')
})

function createLine(rawText, statText, value, rollPercent, level = 5) {
  return {
    rawText,
    level,
    statText,
    value,
    rollPercent,
    ignored: false,
    ignoreReason: '',
  }
}

function pickLine(line) {
  return {
    stat: line.stat,
    value: line.value,
    status: line.status,
    reason: line.reason,
  }
}
