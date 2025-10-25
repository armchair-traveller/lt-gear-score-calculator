import { gearNormal } from '../data/gear.js'

/**
 * Extract available types from gear data
 */
export function getAvailableTypes() {
  const types = new Set()
  Object.keys(gearNormal).forEach((key) => {
    Object.keys(gearNormal[key]).forEach((subKey) => {
      if (subKey !== 'Sheet Link' && subKey !== 'Potential') {
        types.add(subKey)
      }
    })
  })
  return Array.from(types)
}

/**
 * Extract available pieces for a given type
 */
export function getAvailablePieces(type) {
  const pieces = new Set()
  Object.keys(gearNormal).forEach((key) => {
    if (gearNormal[key][type]) {
      pieces.add(key)
    }
  })
  return Array.from(pieces)
}

/**
 * Extract available stats for a given type and piece
 */
export function getAvailableStats(type, piece) {
  const gearPiece = gearNormal[piece]?.[type]
  if (!gearPiece || !gearPiece.Stats) {
    return []
  }
  return Object.keys(gearPiece.Stats)
}

/**
 * Simple fuzzy matching to find closest match from options
 * @param {boolean} preferPercentage - If true, prefer options ending with '%'
 */
function findClosestMatch(text, options, preferPercentage = false) {
  if (!text || !options || options.length === 0) {
    return null
  }

  const normalizedText = text.toLowerCase().trim()

  // If we need percentage, filter to only percentage options first
  let searchOptions = options
  if (preferPercentage) {
    const percentOptions = options.filter((opt) => opt.includes('%'))
    if (percentOptions.length > 0) {
      searchOptions = percentOptions
    }
  } else {
    // If we explicitly don't want percentage, filter them out
    const nonPercentOptions = options.filter((opt) => !opt.includes('%'))
    if (nonPercentOptions.length > 0) {
      searchOptions = nonPercentOptions
    }
  }

  // First try exact match
  const exactMatch = searchOptions.find((opt) => opt.toLowerCase() === normalizedText)
  if (exactMatch) {
    return exactMatch
  }

  // Then try partial match (option contains text or text contains option)
  const partialMatch = searchOptions.find(
    (opt) => opt.toLowerCase().includes(normalizedText) || normalizedText.includes(opt.toLowerCase())
  )
  if (partialMatch) {
    return partialMatch
  }

  // Finally, use simple Levenshtein-like scoring
  let bestMatch = searchOptions[0]
  let bestScore = 0

  searchOptions.forEach((opt) => {
    const score = similarity(normalizedText, opt.toLowerCase())
    if (score > bestScore) {
      bestScore = score
      bestMatch = opt
    }
  })

  return bestScore > 0.3 ? bestMatch : searchOptions[0] // Return best match if confidence > 30%, else first option
}

/**
 * Calculate string similarity (0-1)
 */
function similarity(s1, s2) {
  let longer = s1
  let shorter = s2
  if (s1.length < s2.length) {
    longer = s2
    shorter = s1
  }
  const longerLength = longer.length
  if (longerLength === 0) {
    return 1.0
  }
  return (longerLength - editDistance(longer, shorter)) / parseFloat(longerLength)
}

/**o
 * Calculate edit distance between two strings
 */
function editDistance(s1, s2) {
  s1 = s1.toLowerCase()
  s2 = s2.toLowerCase()

  const costs = []
  for (let i = 0; i <= s1.length; i++) {
    let lastValue = i
    for (let j = 0; j <= s2.length; j++) {
      if (i === 0) costs[j] = j
      else {
        if (j > 0) {
          let newValue = costs[j - 1]
          if (s1.charAt(i - 1) !== s2.charAt(j - 1)) newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1
          costs[j - 1] = lastValue
          lastValue = newValue
        }
      }
    }
    if (i > 0) costs[s2.length] = lastValue
  }
  return costs[s2.length]
}

/**
 * Match extracted gear data to available options
 * Note: In the gear structure, the top-level keys are piece names like '[9999] Badge 6'
 * and sub-keys are equipment types like 'Badge', 'Weapon', etc.
 */
export function matchGearToOptions(extractedData) {
  const { type, piece, stats } = extractedData

  // type from extraction = equipment type like 'Badge'
  // piece from extraction = gear piece name like '[9999] Badge 6'

  // Get available equipment types (like 'Badge', 'Weapon', etc.)
  const availableTypes = getAvailableTypes()
  const matchedEquipmentType = findClosestMatch(type, availableTypes)

  // Get available pieces for this equipment type (like '[9999] Badge 6', etc.)
  const availablePieces = getAvailablePieces(matchedEquipmentType)
  const matchedPieceName = findClosestMatch(piece, availablePieces)

  // Get available stats for this combination
  const availableStats = getAvailableStats(matchedEquipmentType, matchedPieceName)

  // Match each stat
  const matchedStats = stats.map((statData) => {
    // Use the isPercentage flag to prefer matching to percentage or non-percentage stats
    const preferPercentage = statData.isPercentage === true
    const matchedStatName = findClosestMatch(statData.name, availableStats, preferPercentage)
    return {
      name: matchedStatName,
      value: statData.value || 0,
    }
  })

  // Return with keys matching the state structure:
  // - selectedType = piece name (top-level key)
  // - selectedPiece = equipment type (sub-key)
  return {
    selectedType: matchedPieceName, // e.g., '[9999] Badge 6'
    selectedPiece: matchedEquipmentType, // e.g., 'Badge'
    stats: matchedStats,
  }
}
