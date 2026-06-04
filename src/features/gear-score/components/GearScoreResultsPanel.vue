<script setup>
import { computed } from 'vue'
import {
  ArrowDownIcon,
  ArrowUpIcon,
  BookmarkPlusIcon,
  CalculatorIcon,
  CameraIcon,
  CheckIcon,
  SparklesIcon,
  SwordsIcon,
  TablePropertiesIcon,
} from '@lucide/vue'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs'
import { useGearScoreCalculatorContext } from '@/features/gear-score/context.js'

const {
  gearType,
  pieceType,
  resultMode,
  statType,
  statInput,
  results,
  tierGuideRows,
  selectedTierRows,
  totalProgress,
  potentialProgress,
  potentialGainText,
  supportsGearPlan,
  canSaveToGearPlan,
  gearPlanSaveSucceeded,
  hasRolledValue,
  getProjectionEnchantLevel,
  moveSssOddsLine,
  getFinalUpgrade,
  openSnapshot,
  saveCurrentGearToPlan,
  clamp,
  getLineScoreText,
  getPotentialLineText,
  getPotentialLineTier,
  getTierClass,
  getRollStatusClass,
} = useGearScoreCalculatorContext()

const rolledLineIndexes = computed(() =>
  statType.value
    .map((_, index) => index)
    .filter((index) => hasRolledValue(index)),
)

const emptyLineCount = computed(() => statType.value.length - rolledLineIndexes.value.length)
const emptyLineSummary = computed(() =>
  emptyLineCount.value === 1 ? '1 unfilled line' : `${emptyLineCount.value} unfilled lines`,
)
</script>

