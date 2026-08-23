import assert from 'node:assert/strict'
import test from 'node:test'
import gears from '../app/utils/gear.js'
import {
  getExtractorPrompt,
  getDisplayedRollPercent,
  getLineMaxValue,
  getSemanticReviewRowNumbers,
  getSemanticVerificationPrompt,
  getSemanticVerificationRequestText,
  getSemanticVerificationRequests,
  getValueReviewRowNumbers,
  getValueVerificationPrompt,
  getValueVerificationRequestText,
  getValueVerificationRequests,
  mergeSemanticVerifiedLineReads,
  mergeVerifiedLineReads,
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

const grendelHelmetExtraction = {
  gearType: '[9999] Armor',
  pieceType: 'Helmet',
  confidence: 0.99,
  lines: [
    createLine('Lv. 2 Dual Critical Damage +21 [17%]', 'Dual Critical Damage', 21, 17, 2),
    createLine('Lv. 2 Strength / Magic +15250 [63%]', 'Strength / Magic', 15250, 63, 2),
    createLine('Lv. 2 Dual Back Attack Damage +83 [68%]', 'Dual Back Attack Damage', 83, 68, 2),
    createLine('Lv. 2 Attack / Elemental Intensity +162 [67%]', 'Attack / Elemental Intensity', 162, 67, 2),
    createLine('Lv. 2 Dual Accuracy +153 [89%]', 'Dual Accuracy', 153, 89, 2),
  ],
}

const ascendedGrendelHelmetExtraction = {
  gearType: '[9999] Armor',
  pieceType: 'Helmet',
  confidence: 0.99,
  lines: [
    createLine('Lv. 5 Attack / Elemental Intensity +245 [74%]', 'Attack / Elemental Intensity', 245, 74),
    createLine('Lv. 5 Dual Accuracy +211 [91%]', 'Dual Accuracy', 211, 91),
    createLine('Lv. 5 Normal Damage Amplification +5.8% [96%]', 'Normal Damage Amplification', 5.8, 96),
    createLine('Lv. 1 Strength / Magic +1', 'Strength / Magic', 1, 0, 1),
    createLine('Lv. 5 Dual Critical Damage +129 [77%]', 'Dual Critical Damage', 129, 77),
  ],
}

const annihilationWeaponExtraction = {
  gearType: '[8000] Weapons',
  pieceType: 'Weapon',
  confidence: 0.99,
  lines: [
    createLine('Lv. 1 Dual Back Attack Damage +1', 'Dual Back Attack Damage', 1, 0, 1),
    createLine('Lv. 2 Basic Stats +15% [100%]', 'Basic Stats', 15, 100, 2),
    createLine('Lv. 2 Dual Critical Damage +147 [97%]', 'Dual Critical Damage', 147, 97, 2),
    createLine('Lv. 2 Basic Stats +1553 [80%]', 'Basic Stats', 1553, 80, 2),
    createLine('Lv. 2 Dual Maximum Damage +144 [65%]', 'Dual Maximum Damage', 144, 65, 2),
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

test('requires one extraction result for every visible Lv. row', () => {
  const prompt = getExtractorPrompt()

  assert.match(prompt, /exactly one lines item for every visible row that begins with "Lv\."/)
  assert.match(prompt, /Never skip a row between two other enchant rows/)
  assert.match(prompt, /lines\.length equals the number of visible rows that begin with "Lv\."/)
  assert.match(prompt, /Count the digits in each value and verify the full digit sequence/)
  assert.match(prompt, /without a percentage in square brackets is still an enchant row/)
  assert.match(prompt, /original position and set rollPercent to 0/)
  assert.match(prompt, /Lv\. 1 Luck \+1.*occupied enchant line/)
})

test('keeps the unenchanted fourth row from the Ascended Grendel Helmet screenshot', () => {
  const result = normalizeExtraction(
    ascendedGrendelHelmetExtraction,
    '[9999] Armor',
    'Helmet',
    gears,
  )

  assert.deepEqual(
    result.lines.map(({ stat, value, rollPercent, ignored, status }) => ({
      stat,
      value,
      rollPercent,
      ignored,
      status,
    })),
    [
      { stat: 'Attack/Intensity', value: 245, rollPercent: 74, ignored: false, status: 'matched' },
      { stat: 'Accuracy', value: 211, rollPercent: 91, ignored: false, status: 'matched' },
      { stat: 'Normal Amplification', value: 5.8, rollPercent: 96, ignored: false, status: 'matched' },
      { stat: 'Strength/Magic', value: 1, rollPercent: 0, ignored: true, status: 'ignored' },
      { stat: 'Critical Damage', value: 129, rollPercent: 77, ignored: false, status: 'matched' },
    ],
  )
})

test('keeps level 1 Luck as an occupied non-damaging line', () => {
  const extraction = {
    gearType: '[9000] Accessories',
    pieceType: 'Glasses',
    confidence: 0.99,
    lines: [
      {
        ...createLine('Lv. 1 Luck +1', 'Luck', 1, 0, 1),
        ignored: true,
        ignoreReason: 'Unenchanted placeholder',
      },
    ],
  }

  const [line] = normalizeExtraction(
    extraction,
    '[9000] Accessories',
    'Glasses',
    gears,
  ).lines

  assert.deepEqual(
    {
      stat: line.stat,
      value: line.value,
      ignored: line.ignored,
      status: line.status,
      reason: line.reason,
    },
    {
      stat: 'Other (Non-damaging)',
      value: 1,
      ignored: false,
      status: 'other',
      reason: 'Mapped to non-damaging option',
    },
  )
})

test('normalizes all five rows from the supplied Grendel Helmet screenshot', () => {
  const result = normalizeExtraction(grendelHelmetExtraction, '[9999] Armor', 'Helmet', gears)

  assert.equal(result.gearType, '[9999] Armor')
  assert.equal(result.pieceType, 'Helmet')
  assert.equal(result.inputEnchantLevel, 2)
  assert.equal(result.confidence, 0.99)
  assert.deepEqual(
    result.lines.map(({ stat, value, rollPercent, status }) => ({ stat, value, rollPercent, status })),
    [
      { stat: 'Critical Damage', value: 21, rollPercent: 17, status: 'matched' },
      { stat: 'Strength/Magic', value: 15250, rollPercent: 63, status: 'matched' },
      { stat: 'Back Attack Damage', value: 83, rollPercent: 68, status: 'matched' },
      { stat: 'Attack/Intensity', value: 162, rollPercent: 67, status: 'matched' },
      { stat: 'Accuracy', value: 153, rollPercent: 89, status: 'matched' },
    ],
  )
  assert.equal(new Set(result.lines.map((line) => line.stat)).size, 5)
})

test('does not let extractor metadata hide a valid level 2 row', () => {
  const extraction = structuredClone(grendelHelmetExtraction)
  extraction.lines[1].ignored = true
  extraction.lines[1].ignoreReason = 'Unenchanted placeholder'

  const result = normalizeExtraction(extraction, '[9999] Armor', 'Helmet', gears)

  assert.equal(result.lines[1].stat, 'Strength/Magic')
  assert.equal(result.lines[1].ignored, false)
  assert.equal(result.lines[1].status, 'matched')
  assert.equal(result.lines[1].reason, 'Ready to apply')
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

test('requests an independent re-read and repairs the supplied Weapon screenshot value', () => {
  const firstPass = normalizeExtraction(annihilationWeaponExtraction, '[8000] Weapons', 'Weapon', gears)
  const reviewRows = getValueReviewRowNumbers(firstPass)
  const verificationRequests = getValueVerificationRequests(annihilationWeaponExtraction, reviewRows)
  const verifiedExtraction = mergeVerifiedLineReads(
    annihilationWeaponExtraction,
    [{ rowNumber: 4, rawText: 'Lv. 2 Basic Stats +14553 [80%]' }],
    reviewRows,
  )
  const result = normalizeExtraction(verifiedExtraction, '[8000] Weapons', 'Weapon', gears)

  assert.deepEqual(reviewRows, [4])
  assert.deepEqual(verificationRequests, [
    {
      rowNumber: 4,
      level: 2,
      statText: 'Basic Stats',
      previousStatText: 'Dual Critical Damage',
      nextStatText: 'Dual Maximum Damage',
    },
  ])
  const verificationPrompt = getValueVerificationPrompt()
  const verificationRequestText = getValueVerificationRequestText(verificationRequests)
  assert.match(verificationPrompt, /including any Lv\. 1 unenchanted placeholder/)
  assert.match(verificationPrompt, /Do not infer or correct a value from the stat name, roll percentage/)
  assert.match(verificationRequestText, /Requested row 4 has visible level Lv\. 2 and stat wording "Basic Stats"/)
  assert.doesNotMatch(`${verificationPrompt}\n${verificationRequestText}`, /1553|80%/)
  assert.equal(result.gearType, '[8000] Weapons')
  assert.equal(result.pieceType, 'Weapon')
  assert.equal(result.inputEnchantLevel, 2)
  assert.equal(result.confidence, 0.99)
  assert.deepEqual(
    result.lines.map(({ stat, value, rollPercent, status }) => ({ stat, value, rollPercent, status })),
    [
      { stat: 'Back Attack Damage', value: 1, rollPercent: 0, status: 'ignored' },
      { stat: 'Basic Stats %', value: 15, rollPercent: 100, status: 'matched' },
      { stat: 'Critical Damage', value: 147, rollPercent: 97, status: 'matched' },
      { stat: 'Basic Stats', value: 14553, rollPercent: 80, status: 'matched' },
      { stat: 'Maximum Damage', value: 144, rollPercent: 65, status: 'matched' },
    ],
  )
  assert.equal(result.lines[3].rawText, 'Lv. 2 Basic Stats +14553 [80%]')
  assert.equal(result.lines[3].reason, 'Ready to apply')
})

test('whole-row verification can safely repair a numeric-only review row', () => {
  const verifiedExtraction = mergeSemanticVerifiedLineReads(
    annihilationWeaponExtraction,
    [{ rowNumber: 4, rawText: 'Lv. 2 Basic Stats +14553 [80%]' }],
    [4],
  )
  const result = normalizeExtraction(
    verifiedExtraction,
    '[8000] Weapons',
    'Weapon',
    gears,
  )

  assert.deepEqual(pickLine(result.lines[3]), {
    stat: 'Basic Stats',
    value: 14553,
    status: 'matched',
    reason: 'Ready to apply',
  })
})

test('does not invent a missing value digit when the visible roll may be wrong', () => {
  const extraction = {
    gearType: '[sLv5] Accessories',
    pieceType: 'Cloak',
    confidence: 0.98,
    lines: [
      createLine('Lv. 2 Strength / Magic +201 [6%]', 'Strength / Magic', 201, 6, 2),
    ],
  }

  const [line] = normalizeExtraction(extraction, '[sLv5] Accessories', 'Cloak', gears).lines

  assert.deepEqual(pickLine(line), {
    stat: 'Strength/Magic',
    value: 201,
    status: 'needs_review',
    reason: 'Value does not match the visible 6% roll',
  })
  assert.deepEqual(
    getSemanticReviewRowNumbers(
      normalizeExtraction(extraction, '[sLv5] Accessories', 'Cloak', gears),
    ),
    [],
  )
})

test('independently verifies a mapped Other row before trusting its meaning', () => {
  const extraction = {
    gearType: '[9000] Accessories',
    pieceType: 'Crystal',
    confidence: 0.99,
    lines: [
      createLine('Lv. 1 Strength / Magic +1', 'Strength / Magic', 1, 0, 1),
      createLine(
        'Lv. 5 Boss Damage Mitigation +21% [99%]',
        'Boss Damage Mitigation',
        21,
        99,
      ),
    ],
  }
  const firstPass = normalizeExtraction(
    extraction,
    '[9000] Accessories',
    'Crystal',
    gears,
  )
  const reviewRows = getSemanticReviewRowNumbers(firstPass)
  const verificationRequests = getSemanticVerificationRequests(reviewRows)
  const verificationText = getSemanticVerificationRequestText(verificationRequests)
  const verificationPrompt = getSemanticVerificationPrompt()

  assert.deepEqual(pickLine(firstPass.lines[0]), {
    stat: 'Strength/Magic',
    value: 1,
    status: 'ignored',
    reason: 'Unenchanted placeholder',
  })
  assert.deepEqual(pickLine(firstPass.lines[1]), {
    stat: 'Other (Non-damaging)',
    value: 1,
    status: 'needs_review',
    reason: 'Verify the stat wording before treating this as non-damaging',
  })
  assert.equal(firstPass.confidence, 0)
  assert.deepEqual(reviewRows, [2])
  assert.deepEqual(verificationRequests, [{ rowNumber: 2 }])
  assert.equal(verificationText, 'Requested row 2.')
  assert.doesNotMatch(
    `${verificationPrompt}\n${verificationText}`,
    /Boss|Mitigation|Amplification|Strength|Magic|21|99|2\.8|84/,
  )
  assert.match(verificationPrompt, /full stat wording/)
  assert.match(verificationPrompt, /decimal separator/)
  assert.match(verificationPrompt, /percentage in square brackets separate/)

  const verifiedExtraction = mergeSemanticVerifiedLineReads(
    extraction,
    [{ rowNumber: 2, rawText: 'Lv. 2 Boss Damage Amplification +2.8% [84%]' }],
    reviewRows,
  )
  assert.deepEqual(
    {
      rawText: verifiedExtraction.lines[1].rawText,
      level: verifiedExtraction.lines[1].level,
      statText: verifiedExtraction.lines[1].statText,
      value: verifiedExtraction.lines[1].value,
      rollPercent: verifiedExtraction.lines[1].rollPercent,
      semanticVerified: verifiedExtraction.lines[1].semanticVerified,
    },
    {
      rawText: 'Lv. 2 Boss Damage Amplification +2.8% [84%]',
      level: 2,
      statText: 'Boss Damage Amplification',
      value: 2.8,
      rollPercent: 84,
      semanticVerified: true,
    },
  )

  const result = normalizeExtraction(
    verifiedExtraction,
    '[9000] Accessories',
    'Crystal',
    gears,
  )
  assert.equal(result.lines[0].status, 'ignored')
  assert.deepEqual(pickLine(result.lines[1]), {
    stat: 'Boss Amplification',
    value: 2.8,
    status: 'matched',
    reason: 'Ready to apply',
  })
  assert.deepEqual(getSemanticReviewRowNumbers(result), [])
  assert.equal(result.confidence, 0.99)
})

test('rejects a verification read from a different neighboring stat row', () => {
  const merged = mergeVerifiedLineReads(
    annihilationWeaponExtraction,
    [{ rowNumber: 4, rawText: 'Lv. 2 Dual Maximum Damage +144 [65%]' }],
    [4],
  )

  assert.equal(merged.lines[3].rawText, 'Lv. 2 Basic Stats +1553 [80%]')
  assert.equal(merged.lines[3].value, 1553)
  assert.equal(merged.lines[3].rollPercent, 80)
})

test('rejects an adjacent stat even when its value and roll fit the requested stat cap', () => {
  const extraction = {
    gearType: '[9999] Armor',
    pieceType: 'Helmet',
    confidence: 0.98,
    lines: [
      createLine('Lv. 2 Dual Critical Damage +21 [68%]', 'Dual Critical Damage', 21, 68, 2),
    ],
  }
  const merged = mergeVerifiedLineReads(
    extraction,
    [{ rowNumber: 1, rawText: 'Lv. 2 Dual Back Attack Damage +83 [68%]' }],
    [1],
  )
  const [line] = normalizeExtraction(merged, '[9999] Armor', 'Helmet', gears).lines

  assert.deepEqual(pickLine(line), {
    stat: 'Critical Damage',
    value: 21,
    status: 'needs_review',
    reason: 'Value does not match the visible 68% roll',
  })
})

test('rejects a verification read from the wrong enchant level', () => {
  const merged = mergeVerifiedLineReads(
    annihilationWeaponExtraction,
    [{ rowNumber: 4, rawText: 'Lv. 3 Basic Stats +14553 [80%]' }],
    [4],
  )

  assert.equal(merged.lines[3].rawText, 'Lv. 2 Basic Stats +1553 [80%]')
  assert.equal(merged.lines[3].level, 2)
  assert.equal(merged.lines[3].value, 1553)
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

test('sends unknown attack or damage wording to review instead of silently ignoring it', () => {
  const weaponExtraction = {
    gearType: '[8000] Weapons',
    pieceType: 'Weapon',
    confidence: 1,
    lines: [
      createLine('Lv. 2 Dual Minimal Damage +144 [65%]', 'Dual Minimal Damage', 144, 65, 2),
    ],
  }
  const helmetExtraction = {
    gearType: '[9999] Armor',
    pieceType: 'Helmet',
    confidence: 1,
    lines: [
      createLine('Lv. 2 Dual Basic Attack Damage +83 [68%]', 'Dual Basic Attack Damage', 83, 68, 2),
    ],
  }

  const [weaponLine] = normalizeExtraction(
    weaponExtraction,
    '[8000] Weapons',
    'Weapon',
    gears,
  ).lines
  const [helmetLine] = normalizeExtraction(
    helmetExtraction,
    '[9999] Armor',
    'Helmet',
    gears,
  ).lines

  assert.deepEqual(pickLine(weaponLine), {
    stat: '',
    value: 0,
    status: 'needs_review',
    reason: 'Choose a matching stat or ignore this line',
  })
  assert.deepEqual(pickLine(helmetLine), {
    stat: '',
    value: 0,
    status: 'needs_review',
    reason: 'Choose a matching stat or ignore this line',
  })
  assert.deepEqual(
    getSemanticReviewRowNumbers({ lines: [weaponLine, helmetLine] }),
    [1, 2],
  )

  const independentlyReread = mergeSemanticVerifiedLineReads(
    weaponExtraction,
    [{ rowNumber: 1, rawText: 'Lv. 2 Dual Minimal Damage +144 [65%]' }],
    [1],
  )
  const rereadResult = normalizeExtraction(
    independentlyReread,
    '[8000] Weapons',
    'Weapon',
    gears,
  )
  assert.equal(rereadResult.lines[0].status, 'needs_review')
  assert.deepEqual(getSemanticReviewRowNumbers(rereadResult), [1])
})

test('keeps a confirmed non-damaging option mapped to Other', () => {
  const extraction = {
    gearType: '[8000] Weapons',
    pieceType: 'Weapon',
    confidence: 1,
    lines: [
      createLine('Lv. 2 Physical Defense +144 [65%]', 'Physical Defense', 144, 65, 2),
    ],
  }

  const firstPass = normalizeExtraction(extraction, '[8000] Weapons', 'Weapon', gears)

  assert.deepEqual(pickLine(firstPass.lines[0]), {
    stat: 'Other (Non-damaging)',
    value: 1,
    status: 'needs_review',
    reason: 'Verify the stat wording before treating this as non-damaging',
  })
  assert.deepEqual(getSemanticReviewRowNumbers(firstPass), [1])

  const verifiedExtraction = mergeSemanticVerifiedLineReads(
    extraction,
    [{ rowNumber: 1, rawText: 'Lv. 2 Physical Defense +144 [65%]' }],
    [1],
  )
  const [line] = normalizeExtraction(
    verifiedExtraction,
    '[8000] Weapons',
    'Weapon',
    gears,
  ).lines

  assert.deepEqual(pickLine(line), {
    stat: 'Other (Non-damaging)',
    value: 1,
    status: 'other',
    reason: 'Mapped to non-damaging option',
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

test('lets a user-selected hint override a conflicting visible identity on fallback', () => {
  const result = normalizeExtraction(
    screenshotExtraction,
    '[sLv5] Accessories',
    'Cloak',
    gears,
    {
      hintProvided: true,
      preferGearHint: true,
    },
  )

  assert.equal(result.gearType, '[sLv5] Accessories')
  assert.equal(result.pieceType, 'Cloak')
  assert.deepEqual(result.equipment, {
    status: 'resolved',
    source: 'hint',
    imageVisible: true,
    confidence: 1,
    reason: 'Equipment identity supplied by the user',
  })
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
