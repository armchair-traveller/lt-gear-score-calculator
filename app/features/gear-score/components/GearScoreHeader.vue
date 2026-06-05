<script setup>
import {
  CheckIcon,
  ClipboardIcon,
  ExternalLinkIcon,
  HammerIcon,
  InfoIcon,
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
  <header class="bg-background/95 backdrop-blur shadow-[0_1px_12px_rgb(15_23_42_/_0.04)] dark:shadow-none">
    <div class="mx-auto flex w-full max-w-[1600px] flex-wrap items-center justify-between gap-3 px-4 py-3 md:px-6">
      <div class="flex min-w-0 items-center gap-3">
        <div class="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted/55">
          <img class="size-11" src="/favicon.ico" alt="">
        </div>
        <div class="min-w-0">
          <h1 class="truncate text-lg font-semibold tracking-normal md:text-xl">
            LaTale Enchant Calculator
          </h1>
          <p class="truncate text-xs text-muted-foreground">
            {{ pieceType }} {{ gearType }} / {{ resultMode === 'rating' ? 'rating' : 'score' }}
          </p>
        </div>
      </div>

      <div class="flex items-center gap-2">
        <ModeToggle />

        <Tooltip>
          <TooltipTrigger as-child>
            <Button variant="outline" size="icon" as-child>
              <NuxtLink :to="upgradeHref">
                <HammerIcon />
                <span class="sr-only">Open upgrade material calculator</span>
              </NuxtLink>
            </Button>
          </TooltipTrigger>
          <TooltipContent>Upgrade calculator</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger as-child>
            <Button variant="outline" size="icon" as-child>
              <NuxtLink :to="planHref">
                <img class="size-5" src="/smart_priring.png" alt="">
                <span class="sr-only">Open planner</span>
              </NuxtLink>
            </Button>
          </TooltipTrigger>
          <TooltipContent>Planner</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger as-child>
            <Button variant="outline" size="icon" @click="disclaimerOpen = true">
              <InfoIcon />
              <span class="sr-only">Open calculator notes</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>Calculator notes</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger as-child>
            <Button variant="outline" size="icon" as-child>
              <a :href="gears[gearType]['Sheet Link']" target="_blank" rel="noreferrer">
                <TablePropertiesIcon />
                <span class="sr-only">Open detailed spreadsheet</span>
              </a>
            </Button>
          </TooltipTrigger>
          <TooltipContent>Detailed spreadsheet</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger as-child>
            <Button variant="outline" size="icon" @click="generateURL">
              <CheckIcon v-if="clipboardTooltip" class="text-emerald-600 dark:text-emerald-400" />
              <ClipboardIcon v-else />
              <span class="sr-only">{{ clipboardTooltip ? 'Copied share link' : 'Copy share link' }}</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>{{ clipboardTooltip ? 'Copied' : 'Copy link' }}</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger as-child>
            <Button variant="outline" size="icon" as-child>
              <a href="https://kedanao.github.io/lt-damage-calculator/" target="_blank" rel="noreferrer">
                <ExternalLinkIcon />
                <span class="sr-only">Open damage calculator</span>
              </a>
            </Button>
          </TooltipTrigger>
          <TooltipContent>Damage calculator</TooltipContent>
        </Tooltip>
      </div>
    </div>
  </header>
</template>
