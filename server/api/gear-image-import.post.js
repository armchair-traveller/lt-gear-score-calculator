import { createError, defineEventHandler, readMultipartFormData } from 'h3'
import gears from '@/utils/gear.js'

const imageImportModel = process.env.OPENAI_IMAGE_IMPORT_MODEL || 'gpt-5.4-mini'
const maxImageBytes = 8 * 1024 * 1024
const allowedImageTypes = new Set(['image/png', 'image/jpeg', 'image/webp'])
const otherStat = 'Other (Non-damaging)'
const healthStats = ['Stamina', 'Maximum HP %', 'Maximum HP']

const statAliases = new Map([
  ['attack elemental intensity', 'Attack/Intensity'],
  ['attack element intensity', 'Attack/Intensity'],
  ['attack intensity', 'Attack/Intensity'],
  ['elemental intensity', 'Attack/Intensity'],
  ['element intensity', 'Attack/Intensity'],
  ['atk elemental intensity', 'Attack/Intensity'],
  ['atk intensity', 'Attack/Intensity'],
  ['attack elemental intensity percent', 'Attack/Intensity %'],
  ['attack intensity percent', 'Attack/Intensity %'],
  ['elemental intensity percent', 'Attack/Intensity %'],
  ['normal damage amplification', 'Normal Amplification'],
  ['normal dmg amplification', 'Normal Amplification'],
  ['normal amplification', 'Normal Amplification'],
  ['boss damage amplification', 'Boss Amplification'],
  ['boss dmg amplification', 'Boss Amplification'],
  ['boss amplification', 'Boss Amplification'],
  ['dual critical damage', 'Critical Damage'],
  ['critical damage', 'Critical Damage'],
  ['crit damage', 'Critical Damage'],
  ['dual accuracy', 'Accuracy'],
  ['accuracy', 'Accuracy'],
  ['dual damage', 'Dual Damage'],
  ['max damage', 'Maximum Damage'],
  ['maximum damage', 'Maximum Damage'],
  ['min damage', 'Minimum Damage'],
  ['minimum damage', 'Minimum Damage'],
  ['back attack damage', 'Back Attack Damage'],
  ['basic stat', 'Basic Stats'],
  ['basic stats', 'Basic Stats'],
  ['basic stat percent', 'Basic Stats %'],
  ['basic stats percent', 'Basic Stats %'],
  ['strength magic', 'Strength/Magic'],
  ['str magic', 'Strength/Magic'],
  ['strength magic percent', 'Strength/Magic %'],
  ['str magic percent', 'Strength/Magic %'],
  ['boss added damage', 'Boss Added Damage'],
  ['normal added damage', 'Normal Added Damage'],
  ['static damage percent', 'Static Damage %'],
  ['static damage', 'Static Damage'],
  ['defense penetration', 'Defense Penetration'],
  ['movement speed', 'Movement Speed'],
  ['move speed', 'Movement Speed'],
  ['speed', 'Movement Speed'],
  ['cooldown reduction', 'Cooldown Reduction'],
  ['maximum hp percent', 'Maximum HP %'],
  ['max hp percent', 'Maximum HP %'],
  ['maximum hp', 'Maximum HP'],
  ['max hp', 'Maximum HP'],
  ['stamina', 'Stamina'],
])

const nonOffensivePatterns = [
  'defense',
  'static defense',
  'physical defense',
  'magic defense',
  'resistance',
  'evasion',
  'guard',
  'shield',
  'item drop',
  'ely',
  'exp',
  'skill level',
  'novice skill',
  'awakening',
]