<template>
  <section class="grid content-start gap-4">
    <Card class="rounded-lg">
      <CardHeader>
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle class="flex items-center gap-2 text-base">
              <CalculatorIcon class="size-4" />
              Results
            </CardTitle>
            <CardDescription>{{ pieceType }} {{ gearType }}</CardDescription>
          </div>

          <div class="flex flex-wrap items-center gap-2">
            <Tabs v-model="resultMode" class="w-auto">
              <TabsList>
                <TabsTrigger value="score">Score</TabsTrigger>
                <TabsTrigger value="rating">Rating</TabsTrigger>
              </TabsList>
            </Tabs>

            <Button variant="outline" size="sm" @click="openSnapshot">
              <CameraIcon />
              Snapshot
            </Button>

            <Button
              v-if="supportsGearPlan"
              variant="outline"
              size="sm"
              :disabled="!canSaveToGearPlan"
              @click="saveCurrentGearToPlan"
            >
              <CheckIcon v-if="gearPlanSaveSucceeded" class="text-emerald-600 dark:text-emerald-400" />
              <BookmarkPlusIcon v-else />
              {{ gearPlanSaveSucceeded ? 'Added' : 'Add to upgrade finder' }}
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent class="grid gap-4">
        <div
          class="grid gap-3"
          :class="rolledLineIndexes.length > 0 ? 'lg:grid-cols-[220px_1fr]' : 'lg:grid-cols-[220px]'"
        >
          <div class="rounded-lg bg-muted/20 p-4">
            <div class="text-sm text-muted-foreground">Total</div>
            <div class="mt-1 flex items-end gap-2">
              <div class="text-4xl font-semibold tracking-normal">
                {{ resultMode === 'rating' ? `${results.DI}%` : `${results.percent}%` }}
              </div>
              <Badge variant="outline" :class="getTierClass(results.tier)">
                {{ results.tier }}
              </Badge>
            </div>
            <Progress :model-value="totalProgress" class="mt-4 h-2" />
          </div>

          <div v-if="rolledLineIndexes.length > 0" class="overflow-hidden rounded-lg bg-muted/20">
            <div
              v-for="index in rolledLineIndexes"
              :key="`result-${index}`"
              class="grid gap-2 p-3"
            >
              <div class="flex flex-wrap items-center justify-between gap-2">
                <div class="min-w-0">
                  <div class="truncate text-sm font-medium">
                    {{ statType[index] }}
                  </div>
                  <div class="text-xs text-muted-foreground">
                    {{ statInput[index] }}
                  </div>
                </div>
                <div class="flex items-center gap-2">
                  <span class="text-sm font-semibold">{{ getLineScoreText(index) }}</span>
                  <Badge variant="outline" :class="getTierClass(results.individual[index].tier)">
                    {{ results.individual[index].tier }}
                  </Badge>
                </div>
              </div>
              <Progress :model-value="clamp(Number(results.individual[index].percent), 0, 100)" class="h-1.5" />
            </div>
            <div
              v-if="emptyLineCount > 0"
              class="border-t border-border/50 px-3 py-2 text-xs text-muted-foreground"
            >
              {{ emptyLineSummary }}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>

    <Card v-if="getFinalUpgrade(gearType) !== ''" class="rounded-lg">
      <Tabs default-value="summary" class="min-w-0 gap-6">
        <CardHeader>
          <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div class="min-w-0">
              <CardTitle class="flex items-center gap-2 text-base">
                <SparklesIcon class="size-4" />
                {{ getFinalUpgrade(gearType) }} Projection
              </CardTitle>
              <CardDescription>
                Lv.{{ getProjectionEnchantLevel() }} {{ pieceType }} {{ gearType }}
              </CardDescription>
            </div>

            <TabsList class="w-fit max-w-full">
              <TabsTrigger value="summary">Summary</TabsTrigger>
              <TabsTrigger value="lines">Lines</TabsTrigger>
              <TabsTrigger v-if="results.sssOdds.available" value="sss">SSS odds</TabsTrigger>
            </TabsList>
          </div>
        </CardHeader>

        <CardContent class="min-w-0">
          <TabsContent value="summary" class="m-0">
            <div
              class="grid gap-3"
              :class="rolledLineIndexes.length > 0 ? 'lg:grid-cols-[220px_1fr]' : 'lg:grid-cols-[220px]'"
            >
              <div class="rounded-lg bg-muted/20 p-4">
                <div class="text-sm text-muted-foreground">Projected</div>
                <div class="mt-1 flex items-end gap-2">
                  <div class="text-3xl font-semibold tracking-normal">
                    {{ resultMode === 'rating' ? results.potentialDI : results.potentialScore }}
                  </div>
                  <Badge variant="outline" :class="getTierClass(results.potentialTier)">
                    {{ results.potentialTier }}
                  </Badge>
                </div>
                <div class="mt-2 text-sm text-emerald-700 dark:text-emerald-300">{{ potentialGainText }} gain</div>
                <Progress :model-value="potentialProgress" class="mt-4 h-2" />
              </div>

              <div v-if="rolledLineIndexes.length > 0" class="overflow-hidden rounded-lg bg-muted/20">
                <div
                  v-for="index in rolledLineIndexes"
                  :key="`potential-${index}`"
                  class="grid gap-2 p-3"
                >
                  <div class="flex flex-wrap items-center justify-between gap-2">
                    <div class="min-w-0">
                      <div class="truncate text-sm font-medium">
                        {{ statType[index] }}:
                        <span v-if="results.individual[index].potentialMin === results.individual[index].potentialMax">
                          {{ results.individual[index].potentialMin }}
                        </span>
                        <span v-else>
                          {{ results.individual[index].potentialMin }} ~ {{ results.individual[index].potentialMax }}
                        </span>
                      </div>
                    </div>
                    <div class="flex items-center gap-2">
                      <span class="text-sm font-semibold">{{ getPotentialLineText(index) }}</span>
                      <Badge variant="outline" :class="getTierClass(getPotentialLineTier(index))">
                        {{ getPotentialLineTier(index) }}
                      </Badge>
                    </div>
                  </div>
                  <Progress :model-value="clamp(Number(results.individual[index].potentialMinPerc), 0, 100)" class="h-1.5" />
                </div>
                <div
                  v-if="emptyLineCount > 0"
                  class="border-t border-border/50 px-3 py-2 text-xs text-muted-foreground"
                >
                  {{ emptyLineSummary }}
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="lines" class="m-0 min-w-0">
            <Table container-class="max-h-[360px] min-w-0 rounded-lg border" class="min-w-[520px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Stat</TableHead>
                  <TableHead>Current</TableHead>
                  <TableHead>Max upgrade</TableHead>
                  <TableHead>Tier</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow v-for="(_, index) in statType" :key="`line-table-${index}`">
                  <TableCell class="font-medium">{{ statType[index] }}</TableCell>
                  <TableCell>{{ statInput[index] || '-' }}</TableCell>
                  <TableCell>
                    <span v-if="results.individual[index].potentialMin === results.individual[index].potentialMax">
                      {{ results.individual[index].potentialMin || '-' }}
                    </span>
                    <span v-else>
                      {{ results.individual[index].potentialMin }} ~ {{ results.individual[index].potentialMax }}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" :class="getTierClass(getPotentialLineTier(index))">
                      {{ getPotentialLineTier(index) }}
                    </Badge>
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </TabsContent>

          <TabsContent v-if="results.sssOdds.available" value="sss" class="m-0 grid min-w-0 gap-3">
            <div class="grid gap-3 md:grid-cols-5">
              <div class="rounded-lg bg-muted/20 p-3">
                <div class="text-xs text-muted-foreground">Total odds</div>
                <div class="text-lg font-semibold">{{ results.sssOdds.totalChanceText }}</div>
              </div>
              <div class="rounded-lg bg-muted/20 p-3">
                <div class="text-xs text-muted-foreground">Target</div>
                <div class="text-lg font-semibold">{{ results.sssOdds.targetScore }}</div>
              </div>
              <div class="rounded-lg bg-muted/20 p-3">
                <div class="text-xs text-muted-foreground">Planned</div>
                <div class="text-lg font-semibold">
                  {{ resultMode === 'rating' ? results.sssOdds.plannedDIText : results.sssOdds.plannedScoreText }}
                </div>
              </div>
              <div class="rounded-lg bg-muted/20 p-3">
                <div class="text-xs text-muted-foreground">Base rolls</div>
                <div class="text-lg font-semibold">{{ results.sssOdds.baseRollText }}</div>
              </div>
              <div class="rounded-lg bg-muted/20 p-3">
                <div class="text-xs text-muted-foreground">Full survival</div>
                <div class="text-lg font-semibold">{{ results.sssOdds.survivalChanceText }}</div>
              </div>
            </div>

            <Table container-class="max-h-[320px] min-w-0 rounded-lg border" class="min-w-[620px]">
              <TableHeader>
                <TableRow>
                  <TableHead class="w-[88px]">Order</TableHead>
                  <TableHead>Stat</TableHead>
                  <TableHead>Max upgrade value</TableHead>
                  <TableHead>Roll state</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow v-for="(line, position) in results.sssOdds.lines" :key="`${line.index}-${line.stat}`">
                  <TableCell>
                    <div class="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        class="size-7"
                        :disabled="position === 0"
                        title="Move earlier"
                        aria-label="Move earlier"
                        @click="moveSssOddsLine(position, -1)"
                      >
                        <ArrowUpIcon class="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        class="size-7"
                        :disabled="position === results.sssOdds.lines.length - 1"
                        title="Move later"
                        aria-label="Move later"
                        @click="moveSssOddsLine(position, 1)"
                      >
                        <ArrowDownIcon class="size-4" />
                      </Button>
                    </div>
                  </TableCell>
                  <TableCell class="font-medium">{{ line.stat }}</TableCell>
                  <TableCell>{{ line.range }}</TableCell>
                  <TableCell :class="getRollStatusClass(line.status)">{{ line.rollText }}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </TabsContent>
        </CardContent>
      </Tabs>
    </Card>

    <div class="grid gap-4 2xl:grid-cols-2">
      <Card class="rounded-lg">
        <CardHeader>
          <CardTitle class="flex items-center gap-2 text-base">
            <SwordsIcon class="size-4" />
            Tier Evaluation
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table container-class="rounded-lg border">
            <TableHeader>
              <TableRow>
                <TableHead>Tier</TableHead>
                <TableHead>Comment</TableHead>
                <TableHead>Upgrade</TableHead>
                <TableHead>Enchants</TableHead>
                <TableHead>Cost</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow v-for="row in tierGuideRows" :key="row.tier">
                <TableCell>
                  <Badge variant="outline" :class="getTierClass(row.tier)">{{ row.tier }}</Badge>
                </TableCell>
                <TableCell>{{ row.comment }}</TableCell>
                <TableCell>{{ row.upgrade }}</TableCell>
                <TableCell>{{ row.enchants }}</TableCell>
                <TableCell>{{ row.cost }}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card class="rounded-lg">
        <CardHeader>
          <CardTitle class="flex items-center gap-2 text-base">
            <TablePropertiesIcon class="size-4" />
            Tier Equivalence
          </CardTitle>
          <CardDescription>{{ pieceType }} {{ gearType }}</CardDescription>
        </CardHeader>
        <CardContent>
          <Table
            container-class="max-h-[360px] min-w-0 rounded-lg border"
            class="min-w-[720px] [&_td]:py-2.5 [&_th]:h-10"
          >
            <TableHeader>
              <TableRow>
                <TableHead>Score</TableHead>
                <TableHead>Tier</TableHead>
                <TableHead>Single</TableHead>
                <TableHead>Duo</TableHead>
                <TableHead>Trio</TableHead>
                <TableHead>Quad</TableHead>
                <TableHead>Penta</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow v-for="row in selectedTierRows" :key="row.tier">
                <TableCell>{{ row.Score }}</TableCell>
                <TableCell>
                  <Badge variant="outline" :class="getTierClass(row.tier)">{{ row.tier }}</Badge>
                </TableCell>
                <TableCell>{{ row.Single }}</TableCell>
                <TableCell>{{ row.Duo }}</TableCell>
                <TableCell>{{ row.Trio }}</TableCell>
                <TableCell>{{ row.Quad }}</TableCell>
                <TableCell>{{ row.Penta }}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  </section>
</template>
