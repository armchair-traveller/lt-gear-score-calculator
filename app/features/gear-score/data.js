export const decimalStats = ['Normal Amplification', 'Boss Amplification', 'Cooldown Reduction']

export const repeatableStats = ['Other (Non-damaging)']

export const qualityOddsGearTypes = ['[sLv5] Accessories', '[9999] Armor', '[9000] Accessories', '[8000] Weapons']

export const inputEnchantGearTypes = ['[sLv5] Accessories', '[9999] Armor', '[9000] Accessories', '[8000] Weapons']

export const defaultOddsEnchantMethod = 'standard'

export const oddsEnchantMethods = {
  standard: {
    value: 'standard',
    label: 'Super',
    successRate: 0.6,
  },
  special: {
    value: 'special',
    label: 'Special',
    successRate: 1,
  },
}

export function supportsSpecialOddsEnchant(gearType) {
  return /^\[sLv\d+\]/i.test(gearType)
}

export function getOddsEnchantMethodOptions(gearType) {
  return supportsSpecialOddsEnchant(gearType)
    ? Object.values(oddsEnchantMethods)
    : [oddsEnchantMethods.standard]
}

export function getOddsEnchantMethod(gearType, method) {
  const selected = oddsEnchantMethods[method]

  if (!selected || (selected.value === 'special' && !supportsSpecialOddsEnchant(gearType))) {
    return oddsEnchantMethods[defaultOddsEnchantMethod]
  }

  return selected
}

export const ratingScale = 1000

