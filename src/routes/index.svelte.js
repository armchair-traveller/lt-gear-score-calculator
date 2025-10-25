// todo:
// add new columns on your % table for additional enchant maxes
import { gearNormal } from '$lib/data/gear.js'
import { gearMin } from '$lib/data/gearMin.js'
import { tiers } from '$lib/data/tiers.js'

export class CalculatorState {
  selectedType = $state('')
  selectedPiece = $state('')
  selectedStats = $state(['', '', '', '', ''])
  statValues = $state(['', '', '', '', ''])

  gear = $derived(gearNormal)
  typeAvailable = $derived(Object.keys(this.gear))

  piecesAvailable = $derived.by(() => {
    if (!this.selectedType || !this.gear[this.selectedType]) return []
    const pieces = Object.keys(this.gear[this.selectedType])
    pieces.pop() // Remove 'Sheet Link'
    pieces.pop() // Remove 'Potential'
    return pieces
  })

  typeLink = $derived(
    this.selectedType && this.gear[this.selectedType] ? this.gear[this.selectedType]['Sheet Link'] : ''
  )

  statAvailable = $derived.by(() => {
    if (!this.selectedType || !this.selectedPiece || !this.gear[this.selectedType]?.[this.selectedPiece]?.['Stats'])
      return []
    return Object.keys(this.gear[this.selectedType][this.selectedPiece]['Stats'])
  })

  maxDI = $derived(
    this.selectedType && this.selectedPiece && this.gear[this.selectedType]?.[this.selectedPiece]
      ? this.gear[this.selectedType][this.selectedPiece]['DI']
      : 0
  )

  tierType = $derived(
    this.selectedType && this.selectedPiece && this.gear[this.selectedType]?.[this.selectedPiece]
      ? this.gear[this.selectedType][this.selectedPiece]['Type']
      : ''
  )

  tierEquivalence = $derived(
    this.selectedType && this.tierType && tiers[this.selectedType]?.[this.tierType]
      ? tiers[this.selectedType][this.tierType]
      : {}
  )

  tierAvailable = $derived(Object.keys(this.tierEquivalence))

  totalDI = $derived.by(() => {
    let sum = 0
    for (let i = 0; i < 5; i++) {
      const statType = this.selectedStats[i]
      const statValue = parseFloat(this.statValues[i]) || 0
      if (!statType || !this.selectedType || !this.selectedPiece) continue

      const stats = this.gear[this.selectedType]?.[this.selectedPiece]?.['Stats']
      if (!stats?.[statType]) continue

      const maxValue = stats[statType]['Value']
      const maxDI = stats[statType]['DI']
      const result = (statValue / maxValue) * maxDI
      sum += result
    }
    return sum
  })

  potentialGains = $derived.by(() => {
    let min = 0
    let max = 0

    for (let i = 0; i < 5; i++) {
      const statType = this.selectedStats[i]
      const statValue = this.statValues[i]
      if (!statType || !this.selectedType || !this.selectedPiece || statValue === '') continue

      const stats = this.gear[this.selectedType]?.[this.selectedPiece]?.['Stats']
      if (!stats?.[statType]) continue

      const maxValue = stats[statType]['Value']
      const maxDI = stats[statType]['DI']
      const potential = stats[statType]['Potential']

      if (potential) {
        min += (potential[0] / maxValue) * maxDI
        max += (potential[1] / maxValue) * maxDI
      }
    }

    return { min, max }
  })

  itemDI = $derived(this.maxDI ? parseInt((this.totalDI / this.maxDI) * 100) : 0)

  finalTier = $derived.by(() => {
    let tier = 'F'
    this.tierAvailable.forEach((e) => {
      if (this.itemDI >= parseInt(this.tierEquivalence[e]['Penta'])) {
        tier = e
      }
    })
    return tier
  })

  potentialScores = $derived.by(() => {
    const min = this.maxDI ? parseInt(((this.potentialGains.min * 2 + this.totalDI) / this.maxDI) * 100) : 0
    const max = this.maxDI ? parseInt(((this.potentialGains.max * 2 + this.totalDI) / this.maxDI) * 100) : 0

    let tierMin = 'F'
    let tierMax = 'F'

    this.tierAvailable.forEach((e) => {
      if (min >= parseInt(this.tierEquivalence[e]['Penta'])) {
        tierMin = e
      }
      if (max >= parseInt(this.tierEquivalence[e]['Penta'])) {
        tierMax = e
      }
    })

    return { min, max, tierMin, tierMax }
  })

