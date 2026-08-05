<script setup>
import {
  ArrowLeftRightIcon,
  CheckIcon,
  ClipboardIcon,
  ExternalLinkIcon,
  TablePropertiesIcon,
} from '@lucide/vue'

const {
  gearSpreadsheetHref,
  damageCalculatorHref,
  damageComparisonHref,
  canCompareInDamageCalculator,
  damageComparisonUnavailableReason,
  disclaimerOpen,
  clipboardTooltip,
  generateURL,
} = useGearScoreCalculatorContext()

const appShell = useAppShellContext()
const unregisterHelpHandler = appShell.registerHelpHandler('calculator', () => {
  disclaimerOpen.value = true
})

onBeforeUnmount(unregisterHelpHandler)
</script>

<template>
  <Teleport to="#app-shell-utilities">
    <div class="contents">
      <Tooltip>
        <TooltipTrigger as-child>
          <Button variant="outline" size="sm" class="min-w-[6.5rem]" @click="generateURL">
            <Transition name="motion-pop" mode="out-in">
              <CheckIcon v-if="clipboardTooltip" key="copied" data-icon="inline-start" />
              <ClipboardIcon v-else key="share" data-icon="inline-start" />
            </Transition>
            <span>{{ clipboardTooltip ? 'Copied' : 'Share' }}</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent>{{ clipboardTooltip ? 'Link copied' : 'Copy calculator link' }}</TooltipContent>
      </Tooltip>
      <span class="sr-only" aria-live="polite">{{ clipboardTooltip ? 'Link copied' : '' }}</span>

      <DropdownMenu>
        <DropdownMenuTrigger as-child>
          <Button variant="ghost" size="icon" aria-label="Calculator resources">
            <TablePropertiesIcon />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>Resources</DropdownMenuLabel>
          <DropdownMenuGroup>
            <DropdownMenuItem v-if="gearSpreadsheetHref" as-child>
              <a :href="gearSpreadsheetHref" target="_blank" rel="noreferrer">
                <TablePropertiesIcon />
                Detailed spreadsheet
              </a>
            </DropdownMenuItem>
            <DropdownMenuItem v-else disabled>
              <TablePropertiesIcon />
              Detailed spreadsheet unavailable
            </DropdownMenuItem>
            <DropdownMenuItem as-child>
              <a :href="damageCalculatorHref" target="_blank" rel="noreferrer">
                <ExternalLinkIcon />
                Damage calculator
              </a>
            </DropdownMenuItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuLabel>Advanced</DropdownMenuLabel>
          <DropdownMenuGroup>
            <DropdownMenuItem v-if="canCompareInDamageCalculator" as-child>
              <a :href="damageComparisonHref" target="_blank" rel="noreferrer">
                <ArrowLeftRightIcon />
                Compare this gear
              </a>
            </DropdownMenuItem>
            <DropdownMenuItem v-else disabled>
              <ArrowLeftRightIcon />
              {{ damageComparisonUnavailableReason }}
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  </Teleport>
</template>
