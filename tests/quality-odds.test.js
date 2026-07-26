import assert from 'node:assert/strict'
import test from 'node:test'
import {
  getOddsEnchantMethodOptions,
  getQualityTargetPresetValues,
  oddsEnchantMethods,
} from '../app/features/gear-score/data.js'
import {
  calculateQualityOdds,
  findBestQualityOddsOrder,
} from '../app/features/gear-score/score-calculation.js'

const item = {
  Optimal: ['Power', 'Speed'],
  Stats: {
    Power: {
      Value: 10,
      DI: 1,
      Potential: [0, 0],
    },
    Speed: {
      Value: 10,
      DI: 1,
      Potential: [0, 0],
    },
  },
}

function getOdds(overrides = {}) {
  return calculateQualityOdds({
    gearType: '[9999] Armor',
    item,
    statTypes: ['Power'],
    statInputs: [''],
    lineOrder: [0],
    lineEnchantMethods: ['standard'],
    qualityTargetPercent: 25,
    remainingPotentialMultiplier: 0,
    futurePotentialMultiplier: 0,
    ...overrides,
  })
}

function assertClose(actual, expected, tolerance = 1e-12) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} should be close to ${expected}`)
}

test('quality outcomes separate target, kept miss, and destruction', () => {
  const result = getOdds()

  assertClose(result.totalChance, 0.36)
  assertClose(result.survivedMissChance, 0.24)
  assertClose(result.destroyedChance, 0.4)
  assertClose(
    result.totalChance + result.survivedMissChance + result.destroyedChance,
    1,
  )
  assert.equal(result.targetState, 'active')
  assert.equal(result.lines[0].attemptChanceText, '100.0%')
  assert.equal(result.lines[0].finishChanceText, '36.0%')
})

test('enchanting budget follows the same early-stop policy', () => {
  const result = getOdds()

  assertClose(result.materials.perStart.ely, 100_000_000)
  assertClose(result.materials.perStart.hammersMin, 2)
  assertClose(result.materials.perTarget.ely, 100_000_000 / 0.36)
  assertClose(result.materials.perTarget.hammersMin, 2 / 0.36)
  assertClose(result.expectedStarts, 1 / 0.36)
  assertClose(result.expectedDestroyedItems, 0.4 / 0.36)
  assertClose(result.expectedKeptMisses, 0.24 / 0.36)
  assert.equal(result.startsForHighConfidence, 6)
})

test('an already-secured target skips pending costs and risk', () => {
  const result = getOdds({ qualityTargetPercent: 0 })

  assert.equal(result.targetState, 'secured')
  assert.equal(result.totalChance, 1)
  assert.equal(result.destroyedChance, 0)
  assert.equal(result.materials.perStart.ely, 0)
  assert.equal(result.materials.perTarget.hammersMax, 0)
  assert.equal(result.lines[0].attemptChance, 0)
})

test('an unreachable target is abandoned before spending materials', () => {
  const result = getOdds({ qualityTargetPercent: 75 })

  assert.equal(result.targetState, 'impossible')
  assert.equal(result.totalChance, 0)
  assertClose(result.survivedMissChance, 1)
  assertClose(result.destroyedChance, 0)
  assert.equal(result.materials.perStart.ely, 0)
  assert.equal(result.expectedStarts, null)
  assert.equal(result.materials.perTarget.ely, null)
  assert.equal(result.lines[0].attemptChance, 0)
})

test('abandons a surviving piece when remaining maximum rolls cannot reach target', () => {
  const result = getOdds({
    statTypes: ['Power', 'Speed'],
    statInputs: ['', ''],
    lineOrder: [0, 1],
    lineEnchantMethods: ['standard', 'standard'],
    qualityTargetPercent: 75,
  })

  assertClose(result.totalChance, 0.0756)
  assertClose(result.lines[1].attemptChance, 0.36)
  assertClose(result.materials.perStart.ely, 136_000_000)
  assertClose(result.materials.perStart.hammersMin, 2.72)
  assertClose(result.survivedMissChance, 0.3804)
  assertClose(result.destroyedChance, 0.544)
  assertClose(result.expectedStarts, 1 / 0.0756)
  assertClose(result.materials.perTarget.ely, 136_000_000 / 0.0756, 1e-6)
  assertClose(result.materials.perTarget.hammersMin, 2.72 / 0.0756)
})

test('method profiles expose Normal, Super, and eligible Special costs', () => {
  assert.deepEqual(
    getOddsEnchantMethodOptions('[9999] Armor').map((method) => method.label),
    ['Super', 'Normal'],
  )
  assert.deepEqual(
    getOddsEnchantMethodOptions('[sLv5] Accessories').map((method) => method.label),
    ['Super', 'Normal', 'Special'],
  )
  assert.equal(oddsEnchantMethods.normal.elyCost, 50_000_000)
  assert.equal(oddsEnchantMethods.standard.hammerCostMax, 2)
  assert.equal(oddsEnchantMethods.special.hammerCostMin, 10)
  assert.equal(oddsEnchantMethods.special.hammerCostMax, 30)
})

test('quick targets reflect practical sLv5 and armor progression', () => {
  assert.deepEqual(getQualityTargetPresetValues('[sLv5] Accessories'), [75, 80, 85])
  assert.deepEqual(getQualityTargetPresetValues('[9999] Armor'), [75, 77.5])
  assert.deepEqual(getQualityTargetPresetValues('[9000] Accessories'), [])
  assert.deepEqual(getQualityTargetPresetValues('[8000] Weapons'), [])
})

test('order optimizer matches an exhaustive permutation search', () => {
  const input = {
    gearType: '[sLv5] Accessories',
    item,
    statTypes: ['Power', 'Speed', 'Power'],
    statInputs: ['', '', ''],
    lineOrder: [0, 1, 2],
    lineEnchantMethods: ['normal', 'standard', 'special'],
    qualityTargetPercent: 80,
    remainingPotentialMultiplier: 0,
    futurePotentialMultiplier: 0,
  }
  const optimized = findBestQualityOddsOrder(input)
  const exhaustiveBest = permutations(input.lineOrder).reduce((best, lineOrder) => {
    const result = calculateQualityOdds({ ...input, lineOrder })
    return Math.max(best, result.totalChance)
  }, 0)

  assertClose(optimized.totalChance, exhaustiveBest)
  assert.deepEqual([...optimized.pendingOrder].sort(), [0, 1, 2])
})

function permutations(values) {
  if (values.length <= 1) {
    return [values]
  }

  return values.flatMap((value, index) =>
    permutations(values.filter((_, otherIndex) => otherIndex !== index))
      .map((permutation) => [value, ...permutation]),
  )
}
