export const qualityTargetStorageKey = 'ltGearQualityTargetsV1'

export function getQualityTargetKey(gearType, pieceType) {
  return `${gearType}::${pieceType}`
}

export function readStoredQualityTargets() {
  try {
    const value = localStorage.getItem(qualityTargetStorageKey)
    return value ? sanitizeQualityTargets(JSON.parse(value)) : {}
  }
  catch (error) {
    console.error(error)
    return {}
  }
}

export function writeStoredQualityTargets(targets) {
  const sanitized = sanitizeQualityTargets(targets)
  localStorage.setItem(qualityTargetStorageKey, JSON.stringify(sanitized))
  return sanitized
}

export function sanitizeQualityTargets(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {}
  }

  return Object.fromEntries(Object.entries(value).flatMap(([key, target]) => {
    return typeof target === 'number' && Number.isFinite(target) && target >= 0 && target <= 100
      ? [[key, target]]
      : []
  }))
}
