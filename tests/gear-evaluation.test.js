import assert from 'node:assert/strict'
import test from 'node:test'
import gears from '../app/utils/gear.js'
import {
  evaluateImportedGear,
  GearEvaluationError,
  getSupportedEquipmentOptions,
  parseEquipmentOption,
} from '../app/features/gear-score/gear-evaluation.js'
import { normalizeExtraction } from '../server/utils/gear-image-import.js'

const chestplateExtraction = {
  gearType: '[9999] Armor',
  pieceType: 'Chestplate',
  equipmentVisible: true,
  confidence: 0.99,
  lines: [
    createLine('Lv. 5 Dual Maximum Damage +117 [70%]', 'Dual Maximum Damage', 117, 70),
    createLine('Lv. 5 Basic Stats +9% [32%]', 'Basic Stats', 9, 32),
    createLine(
      'Lv. 5 Attack / Elemental Intensity +303 [91%]',
      'Attack / Elemental Intensity',
      303,
      91,
    ),
    createLine(
      'Lv. 5 Attack / Elemental Intensity +21% [91%]',
      'Attack / Elemental Intensity',
      21,
      91,
    ),
    createLine('Lv. 5 Basic Stats +24011 [92%]', 'Basic Stats', 24011, 92),
  ],
}

test('evaluates a normalized screenshot with the existing scoring and snapshot contracts', () => {
  const imported = normalizeExtraction(
    chestplateExtraction,
    '[9999] Armor',
    'Chestplate',
    gears,
    { hintProvided: false },
  )
  const evaluation = evaluateImportedGear(imported)

  assert.deepEqual(evaluation.summary, {
    score: 90,
    tier: 'SS',
    rating: 6.93,
    scoreText: '90%',
    ratingText: '6.93%',
  })
  assert.equal(evaluation.inputEnchantLevel, 5)
  assert.deepEqual(evaluation.statTypes, [
    'Maximum Damage',
    'Basic Stats %',
    'Attack/Intensity',
    'Attack/Intensity %',
    'Basic Stats',
  ])
  assert.deepEqual(evaluation.statInputs, [117, 9, 303, 21, 24011])
  assert.equal(evaluation.projection.available, false)
  assert.equal(evaluation.snapshotPayload.current.value, '90%')
  assert.equal(evaluation.snapshotPayload.current.tier, 'SS')
  assert.equal(evaluation.snapshotPayload.itemImageKey, 'Chestplate_9999.png')
  assert.equal(evaluation.snapshotPayload.lines.length, 5)
  assert.match(evaluation.sharePath, /^\/\?it=/)
  assert.match(evaluation.sharePath, /&el=5$/)
})

test('rejects provisional equipment identity rather than silently scoring it', () => {
  const imported = normalizeExtraction(
    {
      ...chestplateExtraction,
      equipmentVisible: false,
    },
    '[9999] Armor',
    'Chestplate',
    gears,
    { hintProvided: false },
  )

  assert.throws(
    () => evaluateImportedGear(imported),
    (error) =>
      error instanceof GearEvaluationError
      && error.code === 'equipment_unresolved',
  )
})

test('rejects active lines that still need OCR review', () => {
  const imported = normalizeExtraction(
    {
      ...chestplateExtraction,
      lines: [
        createLine('Lv. 5 Basic Stats +2401 [92%]', 'Basic Stats', 2401, 92),
      ],
    },
    '[9999] Armor',
    'Chestplate',
    gears,
    { hintProvided: false },
  )

  assert.throws(
    () => evaluateImportedGear(imported),
    (error) =>
      error instanceof GearEvaluationError
      && error.code === 'lines_need_review'
      && error.details.lines[0].reason === 'Value does not match the visible 92% roll',
  )
})

test('rejects duplicate offensive stats but allows repeatable non-damaging lines', () => {
  const baseImport = {
    gearType: '[9999] Armor',
    pieceType: 'Helmet',
    equipment: {
      status: 'resolved',
      source: 'hint',
      imageVisible: false,
      confidence: 1,
      reason: 'Equipment identity supplied by the user',
    },
    inputEnchantLevel: 2,
  }
  const duplicateImport = {
    ...baseImport,
    lines: [
      createNormalizedLine('Critical Damage', 20),
      createNormalizedLine('Critical Damage', 30),
    ],
  }
  const repeatableImport = {
    ...baseImport,
    lines: [
      createNormalizedLine('Other (Non-damaging)', 1, 'other'),
      createNormalizedLine('Other (Non-damaging)', 1, 'other'),
    ],
  }

  assert.throws(
    () => evaluateImportedGear(duplicateImport),
    (error) =>
      error instanceof GearEvaluationError
      && error.code === 'stats_duplicated',
  )
  assert.equal(evaluateImportedGear(repeatableImport).summary.score, 0)
})

test('preserves and rejects more than five active screenshot lines', () => {
  const imported = normalizeExtraction(
    {
      ...chestplateExtraction,
      lines: [
        ...chestplateExtraction.lines,
        createLine('Lv. 5 Other +1', 'Other', 1, 0),
      ],
    },
    '[9999] Armor',
    'Chestplate',
    gears,
    { hintProvided: false },
  )

  assert.equal(imported.lines.length, 6)
  assert.throws(
    () => evaluateImportedGear(imported),
    (error) =>
      error instanceof GearEvaluationError
      && error.code === 'lines_too_many',
  )
})

test('exposes missing-line, unsupported-equipment, and out-of-range fallback codes', () => {
  const resolvedEquipment = {
    status: 'resolved',
    source: 'hint',
    imageVisible: false,
    confidence: 1,
    reason: 'Equipment identity supplied by the user',
  }
  const baseImport = {
    gearType: '[9999] Armor',
    pieceType: 'Helmet',
    equipment: resolvedEquipment,
    inputEnchantLevel: 2,
    lines: [],
  }

  assert.throws(
    () => evaluateImportedGear(baseImport),
    error => error instanceof GearEvaluationError && error.code === 'lines_missing',
  )
  assert.throws(
    () => evaluateImportedGear({
      ...baseImport,
      gearType: '[5000] Accessories',
      pieceType: 'Crystal',
    }),
    error => error instanceof GearEvaluationError && error.code === 'equipment_unsupported',
  )
  assert.throws(
    () => evaluateImportedGear({
      ...baseImport,
      lines: [createNormalizedLine('Critical Damage', 1000)],
    }),
    error => error instanceof GearEvaluationError && error.code === 'values_out_of_range',
  )
})

test('exposes all 23 supported equipment hints with reversible values', () => {
  const options = getSupportedEquipmentOptions()

  assert.equal(options.length, 23)
  options.forEach((option) => {
    assert.deepEqual(parseEquipmentOption(option.value), {
      gearType: option.gearType,
      pieceType: option.pieceType,
    })
  })
  assert.equal(parseEquipmentOption('[4000] Weapon::Weapon'), null)
  assert.equal(parseEquipmentOption('unknown'), null)
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

function createNormalizedLine(stat, value, status = 'matched') {
  return {
    id: `line-${stat}-${value}`,
    rawText: stat,
    level: 2,
    detectedStat: stat,
    stat,
    value,
    rollPercent: 1,
    ignored: false,
    status,
    reason: 'Ready to apply',
  }
}
