<script setup>
import {
  ArrowRightIcon,
  CircleAlertIcon,
  CheckCircle2Icon,
  CheckIcon,
  CoinsIcon,
  GemIcon,
  Layers3Icon,
  MapPinIcon,
  PackageIcon,
  SearchIcon,
  Share2Icon,
  SparklesIcon,
} from '@lucide/vue'
import { computed } from 'vue'
import { useUpgradePlannerContext } from '@/features/upgrade/context.js'
import UpgradeStepJourney from '@/features/upgrade/components/UpgradeStepJourney.vue'

const {
  currentLevel,
  targetLevel,
  quantity,
  ownedMaterials,
  selectedItem,
  currentLevelOptions,
  targetLevelOptions,
  activeRangePreset,
  plan,
  shareCopied,
  shareCopyFailed,
  quantityInvalid,
  ownedMaterialsInvalid,
  openItemPicker,
  applyRangePreset,
  normalizeQuantity,
  normalizeOwnedMaterials,
  copyPlanLink,
  formatNumber,
  formatFee,
} = useUpgradePlannerContext()

const shareLabel = computed(() => {
  if (shareCopied.value) {
    return 'Link copied'
  }
  if (shareCopyFailed.value) {
    return 'Copy failed'
  }

  return 'Share plan'
})

const answerStatus = computed(() => {
  const route = `Upgrade plan from +${plan.value.currentLevel} to +${plan.value.targetLevel} for ${plan.value.quantity} ${plan.value.quantity === 1 ? 'item' : 'items'}.`
  if (plan.value.covered) {
    return `${route} Material covered with ${formatNumber(plan.value.extraMaterials)} left.`
  }

  return `${route} ${formatNumber(plan.value.remainingMaterials)} enhancement material still needed.`
})
</script>

