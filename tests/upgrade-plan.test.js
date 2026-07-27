import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import {
  calculateUpgradePlan,
  getAscensionRequirement,
  getAvailableUpgradeItems,
  normalizeUpgradeTargetLevel,
  parseMaterialCount,
} from '../app/features/upgrade/calculation.js'

const materials = JSON.parse(readFileSync(
  new URL('../app/data/item-enhancement-materials.en.json', import.meta.url),
  'utf8',
))

function getItem(value) {
  return materials.find(item => item.value === value)
}

test('calculates material, fee, and affordability from step rows', () => {
  const plan = calculateUpgradePlan({
    item: getItem('weapon'),
    currentLevel: 0,
    targetLevel: 6,
    quantity: 2,
    ownedMaterials: 1000,
  })

  assert.equal(plan.requiredMaterials, 7678)
  assert.equal(plan.requiredFeeMillions, 1200)
  assert.equal(plan.reachableLevel, 1)
  assert.equal(plan.nextStepShortage, 760)
  assert.equal(plan.steps[0].material, 800)
  assert.equal(plan.steps[0].affordable, true)
  assert.equal(plan.steps[1].affordable, false)
})

test('treats current level as inclusive and target level as exclusive', () => {
  const plan = calculateUpgradePlan({
    item: getItem('weapon'),
    currentLevel: 2,
    targetLevel: 5,
    quantity: 1,
    ownedMaterials: 900,
  })

  assert.deepEqual(plan.steps.map(step => step.step), [
    '+2 → +3',
    '+3 → +4',
    '+4 → +5',
  ])
  assert.equal(plan.requiredMaterials, 1960)
  assert.equal(plan.reachableLevel, 3)
  assert.equal(plan.nextStepShortage, 300)
})

test('scales the separately encoded Ascension Stone requirement', () => {
  const requirement = getAscensionRequirement(getItem('weapon_transcend'), 3)

  assert.deepEqual(requirement, {
    name: 'Demiurge Ascension Stone',
    perItem: 999,
    total: 2997,
  })
})

test('uses step rows instead of the inconsistent summary fee', () => {
  const plan = calculateUpgradePlan({
    item: getItem('badge2'),
    currentLevel: 0,
    targetLevel: 30,
  })

  assert.equal(plan.requiredFeeMillions, 3000)
})

test('treats dash fees as zero', () => {
  const plan = calculateUpgradePlan({
    item: getItem('relic'),
    currentLevel: 0,
    targetLevel: 5,
  })

  assert.equal(plan.requiredFeeMillions, 0)
})

test('excludes disabled and rowless items from selectable upgrades', () => {
  const items = getAvailableUpgradeItems(materials)

  assert.equal(items.length, 27)
  assert.equal(items.some(item => item.value === 'badge6'), false)
})

test('synchronizes a stale target when the current level moves past it', () => {
  assert.equal(normalizeUpgradeTargetLevel(3, 5, 6), 6)
  assert.equal(normalizeUpgradeTargetLevel(3, 2, 6), 3)
})

test('parses complete numeric inputs without mangling scientific notation', () => {
  assert.equal(parseMaterialCount('1e3'), 1000)
  assert.equal(parseMaterialCount('1,000'), 1000)
  assert.equal(parseMaterialCount('999 material'), 0)
})

test('keeps entered inventory within JavaScript safe-integer precision', () => {
  const plan = calculateUpgradePlan({
    item: getItem('relic'),
    currentLevel: 0,
    targetLevel: 1,
    ownedMaterials: '1e30',
  })

  assert.equal(plan.ownedMaterials, Number.MAX_SAFE_INTEGER)
})
