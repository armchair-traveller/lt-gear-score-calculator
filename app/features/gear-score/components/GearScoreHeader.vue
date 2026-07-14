<script setup>
import {
  CheckIcon,
  ClipboardIcon,
  ExternalLinkIcon,
  TablePropertiesIcon,
} from '@lucide/vue'

const {
  gears,
  upgradeHref,
  planHref,
  gearType,
  pieceType,
  resultMode,
  disclaimerOpen,
  clipboardTooltip,
  generateURL,
} = useGearScoreCalculatorContext()
</script>

<template>
  <AppShellHeader
    active="calculator"
    eyebrow="Gear score · live calculation"
    title="A clearer path to your next upgrade."
    description="Enter the rolls you have now, compare their strength, and see what the fully upgraded piece could become."
    show-help
    @help="disclaimerOpen = true"
  >
    <template #utilities>
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
          <DropdownMenuGroup>
            <DropdownMenuItem as-child>
              <a :href="gears[gearType]['Sheet Link']" target="_blank" rel="noreferrer">
                <TablePropertiesIcon />
                Detailed spreadsheet
              </a>
            </DropdownMenuItem>
            <DropdownMenuItem as-child>
              <a href="https://kedanao.github.io/lt-damage-calculator/" target="_blank" rel="noreferrer">
                <ExternalLinkIcon />
                Damage calculator
              </a>
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </template>
  </AppShellHeader>
</template>