<template>
  <Card class="upgrade-workbench !gap-0 overflow-hidden !py-0">
    <CardHeader class="upgrade-item-header">
      <div class="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div class="flex min-w-0 items-start gap-4">
          <span class="upgrade-item-seal" aria-hidden="true">
            <GemIcon />
          </span>
          <div class="min-w-0">
            <p class="upgrade-kicker">Selected work order</p>
            <CardTitle>
              <h2 class="mt-1 max-w-3xl text-xl font-bold leading-tight tracking-tight md:text-2xl">
                {{ selectedItem.name }}
              </h2>
            </CardTitle>
            <CardDescription class="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
              <span class="flex items-center gap-1.5">
                <MapPinIcon class="size-3.5" />
                {{ selectedItem.summary.farm }}
              </span>
              <span>Added {{ selectedItem.summary.quarter }}</span>
              <span>Maximum {{ selectedItem.summary.max }}</span>
            </CardDescription>
          </div>
        </div>

        <Button variant="outline" class="shrink-0" @click="openItemPicker">
          <SearchIcon data-icon="inline-start" />
          Change item
        </Button>
      </div>
    </CardHeader>

    <Separator />

    <CardContent class="grid p-0 lg:grid-cols-[380px_minmax(0,1fr)]">
      <section class="upgrade-inspector" aria-labelledby="upgrade-inspector-title">
        <div>
          <p class="upgrade-kicker">01 · Set the route</p>
          <h3 id="upgrade-inspector-title" class="mt-1 text-lg font-bold tracking-tight">
            Build your upgrade range
          </h3>
          <p class="mt-1 text-sm leading-relaxed text-muted-foreground">
            Choose the levels, copies, and material already in your inventory.
          </p>
        </div>

        <FieldGroup class="mt-6 gap-5">
          <div class="grid grid-cols-1 gap-3 min-[360px]:grid-cols-2">
            <Field>
              <FieldLabel for="upgrade-current-level">From</FieldLabel>
              <Select v-model="currentLevel">
                <SelectTrigger id="upgrade-current-level" class="w-full">
                  <SelectValue placeholder="Current level" />
                </SelectTrigger>
                <SelectContent class="upgrade-select-content upgrade-theme">
                  <SelectGroup>
                    <SelectItem
                      v-for="level in currentLevelOptions"
                      :key="level.value"
                      :value="level.value"
                    >
                      {{ level.label }}
                    </SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>

            <Field>
              <FieldLabel for="upgrade-target-level">To</FieldLabel>
              <Select v-model="targetLevel">
                <SelectTrigger id="upgrade-target-level" class="w-full">
                  <SelectValue placeholder="Target level" />
                </SelectTrigger>
                <SelectContent class="upgrade-select-content upgrade-theme">
                  <SelectGroup>
                    <SelectItem
                      v-for="level in targetLevelOptions"
                      :key="level.value"
                      :value="level.value"
                    >
                      {{ level.label }}
                    </SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
          </div>

          <Field>
            <FieldLabel id="upgrade-quick-range-label">Quick range</FieldLabel>
            <ToggleGroup
              type="single"
              variant="outline"
              :model-value="activeRangePreset"
              class="grid w-full grid-cols-3"
              aria-labelledby="upgrade-quick-range-label"
              @update:model-value="applyRangePreset"
            >
              <ToggleGroupItem value="next" class="w-full">
                Next
              </ToggleGroupItem>
              <ToggleGroupItem value="to-max" class="w-full">
                To max
              </ToggleGroupItem>
              <ToggleGroupItem value="full" class="w-full">
                Full run
              </ToggleGroupItem>
            </ToggleGroup>
          </Field>

          <div class="grid grid-cols-1 gap-3 min-[360px]:grid-cols-2">
            <Field :data-invalid="quantityInvalid || undefined">
              <FieldLabel for="upgrade-quantity">Copies</FieldLabel>
              <InputGroup>
                <InputGroupInput
                  id="upgrade-quantity"
                  v-model="quantity"
                  type="number"
                  inputmode="numeric"
                  min="1"
                  max="999"
                  :aria-invalid="quantityInvalid || undefined"
                  :aria-describedby="quantityInvalid
                    ? 'upgrade-quantity-description upgrade-quantity-error'
                    : 'upgrade-quantity-description'"
                  @blur="normalizeQuantity"
                />
                <InputGroupAddon align="inline-end">
                  <InputGroupText>items</InputGroupText>
                </InputGroupAddon>
              </InputGroup>
              <FieldDescription id="upgrade-quantity-description">
                Same route per copy
              </FieldDescription>
              <FieldError v-if="quantityInvalid" id="upgrade-quantity-error">
                Enter a whole number from 1 to 999.
              </FieldError>
            </Field>

            <Field :data-invalid="ownedMaterialsInvalid || undefined">
              <FieldLabel for="upgrade-owned-materials">Material owned</FieldLabel>
              <InputGroup>
                <InputGroupInput
                  id="upgrade-owned-materials"
                  v-model="ownedMaterials"
                  type="number"
                  inputmode="numeric"
                  min="0"
                  :aria-invalid="ownedMaterialsInvalid || undefined"
                  :aria-describedby="ownedMaterialsInvalid
                    ? 'upgrade-owned-description upgrade-owned-error'
                    : 'upgrade-owned-description'"
                  @blur="normalizeOwnedMaterials"
                />
                <InputGroupAddon align="inline-end">
                  <InputGroupText>owned</InputGroupText>
                </InputGroupAddon>
              </InputGroup>
              <FieldDescription id="upgrade-owned-description">
                Primary material only
              </FieldDescription>
              <FieldError v-if="ownedMaterialsInvalid" id="upgrade-owned-error">
                Enter a non-negative whole number within the supported range.
              </FieldError>
            </Field>
          </div>
        </FieldGroup>

        <div class="upgrade-source-note">
          <MapPinIcon class="size-4 shrink-0" />
          <p>
            Farm the enhancement material at
            <strong>{{ selectedItem.summary.farm }}</strong>.
          </p>
        </div>
      </section>

      <div class="min-w-0">
        <section
          class="upgrade-answer"
          :data-covered="plan.covered || undefined"
          aria-labelledby="upgrade-answer-title"
        >
          <div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p class="upgrade-answer-kicker">02 · Live work order</p>
              <h3 id="upgrade-answer-title" class="mt-1 flex items-center gap-2 text-xl font-bold tracking-tight">
                +{{ plan.currentLevel }}
                <ArrowRightIcon class="size-4 opacity-60" />
                +{{ plan.targetLevel }}
                <span class="text-sm font-medium opacity-60">
                  × {{ plan.quantity }}
                </span>
              </h3>
            </div>

            <Button variant="secondary" size="sm" @click="copyPlanLink">
              <CheckIcon v-if="shareCopied" data-icon="inline-start" />
              <CircleAlertIcon v-else-if="shareCopyFailed" data-icon="inline-start" />
              <Share2Icon v-else data-icon="inline-start" />
              <span aria-live="polite">{{ shareLabel }}</span>
            </Button>
          </div>

          <p class="sr-only" role="status" aria-live="polite" aria-atomic="true">
            {{ answerStatus }}
          </p>

          <div class="upgrade-answer-primary">
            <Badge :variant="plan.covered ? 'default' : 'secondary'">
              <CheckCircle2Icon v-if="plan.covered" data-icon="inline-start" />
              <PackageIcon v-else data-icon="inline-start" />
              {{ plan.covered ? 'Primary material covered' : 'Inventory gap' }}
            </Badge>

            <MotionValue
              :motion-key="plan.covered ? 'covered' : plan.remainingMaterials"
              as="strong"
              class="upgrade-answer-value motion-tabular"
            >
              {{ plan.covered ? 'Covered' : formatNumber(plan.remainingMaterials) }}
            </MotionValue>
            <p>
              {{ plan.covered
                ? `${formatNumber(plan.extraMaterials)} material left after this target`
                : 'enhancement material still needed' }}
            </p>
          </div>

          <div class="upgrade-coverage">
            <div class="flex items-center justify-between gap-4 text-xs font-semibold">
              <span class="motion-tabular">
                {{ formatNumber(plan.ownedMaterials) }} owned
              </span>
              <span class="motion-tabular">
                {{ formatNumber(plan.requiredMaterials) }} required
              </span>
            </div>
            <Progress
              :model-value="plan.coveragePercent"
              class="upgrade-coverage-progress mt-2"
              :aria-label="`${Math.round(plan.coveragePercent)}% of primary material covered`"
            />
          </div>

          <div class="upgrade-answer-metrics">
            <div>
              <PackageIcon class="size-4" />
              <span>Required</span>
              <MotionValue
                :motion-key="plan.requiredMaterials"
                as="strong"
                class="motion-tabular"
              >
                {{ formatNumber(plan.requiredMaterials) }}
              </MotionValue>
            </div>
            <div>
              <CoinsIcon class="size-4" />
              <span>Ely fee</span>
              <MotionValue
                :motion-key="plan.requiredFeeMillions"
                as="strong"
                class="motion-tabular"
              >
                {{ formatFee(plan.requiredFeeMillions) }}
              </MotionValue>
            </div>
            <div>
              <Layers3Icon class="size-4" />
              <span>Inventory reaches</span>
              <MotionValue
                :motion-key="plan.reachableLevel"
                as="strong"
                class="motion-tabular"
              >
                +{{ plan.reachableLevel }}
              </MotionValue>
            </div>
            <div>
              <SparklesIcon class="size-4" />
              <span>{{ plan.ascensionRequirement ? 'Additional stone' : 'Steps planned' }}</span>
              <MotionValue
                :motion-key="plan.ascensionRequirement?.total ?? plan.steps.length"
                as="strong"
                class="motion-tabular"
              >
                {{ plan.ascensionRequirement
                  ? formatNumber(plan.ascensionRequirement.total)
                  : plan.steps.length }}
              </MotionValue>
            </div>
          </div>

          <div class="upgrade-answer-note">
            <CheckCircle2Icon v-if="plan.covered" class="size-4 shrink-0" />
            <SparklesIcon v-else-if="plan.ownedMaterials" class="size-4 shrink-0" />
            <PackageIcon v-else class="size-4 shrink-0" />
            <p v-if="plan.covered">
              The primary material is covered. Ely fees and additional stones are listed, not tracked as owned.
            </p>
            <p v-else-if="plan.ownedMaterials && plan.nextStep">
              Your inventory completes through +{{ plan.reachableLevel }}.
              Add {{ formatNumber(plan.nextStepShortage) }} more to unlock +{{ plan.nextStep.level }}.
            </p>
            <p v-else>
              Enter your inventory to reveal the highest level you can complete right now.
            </p>
          </div>

          <div v-if="plan.ascensionRequirement" class="upgrade-ascension">
            <SparklesIcon class="size-5 shrink-0" />
            <div class="min-w-0">
              <strong>{{ plan.ascensionRequirement.name }}</strong>
              <p class="motion-tabular">
                {{ formatNumber(plan.ascensionRequirement.total) }} required
                · {{ formatNumber(plan.ascensionRequirement.perItem) }} per item
              </p>
            </div>
          </div>
        </section>

        <Separator />

        <UpgradeStepJourney />
      </div>
    </CardContent>
  </Card>
</template>
