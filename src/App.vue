<script setup>
import { computed, ref, watch } from 'vue'
import {
  ArrowDownIcon,
  ArrowUpIcon,
  CalculatorIcon,
  CheckIcon,
  ChevronRightIcon,
  ClipboardIcon,
  ExternalLinkIcon,
  InfoIcon,
  LinkIcon,
  RefreshCcwIcon,
  SearchIcon,
  ShieldCheckIcon,
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
import {
  Combobox,
  ComboboxAnchor,
  ComboboxEmpty,
  ComboboxGroup,
  ComboboxInput,
  ComboboxItem,
  ComboboxItemIndicator,
  ComboboxList,
  ComboboxViewport,
} from '@/components/ui/combobox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import ModeToggle from '@/components/ModeToggle.vue'
import gears from './utils/gear.js'
import tiers from './utils/tiers.js'

const decimalStats = ['Normal Amplification', 'Boss Amplification', 'Cooldown Reduction']
const sssOddsGearTypes = ['[9999] Armor', '[9000] Accessories', '[8000] Weapons']
const enchantSuccessRate = 0.6
const ratingScale = 1000

const gearType = ref('[9999] Armor')
const pieceType = ref('Helmet')
const highlightedPiece = ref(['[9999] Armor', 'Helmet'])
const valueButton = ref('90')
const resultMode = ref('score')

const statType = ref([])
const statInput = ref(['', '', '', '', ''])
const sssOddsOrder = ref([0, 1, 2, 3, 4])
const validStats = ref([])

const imgUrls = import.meta.glob('./assets/*.png', {
  import: 'default',
  eager: true,
})

const hasSeenDisclaimer = localStorage.getItem('ltGearCalculatorDisclaimerAccepted') === 'true'
const disclaimerOpen = ref(!hasSeenDisclaimer)
const gearSheetOpen = ref(false)
const clipboardTooltip = ref(false)
const clipboardToolTipTimeout = ref(null)

const results = ref({
  individual: [
    createEmptyIndividualResult(),
    createEmptyIndividualResult(),
    createEmptyIndividualResult(),
    createEmptyIndividualResult(),
    createEmptyIndividualResult(),
  ],
  DI: '',
  percent: '',
  tier: '',
  potentialScore: '',
  potentialDI: '',
  potentialTier: '',
  sssOdds: getEmptySssOdds(),
})

const tierGuideRows = [
  {
    tier: 'F - E',
    comment: 'Replaces unfinished previous tier',
    upgrade: 'No',
    enchants: 'Any',
    cost: '0b - 5b',
  },
  {
    tier: 'D - C',
    comment: 'Minimum to replace previous tier',
    upgrade: 'No',
    enchants: 'Duo',
    cost: '5b - 30b',
  },
  {
    tier: 'B',
    comment: 'Good growth over previous tier',
    upgrade: 'Yes',
    enchants: 'Trio',
    cost: '60b - 120b',
  },
  {
    tier: 'A',
    comment: 'Late endgame upgrade target',
    upgrade: 'Yes',
    enchants: 'Quad',
    cost: '200b+',
  },
  {
    tier: 'S - SSS',
    comment: 'Perfection range, usually upgraded enchants',
    upgrade: 'Yes',
    enchants: 'Penta',
    cost: '1000b+',
  },
]

const traitCatalog = [
  {
    id: 'back',
    image: 'Note_Back.png',
    label: 'Back attack',
    text: 'Back Attack Damage only works with direct damage and asks for reliable positioning.',
    test: (stats) => stats.includes('Back Attack Damage'),
  },
  {
    id: 'penetration',
    image: 'Note_Penetration.png',
    label: 'Penetration',
    text: 'Defense Penetration does not function with summons and depends on your status-window penetration.',
    test: (stats) => stats.includes('Defense Penetration'),
  },
  {
    id: 'attack',
    image: 'Note_Attack.png',
    label: 'Attack',
    text: 'Multiple Attack/Intensity lines usually favor direct-hit classes.',
    test: (stats) => stats.includes('Attack/Intensity') + stats.includes('Attack/Intensity %') > 1,
  },
  {
    id: 'strength',
    image: 'Note_Strength.png',
    label: 'Strength',
    text: 'Multiple Strength/Magic lines usually favor summon-heavy classes.',
    test: (stats) =>
      stats.includes('Basic Stats %') + stats.includes('Strength/Magic') + stats.includes('Basic Stats') > 1,
  },
  {
    id: 'minimum',
    image: 'Note_Minimum.png',
    label: 'Minimum',
    text: 'Minimum Damage only helps while your minimum damage is below your maximum damage.',
    test: (stats) => stats.includes('Minimum Damage'),
  },
  {
    id: 'hp',
    image: 'Note_HP.png',
    label: 'HP',
    text: 'HP and stamina lines add survivability but no offensive score.',
    test: (stats) =>
      stats.includes('Maximum HP %') ||
      stats.includes('Basic Stats') ||
      stats.includes('Basic Stats %') ||
      stats.includes('Stamina'),
  },
]

const statIndex = [
  'Critical Damage', 'Normal Amplification', 'Basic Stats', 'Attack/Intensity', 'Accuracy', 'Strength/Magic',
  'Minimum Damage', 'Back Attack Damage', 'Static Damage %', 'Boss Added Damage', 'Normal Added Damage',
  'Stamina', 'Maximum HP %', 'Other (Non-damaging)', 'Maximum Damage', 'Basic Stats %', 'Attack/Intensity %',
  'Boss Amplification', 'Movement Speed', 'Static Damage', 'Normal Added %', 'Dual Damage', 'Defense Penetration',
  'Boss Added %', 'Strength/Magic %', 'Boss Added', 'Normal Added', 'Cooldown Reduction', 'Only Strength/Magic', 'Maximum HP',
]

const gearCategories = computed(() => Object.keys(gears))
const pieceOptions = computed(() => getPieceNames(gearType.value))
const currentItem = computed(() => gears[gearType.value]?.[pieceType.value])
const statOptions = computed(() => Object.keys(currentItem.value?.Stats ?? {}))
const selectedImage = computed(() => getItemImage(pieceType.value, gearType.value))
const selectedTierRows = computed(() => getTierRows(gearType.value, pieceType.value))
const highlightedStats = computed(() => Object.keys(highlightedItem.value?.Stats ?? {}))
const highlightedItem = computed(() => gears[highlightedPiece.value[0]]?.[highlightedPiece.value[1]])
const highlightedTierRows = computed(() => getTierRows(highlightedPiece.value[0], highlightedPiece.value[1]))
const selectedTraitRows = computed(() => getTraitMatches(validStats.value))
const highlightedTraitRows = computed(() => getTraitMatches(highlightedStats.value))
const totalProgress = computed(() => clamp(Number(results.value.percent), 0, 100))
const potentialProgress = computed(() => clamp(getFirstPercent(results.value.potentialScore), 0, 100))
const potentialGainText = computed(() => {
  if (resultMode.value === 'rating') {
    return formatGainRange(results.value.potentialDI, Number(results.value.DI))
  }

  return formatGainRange(results.value.potentialScore, Number(results.value.percent))
})

function createEmptyIndividualResult() {
  return {
    DI: '',
    percent: '',
    tier: '',
    potentialMin: '',
    potentialMax: '',
    potentialMinPerc: '',
    potentialMaxPerc: '',
    potentialDIMin: '',
    potentialDIMax: '',
    potentialTierMin: '',
    potentialTierMax: '',
  }
}

function getPieceNames(category) {
  return Object.keys(gears[category] ?? {}).filter((key) => !['Sheet Link', 'Potential'].includes(key))
}

function getItemImage(piece, category) {
  return imgUrls[`./assets/${piece}_${category.slice(1, 5)}.png`] ?? ''
}

function getAsset(name) {
  return imgUrls[`./assets/${name}`] ?? ''
}

function getTierRows(category, piece) {
  const item = gears[category]?.[piece]
  if (!item) {
    return []
  }

  return Object.entries(tiers[category][item.Type]).map(([tier, values]) => ({
    tier,
    ...values,
  }))
}

function getTraitMatches(stats) {
  return traitCatalog.filter((trait) => trait.test(stats))
}

function setGear(category, piece) {
  gearType.value = category
  pieceType.value = piece
  highlightedPiece.value = [category, piece]
  gearSheetOpen.value = false
}

function changePiece() {
  const options = statOptions.value
  statType.value = options.slice(0, 5)
  resetSssOddsOrder()
  setValues(0, 0)
}

function isDecimalStat(stat) {
  return decimalStats.includes(stat)
}

function getStatStep(stat) {
  return isDecimalStat(stat) ? 0.1 : 1
}

function getInputValue(index) {
  const value = parseFloat(statInput.value[index])
  return Number.isFinite(value) ? value : 0
}

function hasRolledValue(index) {
  return statInput.value[index] !== '' && getInputValue(index) > 0
}

function getPotentialMultiplier(item = gearType.value) {
  return parseInt(item.slice(1, 5)) < 9999 ? 2 : 3
}

function getTierForPercent(percent, tierEquivalence, tierAvailable) {
  let tier = 'F'
  tierAvailable.forEach((entry) => {
    if (parseInt(percent) >= parseInt(tierEquivalence[entry].Penta)) {
      tier = entry
    }
  })

  return tier
}

function formatStatValue(value, stat) {
  if (!Number.isFinite(value)) {
    return '0'
  }

  if (isDecimalStat(stat)) {
    return value.toFixed(1)
  }

  return Number.isInteger(value) ? value.toFixed(0) : value.toFixed(1).replace(/\.0$/, '')
}

function formatRange(minValue, maxValue, stat) {
  const minText = formatStatValue(minValue, stat)
  const maxText = formatStatValue(maxValue, stat)

  return minText === maxText ? minText : `${minText} ~ ${maxText}`
}

function formatProbability(probability) {
  if (probability <= 0) {
    return '0%'
  }

  const percent = probability * 100
  if (percent >= 10) {
    return percent.toFixed(1) + '%'
  }
  if (percent >= 1) {
    return percent.toFixed(2) + '%'
  }
  if (percent >= 0.01) {
    return percent.toFixed(3) + '%'
  }

  return percent.toFixed(4) + '%'
}

function formatBaseRollSummary(count, alreadyComplete = false) {
  if (alreadyComplete) {
    return 'None needed'
  }

  return count === 0 ? 'None' : `Up to ${count} @ 60%`
}

function getRollDistribution(minRoll, maxRoll, step, maxValue, maxDI) {
  const buckets = new Map()
  const rollCount = Math.max(1, Math.round((maxRoll - minRoll) / step) + 1)

  for (let i = 0; i < rollCount; i++) {
    const rollValue = Math.min(maxRoll, minRoll + (i * step))
    const rating = rollValue / maxValue * maxDI
    const score = Math.round(rating * ratingScale)
    buckets.set(score, (buckets.get(score) || 0) + 1)
  }

  return Array.from(buckets, ([score, count]) => ({
    score,
    probability: count / rollCount,
  }))
}

function getSssOddsOrder() {
  const maxLines = statType.value.length
  const ordered = sssOddsOrder.value.filter((index) => Number.isInteger(index) && index >= 0 && index < maxLines)

  for (let i = 0; i < maxLines; i++) {
    if (!ordered.includes(i)) {
      ordered.push(i)
    }
  }

  return ordered
}

function resetSssOddsOrder() {
  sssOddsOrder.value = statType.value.map((_, index) => index)
}

function moveSssOddsLine(position, direction) {
  const order = getSssOddsOrder()
  const nextPosition = position + direction

  if (nextPosition < 0 || nextPosition >= order.length) {
    return
  }

  const nextOrder = order.slice()
  ;[nextOrder[position], nextOrder[nextPosition]] = [nextOrder[nextPosition], nextOrder[position]]
  sssOddsOrder.value = nextOrder
  updateValues()
}

function getEmptySssOdds() {
  return {
    available: false,
    totalChance: 0,
    totalChanceText: '',
    survivalChance: 0,
    survivalChanceText: '',
    rollValueChance: 0,
    rollValueChanceText: '',
    futureRolls: 0,
    futureBaseLines: 0,
    upgradeRolls: 0,
    targetScore: '',
    plannedScoreText: '',
    plannedDIText: '',
    baseRollText: '',
    lines: [],
  }
}

function calculateSssOdds(tierEquivalence, potentialMultiplier) {
  if (!sssOddsGearTypes.includes(gearType.value) || !tierEquivalence.SSS) {
    return getEmptySssOdds()
  }

  const item = currentItem.value
  const targetPercent = parseInt(tierEquivalence.SSS.Penta)
  const targetRating = item.DI * targetPercent / 100
  const targetScore = Math.ceil(targetRating * ratingScale)

  let fixedScore = 0
  let futureBaseLines = 0
  let plannedMinRating = 0
  let plannedMaxRating = 0
  const lines = []
  const rollableFutureLines = []

  for (const lineIndex of getSssOddsOrder()) {
    const stat = statType.value[lineIndex]
    const statInfo = item.Stats[stat]
    if (!statInfo) {
      continue
    }

    const maxValue = statInfo.Value
    const maxDI = statInfo.DI
    const potential = statInfo.Potential
    const shouldRollLine = maxDI > 0
    const currentValue = getInputValue(lineIndex)
    const step = getStatStep(stat)
    const hasValue = hasRolledValue(lineIndex)
    const upgradeMinValue = potential[0] * potentialMultiplier
    const upgradeMaxValue = potential[1] * potentialMultiplier
    const upgradeScore = Math.round(upgradeMinValue / maxValue * maxDI * ratingScale)

    let lineMinValue = hasValue ? currentValue : step
    let lineMaxValue = hasValue ? currentValue : maxValue
    lineMinValue += upgradeMinValue
    lineMaxValue += upgradeMaxValue

    if (!shouldRollLine) {
      // Non-damaging lines are ignored for SSS attempts, so they add no survival risk.
    }
    else if (hasValue) {
      fixedScore += upgradeScore
      fixedScore += Math.round(currentValue / maxValue * maxDI * ratingScale)
    }
    else {
      futureBaseLines += 1
      rollableFutureLines.push({
        upgradeScore,
        distribution: getRollDistribution(step, maxValue, step, maxValue, maxDI),
      })
    }

    plannedMinRating += lineMinValue / maxValue * maxDI
    plannedMaxRating += lineMaxValue / maxValue * maxDI
    lines.push({
      index: lineIndex,
      stat,
      range: shouldRollLine ? formatRange(lineMinValue, lineMaxValue, stat) : 'Ignored',
      rollText: !shouldRollLine ? 'not rolled' : hasValue ? 'already rolled' : '60% base roll',
      status: !shouldRollLine ? 'ignored' : hasValue ? 'upgrade' : 'new',
    })
  }

  let activeOutcomes = fixedScore >= targetScore ? new Map() : new Map([[fixedScore, 1]])
  let totalChance = fixedScore >= targetScore ? 1 : 0

  for (const line of rollableFutureLines) {
    if (activeOutcomes.size === 0) {
      break
    }

    const nextOutcomes = new Map()

    activeOutcomes.forEach((currentProbability, currentScore) => {
      const survivedProbability = currentProbability * enchantSuccessRate

      line.distribution.forEach((roll) => {
        const nextScore = currentScore + line.upgradeScore + roll.score
        const nextProbability = survivedProbability * roll.probability

        if (nextScore >= targetScore) {
          totalChance += nextProbability
        }
        else {
          nextOutcomes.set(nextScore, (nextOutcomes.get(nextScore) || 0) + nextProbability)
        }
      })
    })

    activeOutcomes = nextOutcomes
  }

  const isAlreadyComplete = fixedScore >= targetScore
  const survivalChance = isAlreadyComplete ? 1 : Math.pow(enchantSuccessRate, futureBaseLines)
  const rollValueChance = totalChance
  const plannedMinPercent = parseInt(plannedMinRating / item.DI * 100)
  const plannedMaxPercent = parseInt(plannedMaxRating / item.DI * 100)
  const plannedScoreText = plannedMinPercent === plannedMaxPercent
    ? plannedMinPercent + '%'
    : plannedMinPercent + '% ~ ' + plannedMaxPercent + '%'
  const plannedDIText = plannedMinRating.toFixed(2) === plannedMaxRating.toFixed(2)
    ? plannedMinRating.toFixed(2) + '%'
    : plannedMinRating.toFixed(2) + '% ~ ' + plannedMaxRating.toFixed(2) + '%'

  return {
    available: true,
    totalChance,
    totalChanceText: formatProbability(totalChance),
    survivalChance,
    survivalChanceText: formatProbability(survivalChance),
    rollValueChance,
    rollValueChanceText: formatProbability(rollValueChance),
    futureRolls: futureBaseLines,
    futureBaseLines,
    baseRollText: formatBaseRollSummary(futureBaseLines, isAlreadyComplete),
    upgradeRolls: 0,
    targetScore: targetPercent + '%',
    plannedScoreText,
    plannedDIText,
    lines,
  }
}

function updateValues() {
  const item = currentItem.value
  if (!item) {
    return
  }

  let totalDI = 0
  let potentialGainMin = 0
  let potentialGainMax = 0
  const potentialMultiplier = getPotentialMultiplier()
  const tierEquivalence = tiers[gearType.value][item.Type]
  const tierAvailable = Object.keys(tierEquivalence)

  for (let i = 0; i < 5; i++) {
    const stat = statType.value[i]
    const statInfo = item.Stats[stat]
    if (!statInfo) {
      results.value.individual[i] = createEmptyIndividualResult()
      validStats.value[i] = ''
      continue
    }

    const maxDI = statInfo.DI
    const maxValue = statInfo.Value
    const currentValue = getInputValue(i)
    const hasValue = hasRolledValue(i)
    const res = currentValue / maxValue * maxDI
    totalDI += res

    const pot = statInfo.Potential
    const potentialValueMin = currentValue + pot[0] * potentialMultiplier
    const potentialValueMax = currentValue + pot[1] * potentialMultiplier

    if (hasValue) {
      potentialGainMin += pot[0] / maxValue * maxDI
      potentialGainMax += pot[1] / maxValue * maxDI
    }

    const singleTier = getTierForPercent(currentValue / maxValue * 100, tierEquivalence, tierAvailable)
    const potentialTierMin = getTierForPercent(potentialValueMin / maxValue * 100, tierEquivalence, tierAvailable)
    const potentialTierMax = getTierForPercent(potentialValueMax / maxValue * 100, tierEquivalence, tierAvailable)

    results.value.individual[i].DI = res.toFixed(2)
    results.value.individual[i].percent = parseInt(currentValue / maxValue * 100)
    results.value.individual[i].tier = singleTier
    results.value.individual[i].potentialMin = formatStatValue(potentialValueMin, stat)
    results.value.individual[i].potentialMax = formatStatValue(potentialValueMax, stat)

    if (!hasValue) {
      results.value.individual[i].potentialMinPerc = 0
      results.value.individual[i].potentialMaxPerc = 0
      validStats.value[i] = ''
    }
    else {
      results.value.individual[i].potentialMinPerc = parseInt(potentialValueMin / maxValue * 100)
      results.value.individual[i].potentialMaxPerc = parseInt(potentialValueMax / maxValue * 100)
      validStats.value[i] = stat
    }

    results.value.individual[i].potentialDIMin = parseFloat(potentialValueMin / maxValue * maxDI).toFixed(2)
    results.value.individual[i].potentialDIMax = parseFloat(potentialValueMax / maxValue * maxDI).toFixed(2)
    results.value.individual[i].potentialTierMin = potentialTierMin
    results.value.individual[i].potentialTierMax = potentialTierMax
  }

  results.value.DI = totalDI.toFixed(2)
  const itemDI = parseInt(totalDI / item.DI * 100)
  results.value.percent = itemDI
  results.value.tier = getTierForPercent(itemDI, tierEquivalence, tierAvailable)

  const potentialMin = parseInt((potentialGainMin * potentialMultiplier + totalDI) / item.DI * 100)
  const potentialMax = parseInt((potentialGainMax * potentialMultiplier + totalDI) / item.DI * 100)
  const potentialDIMin = potentialGainMin * potentialMultiplier + totalDI
  const potentialDIMax = potentialGainMax * potentialMultiplier + totalDI

  let potentialText = potentialMin + '%'
  let potentialDIText = potentialDIMin.toFixed(2) + '%'
  if (potentialMin !== potentialMax) {
    potentialText += ' ~ ' + potentialMax + '%'
    potentialDIText += ' ~ ' + potentialDIMax.toFixed(2) + '%'
  }

  let finalTierMin = 'F'
  let finalTierMax = 'F'
  tierAvailable.forEach((entry) => {
    if (potentialMin >= parseInt(tierEquivalence[entry].Penta)) {
      finalTierMin = entry
    }
    if (potentialMax >= parseInt(tierEquivalence[entry].Penta)) {
      finalTierMax = entry
    }
  })

  let potentialTierText = finalTierMin
  if (finalTierMin !== finalTierMax) {
    potentialTierText += ' ~ ' + finalTierMax
  }

  if (potentialGainMax === 0) {
    potentialText = results.value.percent + '%'
    potentialDIText = results.value.DI + '%'
    potentialTierText = results.value.tier
  }

  results.value.potentialScore = potentialText
  results.value.potentialDI = potentialDIText
  results.value.potentialTier = potentialTierText
  results.value.sssOdds = calculateSssOdds(tierEquivalence, potentialMultiplier)
}

function setValues(enchants, value) {
  const percent = Number(value)
  for (let i = 0; i < 5; i++) {
    const stat = statType.value[i]
    const maxValue = currentItem.value?.Stats?.[stat]?.Value ?? 0

    if (enchants > i) {
      statInput.value[i] = isDecimalStat(stat) ? +(percent * maxValue / 100).toFixed(1) : parseInt(percent * maxValue / 100)
    }
    else {
      statInput.value[i] = ''
    }
  }
}

function getFinalUpgrade(item) {
  switch (item) {
    case '[3500] Badge 6':
    case '[9999] Badge 6':
      return ''
    case '[9999] Armor':
      return 'Ascended'
    default:
      return 'Lucent'
  }
}

function getSelectedRating() {
  let rating = 0
  const item = currentItem.value
  if (!item) {
    return rating
  }

  for (let i = 0; i < 4; i++) {
    rating += item.Stats[statType.value[i]]?.DI ?? 0
  }

  if (['6000', '7000'].includes(gearType.value.slice(1, 5))) {
    rating += (item.Stats[statType.value[4]]?.DI ?? 0) * 0.8
  }
  else {
    rating += item.Stats[statType.value[4]]?.DI ?? 0
  }

  return rating
}

function generateURL() {
  const gearNum = Object.keys(gears).reverse().indexOf(gearType.value).toString().padStart(2, '0')
  const pieceNum = Object.keys(gears[gearType.value]).indexOf(pieceType.value)
  const statNums = []

  statType.value.forEach((stat) => {
    statNums.push(statIndex.indexOf(stat).toString().padStart(2, '0'))
  })

  for (let i = 0; i < 5; i++) {
    statNums[i] = statNums[i] + Math.min(statInput.value[i] * 10, 999999).toString().padStart(6, '0')
  }

  const resString = gearNum + pieceNum + statNums.join('')
  navigator.clipboard.writeText(`${window.location.origin}${window.location.pathname}?it=${resString}`)
  toggleClipboardTooltip()
  return resString
}

function readURL(pars) {
  try {
    const gearName = Object.keys(gears).reverse()[parseInt(pars.slice(0, 2))]
    const pieceName = Object.keys(gears[gearName])[parseInt(pars.slice(2, 3))]
    const statNames = []
    const statValues = []

    for (let i = 3; i < 36; i += 8) {
      statNames.push(statIndex[parseInt(pars.slice(i, i + 2))])
    }
    for (let i = 5; i < 42; i += 8) {
      statValues.push(parseInt(pars.slice(i, i + 6)) / 10)
    }

    if (
      !Object.keys(gears).includes(gearName) ||
      !Object.keys(gears[gearName]).includes(pieceName) ||
      statNames.map((item) => statIndex.includes(item)).includes(false) ||
      statValues.map((item) => item < 100000 && item >= 0).includes(false)
    ) {
      throw new Error('Invalid item string')
    }

    gearType.value = gearName
    pieceType.value = pieceName
    highlightedPiece.value = [gearName, pieceName]
    statType.value = statNames.slice()
    statInput.value = statValues.slice()
    resetSssOddsOrder()
  }
  catch (error) {
    console.error(error)
  }
}

function acceptDisclaimer() {
  localStorage.setItem('ltGearCalculatorDisclaimerAccepted', 'true')
  disclaimerOpen.value = false
}

function toggleClipboardTooltip() {
  clearTimeout(clipboardToolTipTimeout.value)
  clipboardTooltip.value = true

  clipboardToolTipTimeout.value = setTimeout(() => {
    clipboardTooltip.value = false
  }, 2000)
}

function clamp(value, min, max) {
  if (!Number.isFinite(value)) {
    return min
  }

  return Math.min(Math.max(value, min), max)
}

function getFirstPercent(text) {
  const value = parseFloat(String(text).split(' ~ ')[0])
  return Number.isFinite(value) ? value : 0
}

function formatGainRange(text, baseValue) {
  const values = String(text)
    .replaceAll('%', '')
    .split(' ~ ')
    .map((value) => parseFloat(value))
    .filter((value) => Number.isFinite(value))

  if (!values.length || !Number.isFinite(baseValue)) {
    return '+0%'
  }

  const gains = values.map((value) => value - baseValue)
  const formatted = gains.map((value) => `${value >= 0 ? '+' : ''}${value.toFixed(resultMode.value === 'rating' ? 2 : 0)}%`)
  return formatted.length === 1 ? formatted[0] : formatted.join(' ~ ')
}

function getLineScoreText(index) {
  const row = results.value.individual[index]
  return resultMode.value === 'rating' ? `${row.DI}%` : `${row.percent}%`
}

function getPotentialLineText(index) {
  const row = results.value.individual[index]
  if (resultMode.value === 'rating') {
    return row.potentialDIMin === row.potentialDIMax
      ? `${row.potentialDIMin}%`
      : `${row.potentialDIMin}% ~ ${row.potentialDIMax}%`
  }

  return row.potentialMinPerc === row.potentialMaxPerc
    ? `${row.potentialMinPerc}%`
    : `${row.potentialMinPerc}% ~ ${row.potentialMaxPerc}%`
}

function getPotentialLineTier(index) {
  const row = results.value.individual[index]
  return row.potentialTierMin === row.potentialTierMax
    ? row.potentialTierMin
    : `${row.potentialTierMin} ~ ${row.potentialTierMax}`
}

function getTierClass(tier) {
  const firstTier = String(tier).split(' ')[0]
  const classes = {
    F: 'border-neutral-300 bg-neutral-100 text-neutral-700 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300',
    E: 'border-neutral-300 bg-neutral-100 text-neutral-700 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300',
    D: 'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900 dark:bg-sky-950 dark:text-sky-300',
    C: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300',
    B: 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-300',
    A: 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300',
    S: 'border-fuchsia-200 bg-fuchsia-50 text-fuchsia-700 dark:border-fuchsia-900 dark:bg-fuchsia-950 dark:text-fuchsia-300',
    SS: 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-300',
    SSS: 'border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300',
  }

  return classes[firstTier] ?? classes.F
}

function getRollStatusClass(status) {
  const classes = {
    ignored: 'text-muted-foreground',
    upgrade: 'text-emerald-700 dark:text-emerald-300',
    new: 'text-amber-700 dark:text-amber-300',
  }

  return classes[status] ?? ''
}

changePiece()

const urlParams = new URLSearchParams(window.location.search)
if (urlParams.has('it')) {
  readURL(urlParams.get('it'))
  disclaimerOpen.value = false
}

updateValues()

watch([gearType, pieceType], ([nextGear, nextPiece]) => {
  const pieces = getPieceNames(nextGear)
  if (!pieces.includes(nextPiece)) {
    pieceType.value = pieces[0]
    return
  }

  highlightedPiece.value = [nextGear, nextPiece]
  changePiece()
}, { flush: 'sync' })

watch([statType, statInput], () => {
  updateValues()
}, {
  deep: true,
  flush: 'post',
})
</script>

<template>
  <TooltipProvider>
    <div class="min-h-screen bg-background text-foreground">
      <header class="border-b bg-background/95 backdrop-blur">
        <div class="mx-auto flex w-full max-w-[1600px] flex-wrap items-center justify-between gap-3 px-4 py-3 md:px-6">
          <div class="flex min-w-0 items-center gap-3">
            <div class="flex size-10 shrink-0 items-center justify-center rounded-lg border bg-card">
              <img class="size-6" :src="getAsset('hammer.png')" alt="">
            </div>
            <div class="min-w-0">
              <h1 class="truncate text-lg font-semibold tracking-normal md:text-xl">
                LaTale Gear Score Calculator
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
                  <ClipboardIcon />
                  <span class="sr-only">Copy share link</span>
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

      <main class="mx-auto grid w-full max-w-[1600px] gap-4 px-4 py-4 md:px-6 xl:grid-cols-[minmax(420px,560px)_minmax(0,1fr)]">
        <section class="grid gap-4">
          <Card class="gap-0 rounded-lg py-0">
            <CardHeader class="p-0">
              <button
                type="button"
                class="group flex w-full items-center justify-between gap-3 rounded-t-lg border-b px-4 py-4 text-left transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                aria-label="Open gear selector"
                @click="gearSheetOpen = true"
              >
                <div class="flex min-w-0 items-center gap-3">
                  <img class="size-12 shrink-0 rounded-lg border bg-muted p-1" :src="selectedImage" alt="">
                  <div class="min-w-0">
                    <CardTitle class="truncate text-base">
                      {{ pieceType }} {{ gearType }}
                    </CardTitle>
                    <CardDescription>
                      Max rating {{ currentItem?.DI.toFixed(2) }}% / selected stats {{ getSelectedRating().toFixed(2) }}%
                    </CardDescription>
                  </div>
                </div>
                <div class="flex shrink-0 items-center gap-1.5 rounded-lg border bg-background px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors group-hover:border-ring/50 group-hover:text-foreground">
                  <SearchIcon class="size-3.5" />
                  <span class="hidden sm:inline">Change gear</span>
                  <ChevronRightIcon class="size-3.5 transition-transform group-hover:translate-x-0.5" />
                </div>
              </button>
            </CardHeader>

            <CardContent class="grid gap-4 p-4">
              <div class="grid gap-3 sm:grid-cols-2">
                <div class="grid gap-1.5">
                  <Label for="gear-type">Tier</Label>
                  <Select v-model="gearType">
                    <SelectTrigger id="gear-type" class="w-full">
                      <SelectValue placeholder="Tier" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem v-for="category in gearCategories" :key="category" :value="category">
                        {{ category }}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div class="grid gap-1.5">
                  <Label for="piece-type">Piece</Label>
                  <Select v-model="pieceType">
                    <SelectTrigger id="piece-type" class="w-full">
                      <SelectValue placeholder="Piece" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem v-for="piece in pieceOptions" :key="piece" :value="piece">
                        {{ piece }}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Separator />

              <div class="grid gap-3">
                <div
                  v-for="(_, index) in statType"
                  :key="index"
                  class="grid gap-2 rounded-lg border bg-muted/20 p-3"
                >
                  <div class="flex items-center justify-between gap-3">
                    <Label :for="`stat-${index}`" class="text-xs font-medium text-muted-foreground">
                      Line {{ index + 1 }}
                    </Label>
                    <span class="text-xs text-muted-foreground">
                      Max {{ currentItem?.Stats?.[statType[index]]?.Value ?? '-' }} / {{ currentItem?.Stats?.[statType[index]]?.DI?.toFixed(2) ?? '0.00' }}%
                    </span>
                  </div>
                  <div class="grid gap-2 sm:grid-cols-[1fr_120px]">
                    <Combobox
                      v-model="statType[index]"
                      open-on-click
                      open-on-focus
                      reset-search-term-on-select
                    >
                      <ComboboxAnchor>
                        <ComboboxInput
                          :id="`stat-${index}`"
                          class="min-w-0"
                          placeholder="Search stat..."
                        />
                      </ComboboxAnchor>
                      <ComboboxList>
                        <ComboboxViewport>
                          <ComboboxEmpty>No stat found.</ComboboxEmpty>
                          <ComboboxGroup>
                            <ComboboxItem
                              v-for="stat in statOptions"
                              :key="stat"
                              :value="stat"
                              :text-value="stat"
                            >
                              {{ stat }}
                              <ComboboxItemIndicator>
                                <CheckIcon class="size-4" />
                              </ComboboxItemIndicator>
                            </ComboboxItem>
                          </ComboboxGroup>
                        </ComboboxViewport>
                      </ComboboxList>
                    </Combobox>

                    <Input
                      v-model="statInput[index]"
                      type="number"
                      :step="getStatStep(statType[index])"
                      min="0"
                      inputmode="decimal"
                      placeholder="Value"
                    />
                  </div>
                </div>
              </div>

              <div class="grid gap-3 rounded-lg border p-3">
                <div class="flex flex-wrap items-center gap-2">
                  <Button variant="outline" size="sm" @click="setValues(0, 0)">
                    <RefreshCcwIcon />
                    Clear
                  </Button>
                  <Button variant="secondary" size="sm" @click="setValues(2, valueButton)">Duo</Button>
                  <Button variant="secondary" size="sm" @click="setValues(3, valueButton)">Trio</Button>
                  <Button variant="secondary" size="sm" @click="setValues(4, valueButton)">Quad</Button>
                  <Button variant="secondary" size="sm" @click="setValues(5, valueButton)">Penta</Button>

                  <Select v-model="valueButton">
                    <SelectTrigger class="ml-auto w-[110px]">
                      <SelectValue placeholder="Value" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem v-for="n in 10" :key="n" :value="String(n * 10)">
                        {{ n * 10 }}%
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card class="rounded-lg">
            <CardHeader class="border-b">
              <CardTitle class="flex items-center gap-2 text-base">
                <ShieldCheckIcon class="size-4" />
                Stat Notes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div v-if="selectedTraitRows.length" class="grid gap-2">
                <div
                  v-for="trait in selectedTraitRows"
                  :key="trait.id"
                  class="flex gap-3 rounded-lg border bg-muted/20 p-3"
                >
                  <img class="size-8 shrink-0" :src="getAsset(trait.image)" alt="">
                  <div>
                    <div class="text-sm font-medium">{{ trait.label }}</div>
                    <div class="text-sm text-muted-foreground">{{ trait.text }}</div>
                  </div>
                </div>
              </div>
              <div v-else class="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                No special stat notes for the current rolled lines.
              </div>
            </CardContent>
          </Card>
        </section>

        <section class="grid content-start gap-4">
          <Card class="rounded-lg">
            <CardHeader class="border-b">
              <div class="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <CardTitle class="flex items-center gap-2 text-base">
                    <CalculatorIcon class="size-4" />
                    Results
                  </CardTitle>
                  <CardDescription>{{ pieceType }} {{ gearType }}</CardDescription>
                </div>

                <Tabs v-model="resultMode" class="w-auto">
                  <TabsList>
                    <TabsTrigger value="score">Score</TabsTrigger>
                    <TabsTrigger value="rating">Rating</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
            </CardHeader>

            <CardContent class="grid gap-4">
              <div class="grid gap-3 lg:grid-cols-[220px_1fr]">
                <div class="rounded-lg border bg-muted/20 p-4">
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

                <div class="grid gap-2">
                  <div
                    v-for="(_, index) in statType"
                    :key="`result-${index}`"
                    class="grid gap-2 rounded-lg border p-3"
                  >
                    <div class="flex flex-wrap items-center justify-between gap-2">
                      <div class="min-w-0">
                        <div class="truncate text-sm font-medium">
                          <span v-if="hasRolledValue(index)">{{ statType[index] }}</span>
                          <span v-else class="text-muted-foreground">Empty line</span>
                        </div>
                        <div class="text-xs text-muted-foreground">
                          {{ hasRolledValue(index) ? statInput[index] : 'No value entered' }}
                        </div>
                      </div>
                      <div class="flex items-center gap-2">
                        <span class="text-sm font-semibold">{{ hasRolledValue(index) ? getLineScoreText(index) : '---' }}</span>
                        <Badge v-if="hasRolledValue(index)" variant="outline" :class="getTierClass(results.individual[index].tier)">
                          {{ results.individual[index].tier }}
                        </Badge>
                      </div>
                    </div>
                    <Progress :model-value="clamp(Number(results.individual[index].percent), 0, 100)" class="h-1.5" />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card v-if="getFinalUpgrade(gearType) !== ''" class="rounded-lg">
            <CardHeader class="border-b">
              <CardTitle class="flex items-center gap-2 text-base">
                <SparklesIcon class="size-4" />
                {{ getFinalUpgrade(gearType) }} Projection
              </CardTitle>
              <CardDescription>
                Lv.{{ parseInt(gearType.slice(1, 5)) < 9999 ? 4 : 5 }} {{ pieceType }} {{ gearType }}
              </CardDescription>
            </CardHeader>

            <CardContent>
              <Tabs default-value="summary" class="grid gap-4">
                <TabsList class="w-fit">
                  <TabsTrigger value="summary">Summary</TabsTrigger>
                  <TabsTrigger value="lines">Lines</TabsTrigger>
                  <TabsTrigger v-if="results.sssOdds.available" value="sss">SSS odds</TabsTrigger>
                </TabsList>

                <TabsContent value="summary" class="m-0">
                  <div class="grid gap-3 lg:grid-cols-[220px_1fr]">
                    <div class="rounded-lg border bg-muted/20 p-4">
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

                    <div class="grid gap-2">
                      <div
                        v-for="(_, index) in statType"
                        :key="`potential-${index}`"
                        class="grid gap-2 rounded-lg border p-3"
                      >
                        <div class="flex flex-wrap items-center justify-between gap-2">
                          <div class="min-w-0">
                            <div class="truncate text-sm font-medium">
                              <span v-if="hasRolledValue(index)">
                                {{ statType[index] }}:
                                <span v-if="results.individual[index].potentialMin === results.individual[index].potentialMax">
                                  {{ results.individual[index].potentialMin }}
                                </span>
                                <span v-else>
                                  {{ results.individual[index].potentialMin }} ~ {{ results.individual[index].potentialMax }}
                                </span>
                              </span>
                              <span v-else class="text-muted-foreground">Empty line</span>
                            </div>
                          </div>
                          <div class="flex items-center gap-2">
                            <span class="text-sm font-semibold">{{ hasRolledValue(index) ? getPotentialLineText(index) : '---' }}</span>
                            <Badge v-if="hasRolledValue(index)" variant="outline" :class="getTierClass(getPotentialLineTier(index))">
                              {{ getPotentialLineTier(index) }}
                            </Badge>
                          </div>
                        </div>
                        <Progress :model-value="clamp(Number(results.individual[index].potentialMinPerc), 0, 100)" class="h-1.5" />
                      </div>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="lines" class="m-0">
                  <ScrollArea class="max-h-[360px] rounded-lg border">
                    <Table>
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
                  </ScrollArea>
                </TabsContent>

                <TabsContent v-if="results.sssOdds.available" value="sss" class="m-0 grid gap-3">
                  <div class="grid gap-3 md:grid-cols-5">
                    <div class="rounded-lg border p-3">
                      <div class="text-xs text-muted-foreground">Total odds</div>
                      <div class="text-lg font-semibold">{{ results.sssOdds.totalChanceText }}</div>
                    </div>
                    <div class="rounded-lg border p-3">
                      <div class="text-xs text-muted-foreground">Target</div>
                      <div class="text-lg font-semibold">{{ results.sssOdds.targetScore }}</div>
                    </div>
                    <div class="rounded-lg border p-3">
                      <div class="text-xs text-muted-foreground">Planned</div>
                      <div class="text-lg font-semibold">
                        {{ resultMode === 'rating' ? results.sssOdds.plannedDIText : results.sssOdds.plannedScoreText }}
                      </div>
                    </div>
                    <div class="rounded-lg border p-3">
                      <div class="text-xs text-muted-foreground">Base rolls</div>
                      <div class="text-lg font-semibold">{{ results.sssOdds.baseRollText }}</div>
                    </div>
                    <div class="rounded-lg border p-3">
                      <div class="text-xs text-muted-foreground">Full survival</div>
                      <div class="text-lg font-semibold">{{ results.sssOdds.survivalChanceText }}</div>
                    </div>
                  </div>

                  <ScrollArea class="max-h-[320px] rounded-lg border">
                    <Table>
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
                  </ScrollArea>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          <div class="grid gap-4 2xl:grid-cols-2">
            <Card class="rounded-lg">
              <CardHeader class="border-b">
                <CardTitle class="flex items-center gap-2 text-base">
                  <SwordsIcon class="size-4" />
                  Tier Evaluation
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea class="rounded-lg border">
                  <Table>
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
                </ScrollArea>
              </CardContent>
            </Card>

            <Card class="rounded-lg">
              <CardHeader class="border-b">
                <CardTitle class="flex items-center gap-2 text-base">
                  <TablePropertiesIcon class="size-4" />
                  Tier Equivalence
                </CardTitle>
                <CardDescription>{{ pieceType }} {{ gearType }}</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea class="max-h-[420px] rounded-lg border">
                  <Table>
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
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </section>
      </main>

      <Sheet v-model:open="gearSheetOpen">
        <SheetContent
          side="right"
          class="gap-0 p-0 data-[side=right]:!w-full sm:data-[side=right]:!max-w-none md:data-[side=right]:!w-[92vw] lg:data-[side=right]:!w-[86vw] xl:data-[side=right]:!w-[1120px]"
        >
          <SheetHeader class="border-b px-5 py-4 pr-12">
            <SheetTitle>Select Gear</SheetTitle>
            <SheetDescription>{{ highlightedPiece[1] }} {{ highlightedPiece[0] }}</SheetDescription>
          </SheetHeader>

          <div class="min-h-0 flex-1 overflow-y-auto p-4">
            <div class="grid min-h-full gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
              <section class="min-h-0 rounded-lg border bg-card">
                <div class="border-b px-3 py-2">
                  <div class="text-sm font-medium">Gear catalog</div>
                  <div class="text-xs text-muted-foreground">Hover to inspect, click to select</div>
                </div>
                <ScrollArea class="h-[42vh] p-3 xl:h-[calc(100vh-10rem)]">
                  <div class="grid gap-4">
                    <div v-for="category in gearCategories" :key="category" class="grid gap-2">
                      <div class="text-xs font-medium uppercase text-muted-foreground">{{ category }}</div>
                      <div class="grid grid-cols-4 gap-2 sm:grid-cols-5 xl:grid-cols-5">
                        <Button
                          v-for="piece in getPieceNames(category)"
                          :key="`${category}-${piece}`"
                          :variant="gearType === category && pieceType === piece ? 'default' : 'outline'"
                          class="h-14 w-full rounded-lg"
                          size="icon"
                          @click="setGear(category, piece)"
                          @mouseenter="highlightedPiece = [category, piece]"
                        >
                          <img class="size-8" :src="getItemImage(piece, category)" :alt="piece">
                        </Button>
                      </div>
                    </div>
                  </div>
                </ScrollArea>
              </section>

              <section class="grid min-h-0 content-start gap-4">
                <div class="flex items-center gap-3 rounded-lg border bg-card p-3">
                  <img class="size-12 rounded-lg border bg-muted p-1" :src="getItemImage(highlightedPiece[1], highlightedPiece[0])" alt="">
                  <div class="min-w-0">
                    <div class="truncate font-semibold">{{ highlightedPiece[1] }} {{ highlightedPiece[0] }}</div>
                    <div class="truncate text-sm text-muted-foreground">
                      Max rating {{ highlightedItem?.DI.toFixed(2) }}% / {{ getFinalUpgrade(highlightedPiece[0]) || 'No final upgrade' }}
                    </div>
                  </div>
                </div>

                <Tabs default-value="enchants" class="grid min-h-0 gap-3">
                  <TabsList class="w-full justify-start overflow-x-auto sm:w-fit">
                    <TabsTrigger value="enchants">Enchants</TabsTrigger>
                    <TabsTrigger value="tiers">Tiers</TabsTrigger>
                    <TabsTrigger value="traits">Traits</TabsTrigger>
                  </TabsList>

                  <TabsContent value="enchants" class="m-0 min-h-0">
                    <ScrollArea class="max-h-[52vh] rounded-lg border bg-card xl:max-h-[calc(100vh-16rem)]">
                      <Table class="min-w-[560px]">
                        <TableHeader>
                          <TableRow>
                            <TableHead>Stat</TableHead>
                            <TableHead>Max value</TableHead>
                            <TableHead>Rating</TableHead>
                            <TableHead v-if="getFinalUpgrade(highlightedPiece[0]) !== ''">Potential</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          <TableRow v-for="stat in highlightedStats" :key="stat">
                            <TableCell class="font-medium">{{ stat }}</TableCell>
                            <TableCell>{{ highlightedItem.Stats[stat].Value }}</TableCell>
                            <TableCell>{{ highlightedItem.Stats[stat].DI }}%</TableCell>
                            <TableCell v-if="getFinalUpgrade(highlightedPiece[0]) !== ''">
                              {{ highlightedItem.Stats[stat].Potential[0] }}
                              <span v-if="highlightedItem.Stats[stat].Potential[0] !== highlightedItem.Stats[stat].Potential[1]">
                                ~ {{ highlightedItem.Stats[stat].Potential[1] }}
                              </span>
                            </TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </ScrollArea>
                  </TabsContent>

                  <TabsContent value="tiers" class="m-0 min-h-0">
                    <ScrollArea class="max-h-[52vh] rounded-lg border bg-card xl:max-h-[calc(100vh-16rem)]">
                      <Table class="min-w-[720px]">
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
                          <TableRow v-for="row in highlightedTierRows" :key="row.tier">
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
                    </ScrollArea>
                  </TabsContent>

                  <TabsContent value="traits" class="m-0">
                    <div v-if="highlightedTraitRows.length" class="grid gap-2">
                      <div
                        v-for="trait in highlightedTraitRows"
                        :key="trait.id"
                        class="flex gap-3 rounded-lg border bg-card p-3"
                      >
                        <img class="size-8 shrink-0" :src="getAsset(trait.image)" alt="">
                        <div>
                          <div class="text-sm font-medium">{{ trait.label }}</div>
                          <div class="text-sm text-muted-foreground">{{ trait.text }}</div>
                        </div>
                      </div>
                    </div>
                    <div v-else class="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                      No special traits listed for this piece.
                    </div>
                  </TabsContent>
                </Tabs>
              </section>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <Dialog v-model:open="disclaimerOpen">
        <DialogContent class="max-h-[90vh] max-w-3xl overflow-y-auto rounded-lg">
          <DialogHeader>
            <DialogTitle>LaTale Gear Score Calculator</DialogTitle>
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

          <DialogFooter>
            <Button variant="outline" as-child>
              <a href="https://kedanao.github.io/lt-damage-calculator/" target="_blank" rel="noreferrer">
                <LinkIcon />
                Damage Calculator
              </a>
            </Button>
            <Button @click="acceptDisclaimer">Accept</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  </TooltipProvider>
</template>
