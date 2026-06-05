import gears from '@/utils/gear.js'
import { statIndex } from '@/features/gear-score/data.js'

export function encodeShareState({ gearType, pieceType, statType, statInput }) {
  const gearNum = Object.keys(gears).reverse().indexOf(gearType).toString().padStart(2, '0')
  const pieceNum = Object.keys(gears[gearType]).indexOf(pieceType)
  const statNums = []

  statType.forEach((stat) => {
    statNums.push(statIndex.indexOf(stat).toString().padStart(2, '0'))
  })

  for (let i = 0; i < 5; i++) {
    const encodedValue = Math.min(Math.round(Number(statInput[i]) * 10), 999999)
    statNums[i] = statNums[i] + encodedValue.toString().padStart(6, '0')
  }

  return gearNum + pieceNum + statNums.join('')
}

export function getShareParams({ itemString, enchantLevel, includeEnchantLevel }) {
  const params = new URLSearchParams({ it: itemString })
  if (includeEnchantLevel) {
    params.set('el', String(enchantLevel))
  }

  return params
}

export function parseShareState(value) {
  const gearName = Object.keys(gears).reverse()[parseInt(value.slice(0, 2))]
  const pieceName = Object.keys(gears[gearName])[parseInt(value.slice(2, 3))]
  const statNames = []
  const statValues = []

  for (let i = 3; i < 36; i += 8) {
    statNames.push(statIndex[parseInt(value.slice(i, i + 2))])
  }
  for (let i = 5; i < 42; i += 8) {
    statValues.push(parseInt(value.slice(i, i + 6)) / 10)
  }

  if (
    !Object.keys(gears).includes(gearName) ||
    !Object.keys(gears[gearName]).includes(pieceName) ||
    statNames.map((item) => statIndex.includes(item)).includes(false) ||
    statValues.map((item) => item < 100000 && item >= 0).includes(false)
  ) {
    throw new Error('Invalid item string')
  }

  return {
    gearName,
    pieceName,
    statNames,
    statValues,
  }
}
