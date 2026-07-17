import assert from 'node:assert/strict'
import test from 'node:test'
import {
  formatTierProgressText,
  getTierGuideDetails,
} from '../app/features/gear-score/tier-guide.js'

const tierRows = [
  { tier: 'F', Penta: 'Any', Score: '0% - 29%' },
  { tier: 'E', Penta: '30%', Score: '30% - 39%' },
  { tier: 'D', Penta: '40%', Score: '40% - 49%' },
  { tier: 'C', Penta: '50%', Score: '50% - 55%' },
  { tier: 'B', Penta: '56%', Score: '56% - 63%' },
  { tier: 'A', Penta: '64%', Score: '64% - 71%' },
  { tier: 'S', Penta: '72%', Score: '72% - 80%' },
  { tier: 'SS', Penta: '81%', Score: '81% - 90%' },
  { tier: 'SSS', Penta: '91%', Score: '91%+' },
]

const guideRows = [
  { tier: 'F - E', comment: 'Replace later' },
  { tier: 'D - C', comment: 'Minimum replacement' },
  { tier: 'B', comment: 'Growth tier' },
  { tier: 'A', comment: 'Late endgame target' },
  { tier: 'S - SSS', comment: 'Perfection range' },
]

test('returns the next Penta threshold and remaining score points', () => {
  const details = getTierGuideDetails({
    tierRows,
    guideRows,
    currentTier: 'A',
    currentPercent: 68,
  })

  assert.equal(details.currentTierRow.tier, 'A')
  assert.equal(details.currentGuideRow.tier, 'A')
  assert.equal(details.nextTierRow.tier, 'S')
  assert.equal(details.nextTierThreshold, 72)
  assert.equal(details.pointsToNextTier, 4)
})

test('handles the Any threshold on the first tier', () => {
  const details = getTierGuideDetails({
    tierRows,
    guideRows,
    currentTier: 'F',
    currentPercent: 0,
  })

  assert.equal(details.nextTierThreshold, 30)
  assert.equal(details.pointsToNextTier, 30)
  assert.equal(details.currentGuideRow.tier, 'F - E')
})

test('matches grouped guide rows without confusing S and SS', () => {
  const details = getTierGuideDetails({
    tierRows,
    guideRows,
    currentTier: 'SS',
    currentPercent: 88,
  })

  assert.equal(details.currentGuideRow.tier, 'S - SSS')
  assert.equal(details.nextTierRow.tier, 'SSS')
})

test('returns no next threshold at the highest tier', () => {
  const details = getTierGuideDetails({
    tierRows,
    guideRows,
    currentTier: 'SSS',
    currentPercent: 96,
  })

  assert.equal(details.nextTierRow, null)
  assert.equal(details.nextTierThreshold, null)
  assert.equal(details.pointsToNextTier, null)
})

test('formats the compact next-tier caption', () => {
  const details = getTierGuideDetails({
    tierRows,
    guideRows,
    currentTier: 'A',
    currentPercent: 68,
  })

  assert.equal(formatTierProgressText(details), 'Next S: 72% · 4 score pts')
})

test('uses a singular point unit when one score point remains', () => {
  const details = getTierGuideDetails({
    tierRows,
    guideRows,
    currentTier: 'A',
    currentPercent: 71,
  })

  assert.equal(formatTierProgressText(details), 'Next S: 72% · 1 score pt')
})

test('formats the highest-tier state without a missing threshold', () => {
  const details = getTierGuideDetails({
    tierRows,
    guideRows,
    currentTier: 'SSS',
    currentPercent: 96,
  })

  assert.equal(formatTierProgressText(details), 'Highest tier reached')
})

test('distinguishes an unavailable threshold from the highest tier', () => {
  const details = getTierGuideDetails({
    tierRows: [
      tierRows[0],
      { ...tierRows[1], Penta: '--' },
    ],
    guideRows,
    currentTier: 'F',
    currentPercent: 0,
  })

  assert.equal(formatTierProgressText(details), 'Next E: threshold unavailable')
})

test('does not describe an unknown current tier as the highest tier', () => {
  const details = getTierGuideDetails({
    tierRows,
    guideRows,
    currentTier: 'Unknown',
    currentPercent: 68,
  })

  assert.equal(formatTierProgressText(details), 'Tier progress unavailable')
})
