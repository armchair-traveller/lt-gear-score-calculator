<script setup>
// todo: 
// - improve preset buttons
// - clean up code
// - CSS for mobile

import { ref, watch } from 'vue';
import StatSelect from './component/StatSelect.vue';
import StatOption from './component/StatOption.vue';
import gears from './utils/gear.js'
import tiers from './utils/tiers.js'

const decimalStats = ['Normal Amplification', 'Boss Amplification', 'Cooldown Reduction']
const sssOddsGearTypes = ['[9999] Armor', '[9000] Accessories', '[8000] Weapons']
const enchantSuccessRate = 0.6
const ratingScale = 1000

const gearType = ref('[9999] Armor')
const pieceType = ref('Helmet')
const highlightedPiece = ref(['[9999] Armor', 'Helmet'])
const valueButton = ref(90)

const pieceOptions = ref('')
const statOptions = ref([])

const statType = ref([])
const statInput = ref(['', '', '', '', ''])
const validStats = ref([])
const selected = ref()

const imgUrls = import.meta.glob('./assets/*.png', {
  import: 'default',
  eager: true,
})

// Check if disclaimer has been accepted before
const hasSeenDisclaimer = localStorage.getItem('ltGearCalculatorDisclaimerAccepted') === 'true'

const displayWindow = ref({
  'disclaimer': !hasSeenDisclaimer, // Only open on disclaimer if not seen before
  'gear': false,
  'help': 0,
})
const dimmed = ref(!hasSeenDisclaimer)
const switchState = ref(false)

const helpStoredInfo = ref({
  'item': [],
  'statType': [],
  'statInput': []
})

const displayOthers = ref(false)

// tooltip: false,
// tooltipPosition: [0,0],
// tooltipText: '',

const results = ref({
  individual: [
    { DI: '', percent: '', tier: '', 
      potentialMin: '', potentialMax: '', 
      potentialMinPerc: '', potentialMaxPerc: '',
      potentialDIMin: '', potentialDIMax: '',
      potentialTierMin: '', potentialTierMax: '' },
    { DI: '', percent: '', tier: '', 
      potentialMin: '', potentialMax: '', 
      potentialMinPerc: '', potentialMaxPerc: '',
      potentialDIMin: '', potentialDIMax: '',
      potentialTierMin: '', potentialTierMax: '' },
    { DI: '', percent: '', tier: '', 
      potentialMin: '', potentialMax: '', 
      potentialMinPerc: '', potentialMaxPerc: '',
      potentialDIMin: '', potentialDIMax: '',
      potentialTierMin: '', potentialTierMax: '' },
    { DI: '', percent: '', tier: '', 
      potentialMin: '', potentialMax: '', 
      potentialMinPerc: '', potentialMaxPerc: '',
      potentialDIMin: '', potentialDIMax: '',
      potentialTierMin: '', potentialTierMax: '' },
    { DI: '', percent: '', tier: '', 
      potentialMin: '', potentialMax: '', 
      potentialMinPerc: '', potentialMaxPerc: '',
      potentialDIMin: '', potentialDIMax: '',
      potentialTierMin: '', potentialTierMax: '' },
  ],
  DI: '',
  percent: '',
  tier: '',
  potentialScore: '',
  potentialTier: '',
  sssOdds: {
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
    lines: [],
  }
})

// Changes a piece of gear on the selection window
function setGear(category,piece) {
  if (displayWindow.value.help <= 0) {
    gearType.value = category
    pieceType.value = piece

    changeGear()
    toggleDisplayWindow('gear')
  }
}

    // Adjusts the possible stats when changing an item type
function changeGear() {
  let innerHTML = ''
  let item = Object.keys(gears[gearType.value])
  item.splice(-2)
  item.forEach((e) => innerHTML += '<option value="' + e +'">' + e + '</option>')
  pieceOptions.value = innerHTML
  // pieceType.value = item[0]
  changePiece()
}

function changePiece() {
  let innerHTML = ''
  let item = Object.keys(gears[gearType.value][pieceType.value]['Stats'])
  // item.forEach((e) => innerHTML += '<stat-option value="' + e +'"><div class="stat-option-text">' + e + '</div><div class="stat-option-subtext">Max. Value: ' + gears[gearType.value][pieceType.value]['Stats']['Value'] + ' | Max. Rating: ' + gears[gearType.value][pieceType.value]['Stats']['DI'] + '</div></stat-option>')
  statOptions.value = item.slice()
  statType.value = item.slice(0,5)
  setValues(0,0);

  // $emit('updateSelect')

  // console.log(statOptions)
  // console.log(statType)
  // <stat-option value="1"><div style="color:red">Red option</div><div>Potato - Tomato</div></stat-option>
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
  return parseInt(item.slice(1,5)) < 9999 ? 2 : 3
}

