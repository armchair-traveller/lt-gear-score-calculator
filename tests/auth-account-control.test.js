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
  assert.equal(source.match(/<Tooltip(?=[\s>])/g)?.length, 4)
  assert.equal(source.match(/data-account-tooltip-anchor/g)?.length, 2)
  assert.equal(source.match(/v-model:open="isAccountTooltipOpen"/g)?.length, 2)
  assert.equal(source.match(/@focusin="openAccountTooltipOnKeyboardFocus"/g)?.length, 2)
  assert.equal(source.match(/@focusout="isAccountTooltipOpen = false"/g)?.length, 2)
  assert.match(source, /event\.target\?\.matches\?\.\(':focus-visible'\)/)
  assert.match(source, /v-else-if="isSignedIn"/)
  assert.match(source, /Account menu for \$\{displayName\}/)
  assert.doesNotMatch(source, /\btitle=/)
  assert.match(
    source,
    /<TooltipTrigger as-child>\s*<span\s+class="inline-flex"\s+data-account-tooltip-anchor[\s\S]*?>\s*<DropdownMenu>/,
  )
  assert.doesNotMatch(
    source,
    /<TooltipTrigger as-child>\s*<DropdownMenuTrigger as-child>/,
  )
})