export const tierGuideRows = [
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

export const traitCatalog = [
  {
    id: 'back',
    image: 'Note_Back.png',
    label: 'Back attack',
    text: 'Back Attack Damage only works with direct damage and asks for reliable positioning.',
    appliesTo: ['Back Attack Damage'],
    test: (stats) => stats.includes('Back Attack Damage'),
  },
  {
    id: 'penetration',
    image: 'Note_Penetration.png',
    label: 'Penetration',
    text: 'Defense Penetration does not function with summons and depends on your status-window penetration.',
    appliesTo: ['Defense Penetration'],
    test: (stats) => stats.includes('Defense Penetration'),
  },
  {
    id: 'attack',
    image: 'Note_Attack.png',
    label: 'Attack',
    text: 'Multiple Attack/Intensity lines usually favor direct-hit classes.',
    appliesTo: ['Attack/Intensity', 'Attack/Intensity %'],
    test: (stats) => stats.includes('Attack/Intensity') + stats.includes('Attack/Intensity %') > 1,
  },
  {
    id: 'strength',
    image: 'Note_Strength.png',
    label: 'Strength',
    text: 'Multiple Strength/Magic lines usually favor summon-heavy classes.',
    appliesTo: ['Basic Stats %', 'Strength/Magic', 'Basic Stats'],
    test: (stats) =>
      stats.includes('Basic Stats %') + stats.includes('Strength/Magic') + stats.includes('Basic Stats') > 1,
  },
  {
    id: 'minimum',
    image: 'Note_Minimum.png',
    label: 'Minimum',
    text: 'Minimum Damage only helps while your minimum damage is below your maximum damage.',
    appliesTo: ['Minimum Damage'],
    test: (stats) => stats.includes('Minimum Damage'),
  },
  {
    id: 'hp',
    image: 'Note_HP.png',
    label: 'HP',
    text: 'HP and stamina lines add survivability but no offensive score.',
    appliesTo: ['Maximum HP %', 'Basic Stats', 'Basic Stats %', 'Stamina'],
    test: (stats) =>
      stats.includes('Maximum HP %') ||
      stats.includes('Basic Stats') ||
      stats.includes('Basic Stats %') ||
      stats.includes('Stamina'),
  },
]

export const recommendedOptionGuide = {
  '[sLv5] Accessories': {
    Cloak: {
      main: ['Critical Damage', 'Basic Stats %', 'Attack/Intensity'],
      secondary: ['Minimum Damage', 'Basic Stats', 'Strength/Magic', 'Back Attack Damage'],
    },
    Earrings: {
      main: ['Critical Damage', 'Maximum Damage'],
      secondary: ['Minimum Damage', 'Attack/Intensity', 'Basic Stats', 'Strength/Magic', 'Back Attack Damage'],
    },
    Ring: {
      main: ['Maximum Damage', 'Attack/Intensity %'],
      secondary: ['Minimum Damage', 'Attack/Intensity', 'Cooldown Reduction', 'Basic Stats', 'Strength/Magic', 'Back Attack Damage'],
    },
  },
  '[8000] Weapons': {
    Weapon: {
      main: ['Critical Damage', 'Maximum Damage', 'Minimum Damage', 'Attack/Intensity %', 'Basic Stats %'],
      secondary: ['Attack/Intensity', 'Basic Stats', 'Strength/Magic', 'Back Attack Damage'],
    },
    Stone: {
      main: ['Maximum Damage', 'Minimum Damage', 'Strength/Magic %'],
      secondary: ['Attack/Intensity', 'Basic Stats', 'Strength/Magic', 'Back Attack Damage'],
    },
  },
  '[9999] Armor': {
    Helmet: {
      main: ['Critical Damage', 'Accuracy'],
      secondary: ['Attack/Intensity', 'Basic Stats', 'Strength/Magic', 'Normal Amplification', 'Minimum Damage', 'Back Attack Damage'],
    },
    Chestplate: {
      main: ['Attack/Intensity %', 'Basic Stats %'],
      secondary: ['Maximum Damage', 'Minimum Damage', 'Attack/Intensity', 'Basic Stats', 'Strength/Magic', 'Back Attack Damage'],
    },
    Fauld: {
      main: ['Attack/Intensity %', 'Basic Stats %'],
      secondary: ['Maximum Damage', 'Minimum Damage', 'Attack/Intensity', 'Basic Stats', 'Strength/Magic', 'Back Attack Damage'],
    },
    Gloves: {
      main: ['Attack/Intensity %', 'Critical Damage', 'Boss Amplification'],
      secondary: ['Minimum Damage', 'Attack/Intensity', 'Basic Stats', 'Strength/Magic', 'Back Attack Damage'],
    },
    Boots: {
      main: ['Critical Damage', 'Basic Stats %'],
      secondary: ['Movement Speed', 'Minimum Damage', 'Attack/Intensity', 'Basic Stats', 'Strength/Magic', 'Back Attack Damage'],
    },
  },
  '[9000] Accessories': {
    Glasses: {
      main: ['Accuracy', 'Maximum Damage', 'Attack/Intensity %'],
      secondary: ['Minimum Damage', 'Attack/Intensity', 'Basic Stats', 'Strength/Magic', 'Back Attack Damage'],
    },
    Crystal: {
      main: ['Critical Damage', 'Basic Stats %', 'Boss Amplification'],
      secondary: ['Minimum Damage', 'Attack/Intensity', 'Basic Stats', 'Strength/Magic', 'Back Attack Damage'],
    },
    Stockings: {
      main: ['Dual Damage', 'Normal Amplification', 'Minimum Damage'],
      secondary: ['Attack/Intensity', 'Basic Stats', 'Strength/Magic', 'Movement Speed', 'Back Attack Damage'],
    },
  },
}

export const statIndex = [
  'Critical Damage', 'Normal Amplification', 'Basic Stats', 'Attack/Intensity', 'Accuracy', 'Strength/Magic',
  'Minimum Damage', 'Back Attack Damage', 'Static Damage %', 'Boss Added Damage', 'Normal Added Damage',
  'Stamina', 'Maximum HP %', 'Other (Non-damaging)', 'Maximum Damage', 'Basic Stats %', 'Attack/Intensity %',
  'Boss Amplification', 'Movement Speed', 'Static Damage', 'Normal Added %', 'Dual Damage', 'Defense Penetration',
  'Boss Added %', 'Strength/Magic %', 'Boss Added', 'Normal Added', 'Cooldown Reduction', 'Only Strength/Magic', 'Maximum HP',
]