function getTierForPercent(percent, tierEquivalence, tierAvailable) {
  let tier = 'F'
  tierAvailable.forEach((e) => {
    if (parseInt(percent) >= parseInt(tierEquivalence[e]['Penta'])) {
      tier = e
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

function formatBaseRollSummary(count) {
  return count === 0 ? 'None' : `${count} @ 60%`
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

function addRollDistribution(dp, distribution) {
  const next = new Map()

  dp.forEach((currentProbability, currentScore) => {
    distribution.forEach((roll) => {
      const score = currentScore + roll.score
      next.set(score, (next.get(score) || 0) + currentProbability * roll.probability)
    })
  })

  return next
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
    lines: [],
  }
}

function calculateSssOdds(tierEquivalence, potentialMultiplier) {
  if (!sssOddsGearTypes.includes(gearType.value) || !tierEquivalence['SSS']) {
    return getEmptySssOdds()
  }

  const item = gears[gearType.value][pieceType.value]
  const targetPercent = parseInt(tierEquivalence['SSS']['Penta'])
  const targetRating = item['DI'] * targetPercent / 100
  const targetScore = Math.ceil(targetRating * ratingScale)

  let dp = new Map([[0, 1]])
  let fixedScore = 0
  let futureBaseLines = 0
  let plannedMinRating = 0
  let plannedMaxRating = 0
  let lines = []

  for (let i = 0; i < 5; i++) {
    const stat = statType.value[i]
    const statInfo = item['Stats'][stat]
    const maxValue = statInfo['Value']
    const maxDI = statInfo['DI']
    const potential = statInfo['Potential']
    const shouldRollLine = maxDI > 0
    const currentValue = getInputValue(i)
    const step = getStatStep(stat)
    const hasValue = hasRolledValue(i)
    const upgradeMinValue = potential[0] * potentialMultiplier
    const upgradeMaxValue = potential[1] * potentialMultiplier

    let lineMinValue = hasValue ? currentValue : step
    let lineMaxValue = hasValue ? currentValue : maxValue
    lineMinValue += upgradeMinValue
    lineMaxValue += upgradeMaxValue

    if (shouldRollLine) {
      fixedScore += Math.round(upgradeMinValue / maxValue * maxDI * ratingScale)
    }

    if (!shouldRollLine) {
      // Non-damaging lines are not rolled for SSS attempts, so they add no survival risk.
    }
    else if (hasValue) {
      fixedScore += Math.round(currentValue / maxValue * maxDI * ratingScale)
    }
    else {
      futureBaseLines += 1
      dp = addRollDistribution(dp, getRollDistribution(step, maxValue, step, maxValue, maxDI))
    }

    plannedMinRating += lineMinValue / maxValue * maxDI
    plannedMaxRating += lineMaxValue / maxValue * maxDI
    lines.push({
      stat,
      range: shouldRollLine ? formatRange(lineMinValue, lineMaxValue, stat) : 'Ignored',
      rollText: !shouldRollLine ? 'not rolled' : hasValue ? 'already rolled' : '60% base roll',
      status: !shouldRollLine ? 'ignored' : hasValue ? 'upgrade' : 'new',
    })
  }

  const neededScore = targetScore - fixedScore
  let rollValueChance = 0

  if (neededScore <= 0) {
    rollValueChance = 1
  }
  else {
    dp.forEach((probability, score) => {
      if (score >= neededScore) {
        rollValueChance += probability
      }
    })
  }

  const survivalChance = Math.pow(enchantSuccessRate, futureBaseLines)
  const totalChance = survivalChance * rollValueChance
  const plannedMinPercent = parseInt(plannedMinRating / item['DI'] * 100)
  const plannedMaxPercent = parseInt(plannedMaxRating / item['DI'] * 100)
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
    baseRollText: formatBaseRollSummary(futureBaseLines),
    upgradeRolls: 0,
    targetScore: targetPercent + '%',
    plannedScoreText,
    plannedDIText,
    lines,
  }
}

    // Calculates scores and tiers whenever inputs are updated
function updateValues() {
  // Piece's total rating will be stored here

  let totalDI = 0

  let potentialGainMin = 0
  let potentialGainMax = 0
  let potentialMultiplier = getPotentialMultiplier()

  let tierType = gears[gearType.value][pieceType.value]["Type"];
  let tierEquivalence = tiers[gearType.value][tierType];
  let tierAvailable = Object.keys(tierEquivalence);

  // Individual results
  for (let i = 0; i < 5; i++) {
    let stat = statType.value[i]
    let maxDI = gears[gearType.value][pieceType.value]['Stats'][stat]['DI']
    let maxValue = gears[gearType.value][pieceType.value]['Stats'][stat]['Value']
    let currentValue = getInputValue(i)
    let hasValue = hasRolledValue(i)
    // Score = Value / Max Value
    // Rating = Value / Max Value * Max Rating (DI)
    let res = currentValue / maxValue * maxDI
    totalDI += res

    let pot = gears[gearType.value][pieceType.value]['Stats'][stat]['Potential']
    let potentialValueMin = currentValue + pot[0] * potentialMultiplier
    let potentialValueMax = currentValue + pot[1] * potentialMultiplier

    // Potential only needed if input is not empty
    if (hasValue) {
      potentialGainMin += pot[0] / maxValue * maxDI;
      potentialGainMax += pot[1] / maxValue * maxDI;
    }

    // Compare the individual tier vs the score, using that gear's specific tiers
    let singleTier = getTierForPercent(currentValue / maxValue * 100, tierEquivalence, tierAvailable)

    // Same but with potentials for Lucent/Ascended
    let potentialTierMin = getTierForPercent(potentialValueMin / maxValue * 100, tierEquivalence, tierAvailable)
    let potentialTierMax = getTierForPercent(potentialValueMax / maxValue * 100, tierEquivalence, tierAvailable)

    // Save individual results
    results.value['individual'][i]['DI'] = res.toFixed(2)
    results.value['individual'][i]['percent'] = parseInt(currentValue / maxValue * 100)
    results.value['individual'][i]['tier'] = singleTier
    // Amps and CDR increment by 0.1, format them differently
    results.value['individual'][i]['potentialMin'] = formatStatValue(potentialValueMin, stat)
    results.value['individual'][i]['potentialMax'] = formatStatValue(potentialValueMax, stat)

    if(!hasValue) {
      results.value['individual'][i]['potentialMinPerc'] = 0
      results.value['individual'][i]['potentialMaxPerc'] = 0
      validStats.value[i] = ''
    } else {
      results.value['individual'][i]['potentialMinPerc'] = parseInt(potentialValueMin / maxValue * 100)
      results.value['individual'][i]['potentialMaxPerc'] = parseInt(potentialValueMax / maxValue * 100)
      validStats.value[i] = stat
    }
    results.value['individual'][i]['potentialDIMin'] = parseFloat(potentialValueMin / maxValue *  maxDI).toFixed(2)
    results.value['individual'][i]['potentialDIMax'] = parseFloat(potentialValueMax / maxValue *  maxDI).toFixed(2)
    results.value['individual'][i]['potentialTierMin'] = potentialTierMin
    results.value['individual'][i]['potentialTierMax'] = potentialTierMax
  }

  // Save total results
  results.value['DI'] = totalDI.toFixed(2)
  let itemDI = parseInt(totalDI / gears[gearType.value][pieceType.value]["DI"] * 100)
  results.value['percent'] = itemDI

  // Calculate final tier
  let finalTier = getTierForPercent(itemDI, tierEquivalence, tierAvailable)
  results.value['tier'] = finalTier

  // Final potential
  let potentialMin = parseInt((potentialGainMin * potentialMultiplier + totalDI) / gears[gearType.value][pieceType.value]["DI"] * 100);
  let potentialMax = parseInt((potentialGainMax * potentialMultiplier + totalDI) / gears[gearType.value][pieceType.value]["DI"] * 100);
  let potentialDIMin = (potentialGainMin * potentialMultiplier + totalDI)
  let potentialDIMax = (potentialGainMax * potentialMultiplier + totalDI)
  
  // Store it as formatted text
  let potentialText = potentialMin + '%'
  let potentialDIText = potentialDIMin.toFixed(2) + '%'
  // In the case of 4k ~ 7k gear with varying potential, add a min and max
  if (potentialMin !== potentialMax) {
    potentialText += ' ~ ' + potentialMax + '%'
    potentialDIText += ' ~ ' + potentialDIMax.toFixed(2) + '%'
  }

  // Potential final tier
  let finalTierMin = 'F';
  let finalTierMax = 'F';
  tierAvailable.forEach((e) => {
    if (potentialMin >= parseInt(tierEquivalence[e]['Penta'])) {
      finalTierMin = e;
    }
    if (potentialMax >= parseInt(tierEquivalence[e]['Penta'])) {
      finalTierMax = e;
    }
  });
  
  let potentialTierText = finalTierMin

  if (finalTierMin !== finalTierMax) {
    potentialTierText += " ~ " + finalTierMax
  }

  if (potentialGainMax === 0) {
    potentialText = results.value['percent'] + '%'
    potentialDIText = results.value['DI'] + '%'
    potentialTierText = results.value['tier']
  }

  results.value['potentialScore'] = potentialText
  results.value['potentialDI'] = potentialDIText
  results.value['potentialTier'] = potentialTierText
  results.value['sssOdds'] = calculateSssOdds(tierEquivalence, potentialMultiplier)
}

// Sets a number chosen stats to a set value
function setValues(enchants, value) {
  for (let i = 0; i < 5; i++) {
    let maxValue = gears[gearType.value][pieceType.value]["Stats"][statType.value[i]]["Value"];

    if (enchants > i) {
      statInput.value[i] = isDecimalStat(statType.value[i]) ? +(value * maxValue / 100).toFixed(1) : parseInt(value * maxValue / 100);
    } else {
      statInput.value[i] = "";
    };
  }
}

// Toggles between different windows, dimming the other possible ones
function toggleDisplayWindow(selection) {
  // Help window logic: starts/ends the help cycle when clicking the help/close buttons
  if (selection === 'help') {
    // Initiate help cycle
    if (displayWindow.value['help'] <= 0) {
      // Amount of steps in the help cycle
      displayWindow.value['help'] = 7
      // Stores currently inputs to reintroduce them later
      helpStoredInfo.value['item'] = [gearType.value, pieceType.value]
      helpStoredInfo.value['statType'] = statType.value.slice()
      helpStoredInfo.value['statInput'] = statInput.value.slice()

      // Example inputs for demonstration
      gearType.value = '[8000] Weapons'
      pieceType.value = 'Weapon'
      changeGear()
      statType.value[2] = 'Minimum Damage'
      const statDist = [0.82, 0.65, 0.90, 0.78]
      for (let i = 0; i < 4; i++) {
        let maxValue = gears[gearType.value][pieceType.value]["Stats"][statType.value[i]]["Value"];
        statInput.value[i] = isDecimalStat(statType.value[i]) ? +(statDist[i] * maxValue).toFixed(1) : parseInt(statDist[i] * maxValue);
      }

      dimmed.value = true
    }
    // Turn off help window and change inputs back to what they were before
    else {
      displayWindow.value['help'] = 0
      displayWindow.value['gear'] = false
      dimmed.value = false
      gearType.value = helpStoredInfo.value['item'][0]
      pieceType.value = helpStoredInfo.value['item'][1]
      changeGear()
      statType.value = helpStoredInfo.value['statType'].slice()
      statInput.value = helpStoredInfo.value['statInput'].slice()
    }
  }
  // Specific step to activate/deactivate gear selection window during help cycle
  else if (displayWindow.value['help'] === 7 || displayWindow.value['help'] === 4) {
    displayWindow.value['help'] -= 1
    displayWindow.value['gear'] = !displayWindow.value['gear']
  }
  // Progress help cycle
  else if (displayWindow.value['help'] > 1) {
    displayWindow.value['help'] -= 1
  }
  // End help cycle, turn off help window and change inputs back to what they were before
  else if (displayWindow.value['help'] === 1){
    displayWindow.value['help'] = 0
    displayWindow.value['gear'] = false
    dimmed.value = false
    gearType.value = helpStoredInfo.value['item'][0]
    pieceType.value = helpStoredInfo.value['item'][1]
    changeGear()
    statType.value = helpStoredInfo.value['statType'].slice()
    statInput.value = helpStoredInfo.value['statInput'].slice()
  }
  // If not in help cycle
  else {
    // Save disclaimer acceptance when closing it
    if (displayWindow.value['disclaimer'] && (selection === 'none' || selection !== 'disclaimer')) 
      localStorage.setItem('ltGearCalculatorDisclaimerAccepted', 'true')

    // Check which window is to be activated, turn it on and turn off every other window
    for (let w in displayWindow.value) {
      if (w === selection && !displayWindow.value[w]) { displayWindow.value[w] = true }
      else { displayWindow.value[w] = false }
    }
    
    // Dim the background if turning on a window, light it otherwise
    if (displayWindow.value[selection]) { dimmed.value = true }
    else { dimmed.value = false }
  }
}

// Switch between rating/score
function toggleMode(){
  switchState.value = !switchState.value
}

    // Get style to fill percentage bars when evaluating stats
function getPercentageBarStyle(value, chosenColor = 'default') {
  const colorValues = {
    'empty': 'white', 
    'default': '#ffaaff',
    'potential': 'orange', // Used for 6k/7k Lucent potential stats
    'extraDefault': 'rgb(235, 117, 235)', // Used if the stat surpasses 100%
    'extraPotential': '#ff8800',
    'limit': 'red' // Used if a stat is higher than possible, even with potential
  };

  const indexValues = {
    'empty': 100, 
    'default': 120,
    'potential': 110,
    'extraDefault': 140,
    'extraPotential': 130,
    'limit': 150
  }

  let color = colorValues[chosenColor]
  let zIndex = indexValues[chosenColor]
  if (value > 150) { 
    color = colorValues['limit']
    zIndex = indexValues['limit']
  }

  return {
    width: Math.max(Math.min(value, 100), 0) + '%',
    'background-color': color,
    'z-index': zIndex
  }
}

// Check if the final upgrade of an item is Lucent or Ascended
function getFinalUpgrade(item) {
  switch (item) {
    case "[3500] Badge 6":
    case "[9999] Badge 6":
      return ''
    case "[9999] Armor":
      return 'Ascended'
    default:
      return 'Lucent'
  }
}

// Get the max rating of an item with the currently selected stats
function getSelectedRating() {
  let rating = 0
  for (let i = 0; i < 4; i++) {
    rating += gears[gearType.value][pieceType.value]['Stats'][statType.value[i]]['DI']
  }
  // 6k and 7k have penalties on the last enchant, thus reduced here
  if (['6000', '7000'].includes(gearType.value.slice(1,5))) {
    rating += gears[gearType.value][pieceType.value]['Stats'][statType.value[4]]['DI'] * 0.8
  } else {
    rating += gears[gearType.value][pieceType.value]['Stats'][statType.value[4]]['DI']
  }

  return rating
}

// Score setting instead of rating - currently unused
function getSelectedScore() {
  let score = getSelectedRating()

  score = score / gears[gearType.value][pieceType.value]['DI'] * 100
  return score
}

// Custom text styling based on tiers - currently unused
function getTierStyle(tier) {
  const colors = {
    'F': 'gray',
    'E': 'lightgray',
    'D': 'white',
    'C': 'green',
    'B': 'blue',
    'A': 'yellow',
    'S': 'purple',
    'SS': 'pink',
    'SSS': 'red',
  }

  let results = {
    color: 'white',
    'text-shadow': '-1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000',
    'margin-left': '5px'
  }

  // if (['S', 'SS', 'SSS'].includes(tier)) {
  //   results['animation'] = 'tierGradient 2s infinite alternate linear'
  // }

  return results
}

    // Change the information windows based on hovered item on gear selection window
function setHighlightedPiece(gear, piece) {
  highlightedPiece.value = [gear, piece]
}

    // Logic for tooltip - currently unused, using CSS methods instead
    // onMouseMove(e) {
    //   this.tooltipPosition[0] = e.pageX + 15
    //   this.tooltipPosition[1] = e.pageY
    // },

let statIndex = [ 
  "Critical Damage", "Normal Amplification", "Basic Stats", "Attack/Intensity", "Accuracy", "Strength/Magic",
  "Minimum Damage", "Back Attack Damage", "Static Damage %", "Boss Added Damage", "Normal Added Damage",
  "Stamina", "Maximum HP %", "Other (Non-damaging)", "Maximum Damage", "Basic Stats %", "Attack/Intensity %",
  "Boss Amplification", "Movement Speed", "Static Damage", "Normal Added %", "Dual Damage", "Defense Penetration",
  "Boss Added %", "Strength/Magic %", "Boss Added", "Normal Added", "Cooldown Reduction", "Only Strength/Magic", "Maximum HP"
]

function generateURL() {
  // 0-1
  let gearNum = Object.keys(gears).reverse().indexOf(gearType.value).toString().padStart(2,'0')
  // 2
  let pieceNum = Object.keys(gears[gearType.value]).indexOf(pieceType.value)
  // 3-4 to 5-10, 11-12 to 13-18, 19-20 to 21-26, 27-28 to 29-34, 35-36 to 37-42
  let statNums = []
  statType.value.forEach((s) => {
    statNums.push(statIndex.indexOf(s).toString().padStart(2, '0'))
  })
  for (let i = 0; i < 5; i++) {
    statNums[i] = statNums[i] + (Math.min(statInput.value[i]*10, 999999)).toString().padStart(6, '0')
  }

  // 
  let resString = gearNum + pieceNum + statNums.join('')
  // console.log(resString)

  // let enchants = []
  // Object.keys(gears).forEach((g) => {
  //   Object.keys(gears[g]).forEach((p) => {
  //     if(!['Sheet Link', 'Potential'].includes(p)) {
  //       console.log(p)
  //       Object.keys(gears[g][p]['Stats']).forEach((s) => enchants.push(s))
  //     }
  //   })
  // })
  // let uniqueEnchants = new Set(enchants)
  // console.log(uniqueEnchants)

  navigator.clipboard.writeText('https://kedanao.github.io/lt-gear-score-calculator/?it=' + resString)

  toggleClipboardTooltip()
  return resString
}

function readURL(pars) {
  try {
    let gearName = Object.keys(gears).reverse()[parseInt(pars.slice(0,2))]
    let pieceName = Object.keys(gears[gearName])[parseInt(pars.slice(2,3))]
    let statNames = []
    for (let i = 3; i < 36; i += 8) {
      statNames.push(statIndex[parseInt(pars.slice(i,i+2))])
    }
    let statValues = []
    for (let i = 5; i < 42; i += 8) {
      statValues.push(parseInt(pars.slice(i,i+6)) / 10)
    }

    // In case of an invalid string being passed, validate each step
    if (!Object.keys(gears).includes(gearName) ||
        !Object.keys(gears[gearName]).includes(pieceName) ||
        statNames.map((i) => {return statIndex.includes(i)}).includes(false) ||
        statValues.map((i) => {return i < 100000 && i >= 0}).includes(false)) {
      throw new Error("Invalid item string")
    }

    gearType.value = gearName
    pieceType.value = pieceName
    changeGear()
    statType.value = statNames.slice()
    statInput.value = statValues.slice()
  }
  catch (e) {
    console.error(e)
  }
}

const clipboardTooltip = ref(false)
const clipboardToolTipTimeout = ref(null)

function toggleClipboardTooltip () {
  clearTimeout(clipboardToolTipTimeout.value)
  clipboardTooltip.value = true

  clipboardToolTipTimeout.value = setTimeout(() => {
    clipboardTooltip.value = false
  }, 2000)
}

// On load, set gear and initial results
// console.log("Load")
changeGear()

// Read URL params

let urlParams = new URLSearchParams(window.location.search);
if(urlParams.has('it')) {
  readURL(urlParams.get('it'))
  displayWindow.value['disclaimer'] = false
  dimmed.value = false
}

updateValues()

// Set the background image
const body = document.querySelector('body')
body.style.backgroundImage = 'url(' + imgUrls[`./assets/background.png`] + ')' 
body.style.backgroundSize = 'cover' 
body.style.backgroundRepeat = 'no-repeat'
body.style.backgroundPosition = 'center center'
body.style.backgroundAttachment = 'fixed'

watch([gearType, pieceType, statType, statInput], () => {
  updateValues()
}, {
  deep: true,
  flush: 'post',
})
</script>

<template>
  <!-- Page header -->
  <div class="container header">
    <span class="header-title results-center"><img class="gear-image" :src="imgUrls[`./assets/hammer.png`]" alt=""><strong>LaTale Gear Score Calculator</strong><span class="header-separator"></span></span>
    <span>
      <span class="header-button" @click="toggleDisplayWindow('disclaimer')"><img class="icon-image" :src="imgUrls[`./assets/Icon_Info.png`]" alt="Information"></span>
      <span class="header-button mobile-hide" @click="toggleDisplayWindow('help')"><img class="icon-image" :src="imgUrls[`./assets/Icon_Help.png`]" alt="Help"></span>
      <span class="other-tools" @click="displayOthers = !displayOthers" @mouseenter="displayOthers = true" @mouseleave="displayOthers = false">
        <span class="header-button"><img class="icon-image" :src="imgUrls[`./assets/Icon_Link.png`]" alt="Links"></span>
        <div v-if="displayOthers" class="other-tools-links container">
          <a href="https://kedanao.github.io/lt-damage-calculator/" target="_blank">Damage Calculator  <img class="icon-image-small" :src="imgUrls[`./assets/Icon_External.png`]" alt=""></a>
          <a href="https://kedanao.github.io/lt-runestone-calculator/" target="_blank">Runestone Calculator  <img class="icon-image-small" :src="imgUrls[`./assets/Icon_External.png`]" alt=""></a>
        </div>
      </span>
    </span>
  </div>
  <!-- Stat Input -->
  <div id="calculator-container">
    <!-- dim-above class is used to have elements display above the dimmed layer during the help cycle -->
    <div class="calculator-input container input-container" :class="{ 'dim-above': displayWindow['help'] === 7 }">
      <div v-if="displayWindow['help'] === 7" class="help-container dim-above">
        <div class="help-info help-info-top">
          Select the item, stats and insert your values
        </div>
      </div>
      <div class="results-header">
        <!-- Clickable section to open the gear selection menu -->
        <img class="gear-image gear-clickable" :src="imgUrls[`./assets/${pieceType}_${gearType.slice(1,5)}.png`]" alt="" @click="toggleDisplayWindow('gear')">
        <div class="selection-text header-left gear-clickable" @click="toggleDisplayWindow('gear')">
          <span class="results-header-text">{{ pieceType }} ({{ gearType.slice(1,5) }})</span>
          <span>Click to change item</span>
        </div>
        <!-- Max Rating info -->
        <div class="header-right">
          <div v-if="displayWindow['help'] === 7" class="help-container dim-above">
            <div class="help-info help-info-right">
              Each selected stat has a weighted value, the max. rating utilized for scoring considers the top recommended stats
            </div>
          </div>
          <div>Max. Rating: <span class="fugaz-one-regular">{{ gears[gearType][pieceType]['DI'].toFixed(2) }}%</span></div>
          <div>These Stats: 
            <span class="fugaz-one-regular">{{ getSelectedRating().toFixed(2) + '%' }}</span>
            <!-- <span v-if="switchState">{{ getSelectedRating().toFixed(2) + '%' }}</span> -->
            <!-- <span v-else>{{ getSelectedScore().toFixed(0) + '%' }}</span> -->
          </div>
        </div>
      </div>
      <!-- Stat Input -->
      <div class="results-stats">
        <div v-for="n in 5" class="stat-block">
          <!-- Using custom select/options components -->
          <div class="stat-block-individual">
            <stat-select v-model="statType[n-1]" class="stat-selector">
              <stat-option :value="s" v-for="s in statOptions">
                <div class="stat-option-text"><strong>{{ s }}</strong></div>
                <div class="stat-option-subtext"><em>Max. Value: {{ gears[gearType][pieceType]['Stats'][s]["Value"] }} | Max. Rating: {{ gears[gearType][pieceType]['Stats'][s]["DI"].toFixed(2) }}% </em></div>
              </stat-option>
            </stat-select>
            <input class="stat-input" placeholder="Value..."
              type="number" v-model="statInput[n-1]">
          </div>
        </div>
      </div>
      <!-- Quick setting buttons -->
      <div class="results-footer">
        <div v-if="displayWindow['help'] === 7" class="help-container dim-above">
          <div class="help-info help-info-right">
            These buttons can help you preset enchant values, check the detailed spreadsheet for that piece or copy a direct link to your piece within the calculator
            <div class="help-button-container">
              <button class="help-button" @click="toggleDisplayWindow('none')">Next →</button>
              <button class="help-button" @click="toggleDisplayWindow('help')">Close</button>
            </div>
          </div>
        </div>
        <div id="calculator-buttons">
          <div class="preset-buttons">
            <button @click="setValues(0,0)">Clear</button>
            <button @click="setValues(2,valueButton)">Duo</button>
            <button @click="setValues(3,valueButton)">Trio</button>
            <button @click="setValues(4,valueButton)">Quad</button>
            <button @click="setValues(5,valueButton)">Penta</button>
            <select v-model="valueButton" class="preset-input">
              <option v-for="n in 10" :value="n*10">{{ n*10 }}%</option>
            </select>
          </div>
        </div>
        <div class="additional-buttons">
          <div class="calculator-link">
            <a :href="gears[gearType]['Sheet Link']" target="_blank">Detailed Spreadsheet</a>
            <img class="icon-image-small float-corner" :src="imgUrls[`./assets/Icon_External.png`]" alt="">
          </div>
          <div class="clipboard-button" @click="generateURL()">
            Copy link to clipboard
            <img class="icon-image-small float-corner" :src="imgUrls[`./assets/Icon_Link.png`]" alt="">
            <transition name="window-fade">
              <div v-if="clipboardTooltip" class="clipboard-tooltip">
                Copied!
              </div>
            </transition>
          </div>
        </div>
      </div>
    </div>
    <!-- Basic Results -->
    <div class="calculator-values container main-container" :class="{ 'dim-above': displayWindow['help'] === 3 || displayWindow['help'] === 2 }">
      <div v-if="displayWindow['help'] === 3" class="help-container dim-above" >
        <div class="help-info help-info-top">
          Individual and total results are displayed here
        </div>
      </div>
      <div class="results-header">
        <img class="gear-image"
            :src="imgUrls[`./assets/${pieceType}_${gearType.slice(1,5)}.png`]" alt="">
        <span class="results-header-text header-left">{{ pieceType }} ({{ gearType.slice(1,5) }})</span>
        <div>
          <div v-if="displayWindow['help'] === 3" class="help-container dim-above" >
            <div class="help-info help-info-right">
              Switch between score (out of 100%) and rating (raw value)
            </div>
          </div>
          <!-- Button to switch between score/rating -->
          <div class="header-right toggle-switch"
            :class="{ 'mode-switch': switchState }"
            @click="toggleMode">
          </div>
          <div v-if="switchState" class="switch-text">Rating</div>
          <div v-else="switchState" class="switch-text">Score</div>
        </div>
      </div>
      <!-- Individual results block -->
      <div class="results-stats">
        <div v-for="n in 5" class="stat-block">
          <div>
            <!-- If input value is empty, don't display results -->
            <div v-if="statInput[n-1] === '' || statInput[n-1] <= 0" class="results-tiers">
              <span>---</span>
              <span>---</span>
            </div>
            <!-- Result texts -->
            <div v-else class="results-tiers">
              <span> {{ statType[n-1] }}: {{ statInput[n-1] }} </span>
              <span class="fugaz-one-regular"> 
                <span v-if="switchState">{{ results['individual'][n-1]['DI'] }}%</span>
                <span v-else>{{ results['individual'][n-1]['percent'] }}%</span>
                <span class="tier-text">{{ results['individual'][n-1]['tier'] }}</span>
              </span>
            </div>
            <!-- Result bar -->
            <div>
              <span class="full-bar">
                <span class="filled-bar" :style="getPercentageBarStyle(results['individual'][n-1]['percent'] - 100, 'extraDefault')"></span>
                <span class="filled-bar" :style="getPercentageBarStyle(results['individual'][n-1]['percent'])"></span>
              </span>
            </div>
          </div>
        </div>
      </div>
      <!-- Total result -->
      <div class="results-total results-footer">
        <!-- Total result text -->
        <div class="results-tiers">
          <span>TOTAL</span>
          <span class="fugaz-one-regular">
            <span v-if="switchState">{{ results['DI'] }}%</span>
            <span v-else>{{ results['percent'] }}%</span>
            <span class="tier-text">{{ results['tier'] }}</span>
          </span>
        </div>
        <div v-if="displayWindow['help'] === 2" class="help-container dim-above" >
          <div class="help-info help-info-top">
            Hover over icons that appear in this region to see bonus information on this piece's enchants
            <div class="help-button-container">
              <button class="help-button" @click="toggleDisplayWindow('none')">Next →</button>
              <button class="help-button" @click="toggleDisplayWindow('help')">Close</button>
            </div>
          </div>
        </div>
        <!-- Total result bar -->
        <span class="full-bar">
          <span class="filled-bar" :style="getPercentageBarStyle(results['percent'] - 100, 'extraDefault')"></span>
          <span class="filled-bar" :style="getPercentageBarStyle(results['percent'])"></span>
        </span>
        <div v-if="displayWindow['help'] === 3" class="help-container dim-above" >
          <div class="help-info help-info-bottom">
            The total % is weighed depending on the values of the enchanted stats, and the score needed for tiers may change depending on item
            <div class="help-button-container">
              <button class="help-button" @click="toggleDisplayWindow('none')">Next →</button>
              <button class="help-button" @click="toggleDisplayWindow('help')">Close</button>
            </div>
          </div>
        </div>
        <!-- Notes about the selected & enchanted stats -->
        <!-- note-text used with CSS for tooltip text effect when hovering -->
        <div class="results-notes">
          <div class="results-individual-notes">
            <span v-if="validStats.includes('Back Attack Damage')"
              note-text="This item has Back Attack Damage. Back Attack Damage only works with direct damage and requires good mobility for positioning. May not be useful for every class.">
              <img class="note-image"
                    :src="imgUrls[`./assets/Note_Back.png`]" alt="">
            </span>
            <span v-if="validStats.includes('Defense Penetration')"
              note-text="This item has Defense Penetration. Defense Penetration does not function with summons and is only effective if your Penetration is increased in the status window.">
              <img class="note-image"
                    :src="imgUrls[`./assets/Note_Penetration.png`]" alt="">
            </span>
            <span v-if="validStats.includes('Attack/Intensity') + validStats.includes('Attack/Intensity %') > 1"
              note-text="This item has a great amount of Attack/Intensity, which mainly benefits classes that are heavy on direct hits.">
              <img class="note-image"
                    :src="imgUrls[`./assets/Note_Attack.png`]" alt="">
            </span>
            <span v-else-if="validStats.includes('Basic Stats %') + validStats.includes('Strength/Magic') + validStats.includes('Basic Stats') > 1"
              note-text="This item has a great amount of Strength/Magic, which mainly benefits classes that are heavy on summons.">
              <img class="note-image"
                    :src="imgUrls[`./assets/Note_Strength.png`]" alt="">
            </span>
            <span v-if="validStats.includes('Minimum Damage')"
              note-text="This item has Minimum Damage. Minimum Damage is only effective as long as it is under your Maximum Damage.">
              <img class="note-image"
                    :src="imgUrls[`./assets/Note_Minimum.png`]" alt="">
            </span>
            <span v-if="validStats.includes('Maximum HP %') || validStats.includes('Basic Stats') || validStats.includes('Basic Stats %') || validStats.includes('Stamina')"
              note-text="This item has stats that increases your HP, granting greater survivability but no additional offensive value.">
              <img class="note-image"
                    :src="imgUrls[`./assets/Note_HP.png`]" alt="">
            </span>
          </div>
        </div>
        
      </div>
    </div>
    <!-- Upgraded results - if the item doesn't get additional enchants, hide the block -->
    <div v-if="getFinalUpgrade(gearType) !== ''" class="calculator-values container main-container upgraded-container" :class="{ 'dim-above': displayWindow['help'] === 1 }">
      <div v-if="displayWindow['help'] === 1" class="help-container dim-above" >
        <div class="help-info help-info-top">
          This section displays results when the piece is upgraded to Lucent or Ascended and further enchanted
        </div>
      </div>
      <div class="results-header">
        <img class="gear-image"
            :src="imgUrls[`./assets/${pieceType}_${gearType.slice(1,5)}.png`]" alt="">
        <!-- Check if final upgrade is Lucent or Ascended -->
        <span class="results-header-text header-left">{{ getFinalUpgrade(gearType) }} {{ pieceType }} ({{ gearType.slice(1,5) }})</span>
      </div>
      <!-- Individual results block -->
      <div class="results-stats">
        <div v-for="n in 5" class="stat-block">
          <div>
            <div v-if="statInput[n-1] === '' || statInput[n-1] <= 0" class="results-tiers">
              <span>---</span>
              <span>---</span>
            </div>
            <!-- If the minimum and maximum potentials are different, display both as a range -->
            <div v-else-if="results['individual'][n-1]['potentialMin'] === results['individual'][n-1]['potentialMax']" class="results-tiers">
              <span> Lv.{{parseInt(gearType.slice(1,5)) < 9999 ? 4 : 5}} {{ statType[n-1] }}: {{ results['individual'][n-1]['potentialMin'] }} </span>
              <span class="fugaz-one-regular">
                <span v-if="switchState">{{ results['individual'][n-1]['potentialDIMin'] }}%</span>
                <span v-else>{{ results['individual'][n-1]['potentialMinPerc'] }}%</span>
                <span class="tier-text">{{ results['individual'][n-1]['potentialTierMin'] }}</span>
              </span>
            </div>
            <div v-else class="results-tiers">
              <span> {{ statType[n-1] }}: {{ results['individual'][n-1]['potentialMin'] }} ~ {{ results['individual'][n-1]['potentialMax'] }} </span>
              <span class="fugaz-one-regular">
                <span v-if="switchState">{{ results['individual'][n-1]['potentialDIMin'] }}% ~ {{ results['individual'][n-1]['potentialDIMax'] }}%</span>
                <span v-else>{{ results['individual'][n-1]['potentialMinPerc'] }}% ~ {{ results['individual'][n-1]['potentialMaxPerc'] }}%</span>
                <span class="tier-text">{{ results['individual'][n-1]['potentialTierMin'] }} ~ {{ results['individual'][n-1]['potentialTierMax'] }}</span>
              </span>
            </div>
            <div>
              <span class="full-bar">
                <span class="filled-bar" :style="getPercentageBarStyle(results['individual'][n-1]['potentialMaxPerc'] - 100, 'extraPotential')"></span>
                <span class="filled-bar" :style="getPercentageBarStyle(results['individual'][n-1]['potentialMinPerc'] - 100, 'extraDefault')"></span>
                <span class="filled-bar" :style="getPercentageBarStyle(results['individual'][n-1]['potentialMaxPerc'], 'potential')"></span>
                <span class="filled-bar" :style="getPercentageBarStyle(results['individual'][n-1]['potentialMinPerc'])"></span>
              </span>
            </div>
          </div>
        </div>
      </div>
      <!-- Total results -->
      <div class="results-total results-footer">
        <div class="results-tiers">
          <!-- Display Lv4/Lv5 depending on the item's maximum level (Currently only 9999 has Lv5) -->
          <span>Lv.{{parseInt(gearType.slice(1,5)) < 9999 ? 4 : 5}} TOTAL</span>
          <span class="fugaz-one-regular">
            <span v-if="switchState">{{ results['potentialDI'] }}</span>
            <span v-else>{{ results['potentialScore'] }}</span>
            <span class="tier-text"> {{ results['potentialTier'] }}</span>
          </span>
        </div>
        
        <span class="full-bar">
          <span v-if="results['potentialScore'].split(' ~ ').length > 1" class="filled-bar" :style="getPercentageBarStyle(results['potentialScore'].split(' ~ ')[1].slice(0,-1) - 100, 'extraPotential')"></span>
          <span class="filled-bar" :style="getPercentageBarStyle(results['potentialScore'].split(' ~ ')[0].slice(0,-1) - 100, 'extraDefault')"></span>
          <span v-if="results['potentialScore'].split(' ~ ').length > 1" class="filled-bar" :style="getPercentageBarStyle(results['potentialScore'].split(' ~ ')[1].slice(0,-1), 'potential')"></span>
          <span class="filled-bar" :style="getPercentageBarStyle(results['potentialScore'].split(' ~ ')[0].slice(0,-1))"></span>
        </span>
        <div class="results-notes">
          <span v-if="results['potentialScore'].split(' ~ ').length > 1">
            <span v-if="switchState" class="fugaz-one-regular">{{ (parseFloat(results['potentialDI'].split(' ~ ')[0]) - results['DI']).toFixed(2) }}% ~ {{ (parseFloat(results['potentialDI'].split(' ~ ')[1]) - results['DI']).toFixed(2) }}%</span>
            <span v-else class="fugaz-one-regular">{{ parseInt(parseInt(results['potentialScore'].split(' ~ ')[0]) - results['percent']) }}% ~ {{ parseInt(parseInt(results['potentialScore'].split(' ~ ')[1]) - results['percent']) }}%</span>
            <span><em> Gain</em></span>
          </span>
          <span v-else>
            <span v-if="switchState" class="fugaz-one-regular">{{ (parseFloat(results['potentialDI']) - results['DI']).toFixed(2) }}%</span>
            <span v-else class="fugaz-one-regular">{{ parseInt(parseInt(results['potentialScore']) - results['percent']) }}%</span>
            <span><em> Gain</em></span>
          </span>
          
        </div>
        <div v-if="results['sssOdds']['available']" class="sss-odds">
          <div class="sss-odds-title">
            <span class="sss-odds-heading">SSS at max upgrade</span>
            <span class="sss-odds-total">
              <span>Total odds</span>
              <span class="fugaz-one-regular">{{ results['sssOdds']['totalChanceText'] }}</span>
            </span>
          </div>
          <div class="sss-odds-meta">
            <div class="sss-meta-item">
              <span class="sss-meta-label">Target</span>
              <span>{{ results['sssOdds']['targetScore'] }}</span>
            </div>
            <div class="sss-meta-item">
              <span class="sss-meta-label">Planned</span>
              <span v-if="switchState">{{ results['sssOdds']['plannedDIText'] }}</span>
              <span v-else>{{ results['sssOdds']['plannedScoreText'] }}</span>
            </div>
            <div class="sss-meta-item">
              <span class="sss-meta-label">Base rolls</span>
              <span>{{ results['sssOdds']['baseRollText'] }}</span>
            </div>
            <div class="sss-meta-item">
              <span class="sss-meta-label">Survival</span>
              <span>{{ results['sssOdds']['survivalChanceText'] }}</span>
            </div>
            <div class="sss-meta-item">
              <span class="sss-meta-label">Value check</span>
              <span>{{ results['sssOdds']['rollValueChanceText'] }}</span>
            </div>
          </div>
          <div class="sss-roll-ranges">
            <div class="sss-roll-header">
              <span>Stat</span>
              <span>Max upgrade value</span>
              <span>Roll state</span>
            </div>
            <div v-for="line in results['sssOdds']['lines']" class="sss-roll-row" :class="`sss-roll-row-${line.status}`">
              <span>{{ line.stat }}</span>
              <span :class="{ 'fugaz-one-regular': line.status !== 'ignored' }">{{ line.range }}</span>
              <span>{{ line.rollText }}</span>
            </div>
          </div>
        </div>
        <div v-if="displayWindow['help'] === 1" class="help-container dim-above" >
          <div class="help-info help-info-bottom">
            Gain represents the growth over the non-upgraded piece<br></br>
            Values may surpass 100% in this context, however tiers will still only consider up to 100%
            <div class="help-button-container help-button-right">
              <button class="help-button" @click="toggleDisplayWindow('help')">Close</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- Tier Evaluation -->
  <div class="container" id="tier-container">
    <div id="tiers">
      <h2>Tier Evaluation</h2>
      <table>
        <tr>
          <th>Tier</th>
          <th>Comment</th>
          <th>Upgrade?</th>
          <th>Enchants</th>
          <th>Cost (per piece)</th>
        </tr>
        <tr>
          <td>F - E</td>
          <td>Bad, replaces unfinished previous tier</td>
          <td>N</td>
          <td>Any</td>
          <td>0b - 5b</td>
        </tr>
        <tr>
          <td>D - C</td>
          <td>Minimum to replace previous tier</td>
          <td>N</td>
          <td>Duo</td>
          <td>5b - 30b</td>
        </tr>
        <tr>
          <td>B</td>
          <td>Good growth over previous tier, worth upgrading</td>
          <td>Y</td>
          <td>Trio</td>
          <td>60b - 120b</td>
        </tr>
        <tr>
          <td>A</td>
          <td>Great growth, only recommended for late endgame</td>
          <td>Y</td>
          <td>Quad</td>
          <td>200b+</td>
        </tr>
        <tr>
          <td>S - SSS</td>
          <td>Perfectionism, typically will only come with upgraded enchants<br>Pentas will cost several hundreds of billions of ely to make a single piece</td>
          <td>Y</td>
          <td>Penta</td>
          <td>1000b+</td>
        </tr>
      </table>
    </div>
  </div>

  <!-- Disclaimer -->
  <transition name="window-fade">
    <div v-if="displayWindow['disclaimer']" class="disclaimer dim-above container">
      <h1 style="text-align: center;">LaTale Gear Score Calculator</h1>
      <h2 style="color: red;"><strong>⚠️ Note that this is hypothetical damage, and it may not represent actual damage versus actual content ⚠️<br>
        Please also note this calculator only calculates for a single item, your other stats and items may change how well it performs</strong></h2>
      <div>
        <h3>Important notes</h3>
        <ul>
          <li><span>If you want more detailed tests with more stats and items, please use the <a href="https://kedanao.github.io/lt-damage-calculator/" target="_blank">Damage Calculator</a></span> and detailed sheets linked below</li>
          <li><span>Ratings are based on <strong style="color: blue;">+0 unupgraded enchant values</strong>, note that <strong style="color: blue;">extra stats from level 3~5 enchants will increase the score and cannot be considered the same as +0 enchants</strong></span></li>
          <li><strong>Minimum Damage</strong>: Value only applies as long as your Minimum is lower than your Maximum. Any amount above is wasted</li>
          <li><strong>Attack/Intensity vs Strength/Magic in new items</strong>: Strength/Magic and Attack/Intensity will have the same value unless there's a major difference between them.
          <br>It is encouraged to check which stat your class benefits from more and focus on that
          <br>This will begin with 9999 armor</li>
          <li><strong>Attack/Intensity vs Strength/Magic in older items</strong>: Older items use a ratio of 1 attack : 100 ~ 110 strength
          <br>Note that the calculator also considers higher strength/magic % than attack/intensity %, and a value of 12% strength/magic ratio
          <br>Generally this means flat strength/magic is superior to flat attack/intensity, however attack/intensity % is superior to strength/magic %
          <br>If you want to consider different numbers, please use the <a href="https://kedanao.github.io/lt-damage-calculator/" target="_blank">Damage Calculator</a> with your own stats and settings</li>
          <li><strong>Defense Penetration</strong>: Does not apply to summons, avoid in summon-heavy classes</li>
          <li><strong>Back Attack Damage</strong>: Only applies to direct damage, avoid in summon-heavy classes</li>
          <li>The chosen stats aren't the ones that result in the most possible damage, but optimized for general use on every class with essential utility stats
          <br>Because of this stats like Minimum Damage, Back Attack Damage or flat Strength/Magic may be disregarded for other stats as they are not universally applicable</li>
        </ul>
        Please also pay attention to the additional notes under the total result in case of special stats being enchanted.
        <br>Click the "Help" button if you want an explanation on how each aspect of the calculator functions.
      </div>
      <button class="disclaimer-button" @click="toggleDisplayWindow('none')">Accept</button>
    </div>
  </transition>
  <!-- Info -->
  
  
  
  <!-- Gear Selector -->
  <transition name="window-fade">
    <!-- Display items and separate by section -->
    <div v-if="displayWindow['gear']" class="gear-container dim-above">
      <div class="gear-selection container">
        <div v-if="displayWindow['help'] === 6" class="help-container dim-above">
          <div class="help-info help-info-right">
            Hover over an item to see their information, click to select it
            <div class="help-button-container">
              <button class="help-button" @click="toggleDisplayWindow('none')">Next →</button>
              <button class="help-button" @click="toggleDisplayWindow('help')">Close</button>
            </div>
          </div>
        </div>
        <div v-for="t in Object.keys(gears)">
          <div class="item-separator">{{ t }}</div>
          <img class="gear-image gear-clickable"
            v-for="p in Object.keys(gears[t]).slice(0,-2)" 
            :src="imgUrls[`./assets/${p}_${t.slice(1,5)}.png`]" alt=""
            @click="setGear(t,p)"
            @mouseenter="setHighlightedPiece(t,p)">
        </div>
      </div>
      <!-- Section to display all possible enchants for the hovered piece -->
      <div class="gear-info container mobile-hide">
        <div class="results-header">
          <img class="gear-image"
            :src="imgUrls[`./assets/${highlightedPiece[1]}_${highlightedPiece[0].slice(1,5)}.png`]" alt="">
          <span class="results-header-text"> {{ highlightedPiece[1] }} ({{ highlightedPiece[0].slice(1,5) }})</span>
        </div>
        <div>
          <div>
            <div v-if="displayWindow['help'] === 5" class="help-container dim-above">
              <div class="help-info help-info-right">
                You can see information on all possible enchants for the hovered piece here
                <div class="help-button-container">
                  <button class="help-button" @click="toggleDisplayWindow('none')">Next →</button>
                  <button class="help-button" @click="toggleDisplayWindow('help')">Close</button>
                </div>
              </div>
            </div>
            <table>
              <tr>
                <th :colspan="getFinalUpgrade(highlightedPiece[0]) !== '' ? 4 : 3">
                  Possible Enchants
                </th>
              </tr>
              <tr>
                <th>Stat</th>
                <th>Max. Value</th>
                <th>Rating</th>
                <th v-if="getFinalUpgrade(highlightedPiece[0]) !== ''">Potential</th>
              </tr>
              <tr v-for="e in Object.keys(gears[highlightedPiece[0]][highlightedPiece[1]]['Stats'])">
                <td>{{ e }}</td>
                <td>{{ gears[highlightedPiece[0]][highlightedPiece[1]]['Stats'][e]['Value'] }}</td>
                <td>{{ gears[highlightedPiece[0]][highlightedPiece[1]]['Stats'][e]['DI'] }}%</td>
                <td v-if="getFinalUpgrade(highlightedPiece[0]) !== ''">
                  {{ gears[highlightedPiece[0]][highlightedPiece[1]]['Stats'][e]['Potential'][0] }}
                  <span v-if="gears[highlightedPiece[0]][highlightedPiece[1]]['Stats'][e]['Potential'][0] !== gears[highlightedPiece[0]][highlightedPiece[1]]['Stats'][e]['Potential'][1]">
                   ~ {{ gears[highlightedPiece[0]][highlightedPiece[1]]['Stats'][e]['Potential'][1] }}</span>
                </td>
              </tr>
            </table>
          </div>
        </div>
      </div>
      <!-- View tier information for the hovered piece -->
      <div class="gear-info-extra container mobile-hide">
        <div class="results-header">
          <img class="gear-image"
            :src="imgUrls[`./assets/${highlightedPiece[1]}_${highlightedPiece[0].slice(1,5)}.png`]" alt="">
          <span class="results-header-text">Tier Info</span>
        </div>
        <div>
          <div>
            <div v-if="displayWindow['help'] === 4" class="help-container dim-above">
              <div class="help-info help-info-right">
                This table displays the score necessary for each tier for that specific item and expected enchant quality to reach it
                <div class="help-button-container">
                  <button class="help-button" @click="toggleDisplayWindow('none')">Next →</button>
                  <button class="help-button" @click="toggleDisplayWindow('help')">Close</button>
                </div>
              </div>
            </div>
            <table>
              <tr>
                <th colspan="7">
                  Tier Equivalence
                </th>
              </tr>
              <tr>
                <th>Score</th>
                <th>Tier</th>
                <th>Single</th>
                <th>Duo</th>
                <th>Trio</th>
                <th>Quad</th>
                <th>Penta</th>
              </tr>
              <tr v-for="e in Object.keys(tiers[highlightedPiece[0]][gears[highlightedPiece[0]][highlightedPiece[1]]['Type']])">
                <td>{{ tiers[highlightedPiece[0]][gears[highlightedPiece[0]][highlightedPiece[1]]['Type']][e]['Score'] }}</td>
                <td>{{ e }}</td>
                <td>{{ tiers[highlightedPiece[0]][gears[highlightedPiece[0]][highlightedPiece[1]]['Type']][e]['Single'] }}</td>
                <td>{{ tiers[highlightedPiece[0]][gears[highlightedPiece[0]][highlightedPiece[1]]['Type']][e]['Duo'] }}</td>
                <td>{{ tiers[highlightedPiece[0]][gears[highlightedPiece[0]][highlightedPiece[1]]['Type']][e]['Trio'] }}</td>
                <td>{{ tiers[highlightedPiece[0]][gears[highlightedPiece[0]][highlightedPiece[1]]['Type']][e]['Quad'] }}</td>
                <td>{{ tiers[highlightedPiece[0]][gears[highlightedPiece[0]][highlightedPiece[1]]['Type']][e]['Penta'] }}</td>
              </tr>
            </table>
          </div>
        </div>
        <!-- View possible special traits for the hovered piece -->
        <div class="results-header-text" style="margin-top: 5%;">Possible Special Traits</div>
        <div>
          <span v-if="Object.keys(gears[highlightedPiece[0]][highlightedPiece[1]]['Stats']).includes('Back Attack Damage')"
              note-text="Can enchant Back Attack Damage: Only works with direct damage and requires good mobility for positioning. May not be useful for every class.">
              <img class="note-image"
                    :src="imgUrls[`./assets/Note_Back.png`]" alt="">
          </span>
          <span v-if="Object.keys(gears[highlightedPiece[0]][highlightedPiece[1]]['Stats']).includes('Defense Penetration')"
            note-text="Can enchant Defense Penetration: Does not function with summons and is only effective if your Penetration is increased in the status window.">
            <img class="note-image"
                  :src="imgUrls[`./assets/Note_Penetration.png`]" alt="">
          </span>
          <span v-if="Object.keys(gears[highlightedPiece[0]][highlightedPiece[1]]['Stats']).includes('Attack/Intensity') + Object.keys(gears[highlightedPiece[0]][highlightedPiece[1]]['Stats']).includes('Attack/Intensity %') > 1"
            note-text="Can enchant multiple stats that give Attack/Intensity: Mainly benefits classes that are heavy on direct hits.">
            <img class="note-image"
                  :src="imgUrls[`./assets/Note_Attack.png`]" alt="">
          </span>
          <span v-if="Object.keys(gears[highlightedPiece[0]][highlightedPiece[1]]['Stats']).includes('Basic Stats %') + Object.keys(gears[highlightedPiece[0]][highlightedPiece[1]]['Stats']).includes('Strength/Magic') + Object.keys(gears[highlightedPiece[0]][highlightedPiece[1]]['Stats']).includes('Basic Stats') > 1"
            note-text="Can enchant multiple stats that give Strength/Magic: Mainly benefits classes that are heavy on summons.">
            <img class="note-image"
                  :src="imgUrls[`./assets/Note_Strength.png`]" alt="">
          </span>
          <span v-if="Object.keys(gears[highlightedPiece[0]][highlightedPiece[1]]['Stats']).includes('Minimum Damage')"
            note-text="Can enchant Minimum Damage: Only effective as long as it is under your Maximum Damage.">
            <img class="note-image"
                  :src="imgUrls[`./assets/Note_Minimum.png`]" alt="">
          </span>
          <span v-if="Object.keys(gears[highlightedPiece[0]][highlightedPiece[1]]['Stats']).includes('Maximum HP %') || Object.keys(gears[highlightedPiece[0]][highlightedPiece[1]]['Stats']).includes('Basic Stats') || Object.keys(gears[highlightedPiece[0]][highlightedPiece[1]]['Stats']).includes('Basic Stats %') || Object.keys(gears[highlightedPiece[0]][highlightedPiece[1]]['Stats']).includes('Stamina')"
            note-text="Can enchant stats that increase your HP: No additional offensive value, but grants greater survivability.">
            <img class="note-image"
                  :src="imgUrls[`./assets/Note_HP.png`]" alt="">
          </span>
        </div>
      </div>
    </div>
  </transition>

  <!-- Dim page when additional window is open, disable if clicked -->
  <transition name="dim-fade">
    <div v-if="dimmed" id="dim"
      @click="toggleDisplayWindow('none')">
    </div>
  </transition>
  <!-- Tooltip -->
  <!-- <div v-if="tooltip" id="tooltip" :style="{left: tooltipPosition[0] + 'px', top: tooltipPosition[1] + 'px'}">
    {{ tooltipText }}
  </div> -->

  <!-- Preloading images -->
  <div v-for="i in Object.keys(imgUrls)" id="preload">
    <img :src="imgUrls[i]" alt="">
  </div>
</template>
