import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const accountControlPath = new URL(
  '../app/components/AuthAccountControl.vue',
  import.meta.url,
)

test('desktop account states use one icon-only control at every width', async () => {
  const source = await readFile(accountControlPath, 'utf8')

  assert.equal(source.match(/size="icon"/g)?.length, 4)
  assert.doesNotMatch(source, /\bw-48\b|\bw-full\b/)
  assert.doesNotMatch(source, /auth-account-(?:label|chevron)|useMediaQuery/)
  assert.match(source, /<Tooltip :delay-duration="200">/)
  assert.match(source, /<DropdownMenu v-else-if="isSignedIn">/)
  assert.match(source, /Account menu for \$\{displayName\}/)
})