export default defineEventHandler(async (event) => {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    throw createError({
      statusCode: 500,
      statusMessage: 'OPENAI_API_KEY is not configured.',
    })
  }

  const parts = await readMultipartFormData(event)
  const fields = getMultipartFields(parts)
  const image = fields.image

  if (!image?.data?.length) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Upload an equipment screenshot image.',
    })
  }

  if (!allowedImageTypes.has(image.type)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Use a PNG, JPEG, or WebP image.',
    })
  }

  if (image.data.length > maxImageBytes) {
    throw createError({
      statusCode: 413,
      statusMessage: 'Image must be smaller than 8 MB.',
    })
  }

  const fallbackGearType = getValidGearType(fields.gearType?.value) || '[9999] Armor'
  const fallbackPieceType =
    getValidPieceType(fallbackGearType, fields.pieceType?.value) || getPieceNames(fallbackGearType)[0]
  const imageUrl = `data:${image.type};base64,${Buffer.from(image.data).toString('base64')}`
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: imageImportModel,
      store: false,
      reasoning: { effort: 'low' },
      input: [
        {
          role: 'developer',
          content: [
            {
              type: 'input_text',
              text: getExtractorPrompt(),
            },
          ],
        },
        {
          role: 'user',
          content: [
            {
              type: 'input_text',
              text: getRequestContext(fallbackGearType, fallbackPieceType),
            },
            {
              type: 'input_image',
              image_url: imageUrl,
              detail: 'high',
            },
          ],
        },
      ],
      text: {
        verbosity: 'low',
        format: {
          type: 'json_schema',
          name: 'gear_image_import',
          strict: true,
          schema: getExtractorSchema(),
        },
      },
    }),
  })

  const payload = await response.json().catch(() => null)
  if (!response.ok) {
    throw createError({
      statusCode: response.status,
      statusMessage: payload?.error?.message || 'Could not read the uploaded image.',
    })
  }

  const extracted = parseOutput(payload)
  return normalizeExtraction(extracted, fallbackGearType, fallbackPieceType)
})

function getMultipartFields(parts = []) {
  return parts.reduce((fields, part) => {
    if (!part.name) {
      return fields
    }

    fields[part.name] = part.filename
      ? {
          data: part.data,
          type: part.type || 'application/octet-stream',
          filename: part.filename,
        }
      : { value: String(part.data || '') }

    return fields
  }, {})
}

function getExtractorPrompt() {
  return [
    'Extract LaTale gear enchant option lines from the image.',
    'Return only visible enchant option lines, usually formatted like "Lv. 5 Stat Name +123 [74%]".',
    'Ignore base item stats, durability, enchant limit, seals, awakening lines, titles, and unrelated UI text.',
    'If the full equipment tooltip is visible, infer the gear category and piece from title, required level, and piece wording.',
    'Use the provided fallback gear category and piece only when the screenshot does not show the equipment identity.',
    'Use exactly one of the allowed gear categories and piece names from the request context.',
    'Keep the raw visible stat wording in statText even when translated differently.',
    'For unenchanted placeholder lines like "Lv. 1 Strength / Magic +1", set ignored true with ignoreReason "Unenchanted placeholder".',
    'For all other enchant lines, set ignored false.',
  ].join('\n')
}

function getRequestContext(fallbackGearType, fallbackPieceType) {
  return JSON.stringify({
    fallbackGearType,
    fallbackPieceType,
    allowedGear: Object.entries(gears).map(([gearType, pieces]) => ({
      gearType,
      pieces: getPieceNames(gearType),
    })),
  })
}

function getExtractorSchema() {
  return {
    type: 'object',
    additionalProperties: false,
    required: ['gearType', 'pieceType', 'confidence', 'lines'],
    properties: {
      gearType: {
        type: 'string',
        enum: Object.keys(gears),
      },
      pieceType: {
        type: 'string',
        enum: getAllPieceNames(),
      },
      confidence: {
        type: 'number',
        minimum: 0,
        maximum: 1,
      },
      lines: {
        type: 'array',
        maxItems: 8,
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['rawText', 'level', 'statText', 'value', 'rollPercent', 'ignored', 'ignoreReason'],
          properties: {
            rawText: {
              type: 'string',
            },
            level: {
              type: 'integer',
              minimum: 0,
              maximum: 5,
            },
            statText: {
              type: 'string',
            },
            value: {
              type: 'number',
            },
            rollPercent: {
              type: 'number',
              minimum: 0,
              maximum: 100,
            },
            ignored: {
              type: 'boolean',
            },
            ignoreReason: {
              type: 'string',
            },
          },
        },
      },
    },
  }
}

