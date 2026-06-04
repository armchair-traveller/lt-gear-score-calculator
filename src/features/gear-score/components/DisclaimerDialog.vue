<script setup>
import { LinkIcon } from '@lucide/vue'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useGearScoreCalculatorContext } from '@/features/gear-score/context.js'

const {
  disclaimerOpen,
  acceptDisclaimer,
} = useGearScoreCalculatorContext()
</script>

<template>
  <Dialog v-model:open="disclaimerOpen">
    <DialogContent class="max-h-[90vh] max-w-3xl overflow-y-auto rounded-lg">
      <DialogHeader>
        <DialogTitle>LaTale Enchant Calculator</DialogTitle>
        <DialogDescription>
          Hypothetical single-item damage scoring.
        </DialogDescription>
      </DialogHeader>

      <div class="grid gap-3 text-sm leading-6 text-muted-foreground">
        <p>
          This calculator only scores one item. Your other stats, class behavior, summons, and content can change the real value of a piece.
        </p>
        <p>
          Ratings are based on +0 unupgraded enchant values. Extra stats from level 3-5 enchants increase score and should not be read as the same thing as +0 enchants.
        </p>
        <ul class="list-disc space-y-2 pl-5">
          <li>Minimum Damage only applies while your minimum is lower than your maximum.</li>
          <li>Defense Penetration and Back Attack Damage are weaker for summon-heavy classes.</li>
          <li>Attack/Intensity and Strength/Magic priorities depend heavily on class and current stats.</li>
          <li>For broader stat and item testing, use the linked Damage Calculator and detailed sheets.</li>
        </ul>
      </div>

      <DialogFooter class="flex-col sm:flex-row-reverse">
        <Button @click="acceptDisclaimer">Accept</Button>
        <Button variant="outline" as-child>
          <a href="https://kedanao.github.io/lt-damage-calculator/" target="_blank" rel="noreferrer">
            <LinkIcon />
            Damage Calculator
          </a>
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
