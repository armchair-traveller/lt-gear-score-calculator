export const gearPlanSlots = [
  { gearType: '[9999] Armor', pieceType: 'Helmet', upgradeCount: 3 },
  { gearType: '[9999] Armor', pieceType: 'Chestplate', upgradeCount: 3 },
  { gearType: '[9999] Armor', pieceType: 'Fauld', upgradeCount: 3 },
  { gearType: '[9999] Armor', pieceType: 'Gloves', upgradeCount: 3 },
  { gearType: '[9999] Armor', pieceType: 'Boots', upgradeCount: 3 },
  { gearType: '[9999] Badge 6', pieceType: 'Badge', upgradeCount: 0 },
  { gearType: '[9000] Accessories', pieceType: 'Crystal', upgradeCount: 2 },
  { gearType: '[9000] Accessories', pieceType: 'Glasses', upgradeCount: 2 },
  { gearType: '[9000] Accessories', pieceType: 'Stockings', upgradeCount: 2 },
  { gearType: '[8000] Weapons', pieceType: 'Weapon', upgradeCount: 2 },
  { gearType: '[8000] Weapons', pieceType: 'Stone', upgradeCount: 2 },
  { gearType: '[sLv5] Accessories', pieceType: 'Cloak', upgradeCount: 3 },
  { gearType: '[sLv5] Accessories', pieceType: 'Earrings', upgradeCount: 3 },
  { gearType: '[sLv5] Accessories', pieceType: 'Ring', upgradeCount: 3 },
]

export const gearPlanStorageKey = 'ltGearPlanV1'
export const gearPlanShareVersion = '1'

export function getGearPlanSlotId(gearType, pieceType) {
  return `${gearType}::${pieceType}`
}

export function getGearPlanSlot(gearType, pieceType) {
  return gearPlanSlots.find((slot) =>
    slot.gearType === gearType && slot.pieceType === pieceType,
  )
}

export function isGearPlanSlot(gearType, pieceType) {
  return Boolean(getGearPlanSlot(gearType, pieceType))
}