function parseOutput(payload) {
  const outputText =
    payload?.output_text ||
    payload?.output?.flatMap((item) => item.content || [])?.find((content) => content.type === 'output_text')?.text

  if (!outputText) {
    throw createError({
      statusCode: 502,
      statusMessage: 'The image parser did not return readable results.',
    })
  }

  try {
    return JSON.parse(outputText)
  } catch {
    throw createError({
      statusCode: 502,
      statusMessage: 'The image parser returned invalid results.',
    })
  }
}

function normalizeExtraction(extracted, fallbackGearType, fallbackPieceType) {
  const { gearType, pieceType } = resolveExtractionEquipment(extracted, fallbackGearType, fallbackPieceType)
  const item = gears[gearType]?.[pieceType]
  const lines = (Array.isArray(extracted.lines) ? extracted.lines : [])
    .slice(0, 5)
    .map((line, index) => normalizeLine(line, item, index))

  return {
    gearType,
    pieceType,
    confidence: clampNumber(extracted.confidence, 0, 1),
    inputEnchantLevel: getImportEnchantLevel(lines),
    lines,
  }
}

function resolveExtractionEquipment(extracted, fallbackGearType, fallbackPieceType) {
  const extractedGearType = getValidGearType(extracted?.gearType)
  const fallbackPieceForFallbackGear =
    getValidPieceType(fallbackGearType, fallbackPieceType) || getPieceNames(fallbackGearType)[0]

  if (!extractedGearType) {
    return {
      gearType: fallbackGearType,
      pieceType: fallbackPieceForFallbackGear,
    }
  }

  const extractedPieceType = getValidPieceType(extractedGearType, extracted?.pieceType)
  if (extractedPieceType) {
    return {
      gearType: extractedGearType,
      pieceType: extractedPieceType,
    }
  }

  return {
    gearType: extractedGearType,
    pieceType: extractedGearType === fallbackGearType
      ? fallbackPieceForFallbackGear
      : getPieceNames(extractedGearType)[0],
  }
}

function normalizeLine(line, item, index) {
  const rawText = String(line?.rawText || '').trim()
  const detectedStat = String(line?.statText || '').trim()
  const value = normalizeNumber(line?.value)
  const rollPercent = normalizeNumber(line?.rollPercent)
  const level = Math.max(0, Math.min(5, parseInt(line?.level) || 0))
  const stat = normalizeStat(detectedStat || rawText, item, rawText)
  const unenchantedPlaceholder = level <= 1 && (value <= 1 || rollPercent === 1)
  const ignored = Boolean(line?.ignored) || unenchantedPlaceholder
  const validStat = stat && item?.Stats?.[stat]
  const finalValue = stat === otherStat ? 1 : value
  const status = ignored
    ? 'ignored'
    : validStat && finalValue > 0
      ? stat === otherStat
        ? 'other'
        : 'matched'
      : 'needs_review'

  return {
    id: `line-${index}`,
    rawText,
    level,
    detectedStat,
    stat: validStat ? stat : '',
    value: validStat ? finalValue : 0,
    rollPercent,
    ignored,
    status,
    reason: getLineReason({
      ignored,
      unenchantedPlaceholder,
      providedReason: line?.ignoreReason,
      stat,
      validStat,
    }),
  }
}

