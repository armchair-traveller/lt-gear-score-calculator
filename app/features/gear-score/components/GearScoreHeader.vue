<script setup>
import {
  CheckIcon,
  ClipboardIcon,
  ExternalLinkIcon,
  TablePropertiesIcon,
} from '@lucide/vue'

const {
  gears,
  gearType,
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
    </div>
  </Teleport>
</template>