  statDetails = $derived.by(() => {
    const details = []
    let limitDI = 0

    for (let i = 0; i < 5; i++) {
      const statType = this.selectedStats[i]
      const statValue = parseFloat(this.statValues[i]) || 0
      if (!statType || !this.selectedType || !this.selectedPiece) continue

      const stats = this.gear[this.selectedType]?.[this.selectedPiece]?.['Stats']
      if (!stats?.[statType]) continue

      const maxValue = stats[statType]['Value']
      const maxDI = stats[statType]['DI']
      const currPerc = statValue / maxValue
      const currDI = currPerc * maxDI

      let tier = 'F'
      this.tierAvailable.forEach((e) => {
        if (parseInt(currPerc * 100) >= parseInt(this.tierEquivalence[e]['Penta'])) {
          tier = e
        }
      })

      const addVal =
        i === 4 && (this.selectedType === '[6000] Armor' || this.selectedType === '[7000] Accessories') ? 0.8 : 1

      details.push({
        stat: statType,
        maxValue,
        percentage: parseInt(currPerc * 100),
        tier,
        currentDI: currDI,
        maxDI: maxDI * addVal,
      })

      limitDI += maxDI * addVal
    }

    let limitTier = 'F'
    this.tierAvailable.forEach((e) => {
      if (this.maxDI && parseInt((limitDI / this.maxDI) * 100) >= parseInt(this.tierEquivalence[e]['Penta'])) {
        limitTier = e
      }
    })

    return {
      details,
      limitDI,
      limitTier,
      limitScore: this.maxDI ? (limitDI / this.maxDI) * 100 : 0,
    }
  })

  priorityStats = $derived.by(() => {
    if (!this.selectedType || !this.selectedPiece) return []

    const pieceStats = this.gear[this.selectedType]?.[this.selectedPiece]?.['Stats']
    if (!pieceStats) return []

    const ordered = []
    Object.keys(pieceStats).forEach((e) => {
      ordered.push({
        Stat: e,
        DI: pieceStats[e]['DI'],
        Value: pieceStats[e]['Value'],
      })
    })

    ordered.sort((a, b) => b['DI'] - a['DI'])
    return ordered
  })

  recommendedStats = $derived.by(() => {
    if (!this.selectedType) return []

    const pieces = Object.keys(this.gear[this.selectedType])
    pieces.pop() // Remove 'Sheet Link'
    pieces.pop() // Remove 'Potential'

    const statsList = []
    pieces.forEach((piece) => {
      const stats = Object.keys(this.gear[this.selectedType][piece]['Stats']).slice(0, 5)
      statsList.push({ piece, stats })
    })

    return statsList
  })

  init = () => {
    if (this.typeAvailable.length > 0) {
      this.selectedType = this.typeAvailable[0]
      if (this.piecesAvailable.length > 0) {
        this.selectedPiece = this.piecesAvailable[0]
      }
      this.updateStatDefaults()
    }
  }

  updateType = (type) => {
    this.selectedType = type
    if (this.piecesAvailable.length > 0) {
      this.selectedPiece = this.piecesAvailable[0]
    }
    this.updateStatDefaults()
  }

  updatePiece = (piece) => {
    this.selectedPiece = piece
    this.updateStatDefaults()
  }

  updateStatDefaults = () => {
    if (this.statAvailable.length > 0) {
      this.selectedStats = this.statAvailable.slice(0, 5)
      while (this.selectedStats.length < 5) {
        this.selectedStats.push('')
      }
    }
  }

  updateStat = (index, stat) => {
    this.selectedStats[index] = stat
  }

  updateStatValue = (index, value) => {
    this.statValues[index] = value
  }

  updateValues = (enchants, value) => {
    for (let i = 0; i < 5; i++) {
      const statType = this.selectedStats[i]
      if (!statType || !this.selectedType || !this.selectedPiece) continue

      const stats = this.gear[this.selectedType]?.[this.selectedPiece]?.['Stats']
      if (!stats?.[statType]) continue

      const maxValue = stats[statType]['Value']

      if (enchants >= i + 1) {
        this.statValues[i] = ['Normal Amp', 'Boss Amp', 'Cooldown Reduction'].includes(statType)
          ? ((value * maxValue) / 100).toFixed(1)
          : String(parseInt((value * maxValue) / 100))
      } else {
        this.statValues[i] = ''
      }
    }
  }
}
