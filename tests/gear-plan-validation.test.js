import assert from 'node:assert/strict'
import test from 'node:test'
import {
  GearPlanValidationError,
  createEmptyGearPlan,
  gearPlanValidationCode,
  gearPlanValidationMessage,
  parseGearPlanStrict,
  validateGearPlan,
} from '../app/features/gear-plan/plan-validation.js'

function createValidPlan() {
  const entry = {
    gearType: '[sLv5] Accessories',
    pieceType: 'Cloak',
    statType: [
      'Critical Damage',
      'Basic Stats %',
      'Attack/Intensity',
      'Strength/Magic',
      'Basic Stats',
    ],
    statInput: [1, 1, 1, 0, 0],
  }

  return {
    version: 1,
    slots: {
      '[sLv5] Accessories::Cloak': entry,
    },
  }
}

test('strict planner validation returns a canonical plan and accepts a reset', () => {
  const plan = createValidPlan()
  plan.extra = 'discarded'
  plan.slots['[sLv5] Accessories::Cloak'].extra = 'discarded'

  assert.deepEqual(parseGearPlanStrict(plan), createValidPlan())
  assert.deepEqual(parseGearPlanStrict(createEmptyGearPlan()), {
    version: 1,
    slots: {},
  })
  assert.deepEqual(validateGearPlan(createValidPlan()), {
    plan: createValidPlan(),
    error: '',
  })
})

test('strict planner validation rejects malformed or noncanonical entries', () => {
  const invalidPlans = []

  invalidPlans.push(null)
  invalidPlans.push({ version: 2, slots: {} })
  invalidPlans.push({ version: 1, slots: [] })

  const wrongKey = createValidPlan()
  wrongKey.slots.wrong = wrongKey.slots['[sLv5] Accessories::Cloak']
  delete wrongKey.slots['[sLv5] Accessories::Cloak']
  invalidPlans.push(wrongKey)

  const shortStats = createValidPlan()
  shortStats.slots['[sLv5] Accessories::Cloak'].statInput.pop()
  invalidPlans.push(shortStats)

  const stringValue = createValidPlan()
  stringValue.slots['[sLv5] Accessories::Cloak'].statInput[0] = '1'
  invalidPlans.push(stringValue)

  const duplicateStat = createValidPlan()
  duplicateStat.slots['[sLv5] Accessories::Cloak'].statType[1] = 'Critical Damage'
  invalidPlans.push(duplicateStat)

  const tooFewFilledLines = createValidPlan()
  tooFewFilledLines.slots['[sLv5] Accessories::Cloak'].statInput = [1, 1, 0, 0, 0]
  invalidPlans.push(tooFewFilledLines)

  const overMaximum = createValidPlan()
  overMaximum.slots['[sLv5] Accessories::Cloak'].statInput[0] = 1_000_000
  invalidPlans.push(overMaximum)

  for (const plan of invalidPlans) {
    assert.throws(
      () => parseGearPlanStrict(plan),
      error => (
        error instanceof GearPlanValidationError
        && error.code === gearPlanValidationCode
        && error.message === gearPlanValidationMessage
      ),
    )
    assert.deepEqual(validateGearPlan(plan), {
      plan: null,
      error: gearPlanValidationMessage,
    })
  }
})

test('planner validation caps plans to the known canonical slot set', () => {
  const plan = createEmptyGearPlan()
  for (let index = 0; index < 15; index++) {
    plan.slots[`unknown-${index}`] = createValidPlan().slots['[sLv5] Accessories::Cloak']
  }

  assert.throws(
    () => parseGearPlanStrict(plan),
    GearPlanValidationError,
  )
})
