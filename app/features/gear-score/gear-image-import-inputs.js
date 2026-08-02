import { decimalStats, repeatableStats } from './data.js'

const maximumGearLines = 5

export function buildGearImageImportInputs(lines, item) {
  const options = Object.keys(item?.Stats ?? {})
  const usedStats = new Set()
  const importLines = getImportSlotLines(lines)
  const statTypes = []
  const statInputs = []

  for (let index = 0; index < maximumGearLines; index += 1) {
    const line = importLines[index]
    const lineStat = item?.Stats?.[line?.stat] ? line.stat : ''
    const selectedStat = getAvailableStat(lineStat, options, usedStats)

    statTypes[index] = selectedStat
    statInputs[index] = getImportValue(line, lineStat, selectedStat)

    if (selectedStat && !repeatableStats.includes(selectedStat)) {
      usedStats.add(selectedStat)
    }
  }

  return {
    statTypes,
    statInputs,
  }
}

function getImportSlotLines(lines) {
  // Unenchanted placeholders are physical gear slots even though they contribute no current score.
  // Other ignored rows remain excluded as user-rejected OCR noise.
  return (Array.isArray(lines) ? lines : [])
    .filter(line => !line?.ignored || isUnenchantedPlaceholder(line))
    .slice(0, maximumGearLines)
}

function isUnenchantedPlaceholder(line) {
  return Boolean(line?.ignored && line?.reason === 'Unenchanted placeholder')
}

function getAvailableStat(stat, options, usedStats) {
  if (stat && options.includes(stat) && (repeatableStats.includes(stat) || !usedStats.has(stat))) {
    return stat
  }

  return options.find(option => repeatableStats.includes(option) || !usedStats.has(option)) ?? ''
}

function getImportValue(line, lineStat, selectedStat) {
  if (!line || !lineStat || selectedStat !== lineStat) {
    return ''
  }

  if (isUnenchantedPlaceholder(line)) {
    return 0
  }

  return !line.ignored && Number(line.value) > 0
    ? formatImportValue(lineStat, line.value)
    : ''
}

function formatImportValue(stat, value) {
  const numericValue = Number(value)
  if (!Number.isFinite(numericValue)) {
    return ''
  }

  return decimalStats.includes(stat)
    ? Number(numericValue.toFixed(1))
    : parseInt(numericValue)
}
