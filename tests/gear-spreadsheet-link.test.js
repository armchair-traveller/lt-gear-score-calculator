import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { getGearSpreadsheetHref } from '../app/utils/gear.js'

const headerPath = new URL(
  '../app/features/gear-score/components/GearScoreHeader.vue',
  import.meta.url,
)

test('normalizes missing spreadsheet links instead of resolving them to the current page', () => {
  assert.equal(getGearSpreadsheetHref('[sLv5] Accessories'), null)
  assert.equal(getGearSpreadsheetHref('[missing] Gear'), null)
  assert.match(
    getGearSpreadsheetHref('[9999] Armor'),
    /^https:\/\/docs\.google\.com\/spreadsheets\/d\/[^/]+(?:\/|$)/,
  )
})

test('renders a disabled resource when the selected gear has no spreadsheet', async () => {
  const source = await readFile(headerPath, 'utf8')

  assert.match(
    source,
    /<DropdownMenuItem(?=[^>]*\bv-if="gearSpreadsheetHref")(?=[^>]*\bas-child\b)[^>]*>/,
  )
  assert.match(
    source,
    /<a(?=[^>]*:href="gearSpreadsheetHref")(?=[^>]*target="_blank")(?=[^>]*rel="noreferrer")[^>]*>/,
  )
  assert.match(
    source,
    /<DropdownMenuItem(?=[^>]*\bv-else\b)(?=[^>]*\bdisabled\b)[^>]*>/,
  )
  assert.match(source, /Detailed spreadsheet unavailable/)
  assert.doesNotMatch(source, /:href="gears\[gearType\]\['Sheet Link'\]"/)
})