function normalizeStat(statText, item, rawText = '') {
  const options = Object.keys(item?.Stats || {})
  const key = canonicalizeStat(statText)
  const rawKey = canonicalizeStat(rawText)
  const statValueIsPercent = hasPercentStatValue(statText) || hasPercentStatValue(rawText)

  if (!key) {
    return ''
  }

  if (isHealthStat(key) || isHealthStat(rawKey)) {
    const healthStat = healthStats.find((stat) =>
      options.includes(stat) &&
      key === canonicalizeStat(getPreferredPercentStat(stat, options, statValueIsPercent)),
    )
    if (healthStat) {
      return getPreferredPercentStat(healthStat, options, statValueIsPercent)
    }
  }

  const aliasedStat = statAliases.get(key)
  const preferredAliasedStat = getPreferredPercentStat(aliasedStat, options, statValueIsPercent)
  if (preferredAliasedStat && options.includes(preferredAliasedStat) && !isNonOffensiveStat(key, preferredAliasedStat)) {
    return preferredAliasedStat
  }

  const exactStat = options.find((stat) => canonicalizeStat(stat) === key)
  const preferredExactStat = getPreferredPercentStat(exactStat, options, statValueIsPercent)
  if (preferredExactStat && !isNonOffensiveStat(key, preferredExactStat)) {
    return preferredExactStat
  }

  const containsStat = options.find((stat) => {
    const optionKey = canonicalizeStat(stat)
    return key.includes(optionKey) || optionKey.includes(key)
  })

  const preferredContainsStat = getPreferredPercentStat(containsStat, options, statValueIsPercent)
  if (preferredContainsStat && !isNonOffensiveStat(key, preferredContainsStat)) {
    return preferredContainsStat
  }

  return options.includes(otherStat) ? otherStat : ''
}

function getPreferredPercentStat(stat, options, statValueIsPercent) {
  if (!stat || !statValueIsPercent || stat.endsWith('%')) {
    return stat
  }

  const candidates = [`${stat} %`]
  if (stat.endsWith(' Damage')) {
    candidates.push(`${stat.replace(/ Damage$/, '')} %`)
  }

  return candidates.find((candidate) => options.includes(candidate)) || stat
}

function canonicalizeStat(value) {
  return String(value || '')
    .toLowerCase()
    .replaceAll('%', ' percent ')
    .replaceAll('&', ' and ')
    .replace(/\bdual\b/g, '')
    .replace(/\bonly\b/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function hasPercentStatValue(value) {
  const textWithoutRoll = String(value || '').replace(/\[[^\]]*]/g, ' ')
  return /(?:^|[^\w])\+?\s*\d+(?:[.,]\d+)?\s*(?:%|\bpercent\b)/i.test(textWithoutRoll)
}

function isHealthStat(key) {
  return key.includes('stamina') || key.includes('hp') || key.includes('health')
}

function isNonOffensiveStat(key, stat) {
  if (healthStats.includes(stat)) {
    return false
  }

  return nonOffensivePatterns.some((pattern) => key.includes(pattern))
}

function getLineReason({ ignored, unenchantedPlaceholder, providedReason, stat, validStat }) {
  if (unenchantedPlaceholder) {
    return 'Unenchanted placeholder'
  }

  if (ignored) {
    return providedReason || 'Ignored by parser'
  }

  if (!validStat) {
    return 'Choose a matching stat or ignore this line'
  }

  if (stat === otherStat) {
    return 'Mapped to non-damaging option'
  }

  return 'Ready to apply'
}

function getImportEnchantLevel(lines) {
  const levels = lines
    .filter((line) => !line.ignored && line.value > 0)
    .map((line) => line.level)
    .filter((level) => Number.isFinite(level) && level > 0)

  return levels.length ? Math.max(...levels) : 2
}

function getValidGearType(gearType) {
  return Object.keys(gears).includes(gearType) ? gearType : ''
}

function getValidPieceType(gearType, pieceType) {
  return getPieceNames(gearType).includes(pieceType) ? pieceType : ''
}

function getPieceNames(gearType) {
  return Object.keys(gears[gearType] || {}).filter((key) => !['Sheet Link', 'Potential'].includes(key))
}

function getAllPieceNames() {
  return Array.from(new Set(Object.keys(gears).flatMap(getPieceNames)))
}

function normalizeNumber(value) {
  const number = Number(value)
  return Number.isFinite(number) ? number : 0
}

function clampNumber(value, min, max) {
  const number = normalizeNumber(value)
  return Math.min(Math.max(number, min), max)
}
