import sharp from 'sharp'
import gears from '../../app/utils/gear.js'
import {
  getExtractorPrompt,
  getExtractorSchema,
  getMaxEnchantLevel,
  getPieceNames,
  getRequestContext,
  getSemanticReviewRowNumbers,
  getSemanticVerificationPrompt,
  getSemanticVerificationRequestText,
  getSemanticVerificationRequests,
  getValidGearType,
  getValidPieceType,
  getValueReviewRowNumbers,
  getValueVerificationPrompt,
  getValueVerificationRequestText,
  getValueVerificationRequests,
  getValueVerificationSchema,
  mergeSemanticVerifiedLineReads,
  mergeVerifiedLineReads,
  normalizeExtraction,
} from './gear-image-import.js'

export const maxGearImageBytes = 8 * 1024 * 1024
export const maxGearImagePixels = 20_000_000
export const maxGearImageDimension = 8192
export const allowedGearImageTypes = new Set(['image/png', 'image/jpeg', 'image/webp'])

const defaultGearType = '[9999] Armor'
const defaultPieceType = 'Helmet'
const defaultPrimaryImageTargetShortSide = 512
const defaultPrimaryImageMaxScale = 3
const primaryImageTargetLongSide = 2048
const primaryImageTargetPixels = 2048 * 2048
const verificationImageTargetSize = 1900
const maxVerificationImageScale = 3
const defaultImportTimeout = 210_000
const imageFormatsByMimeType = {
  'image/png': 'png',
  'image/jpeg': 'jpeg',
  'image/webp': 'webp',
}

export class GearImageImportError extends Error {
  constructor(code, statusCode, message, options = {}) {
    super(message, options)
    this.name = 'GearImageImportError'
    this.code = code
    this.statusCode = statusCode
    this.details = options.details || null
  }
}

export async function importGearImage({
  buffer,
  mimeType,
  gearHint = null,
  safetyIdentifier = '',
  signal,
  timeoutMs = defaultImportTimeout,
  apiKey = process.env.OPENAI_API_KEY,
  fetchImpl = globalThis.fetch,
  gearCatalog = gears,
  importModel = process.env.OPENAI_IMAGE_IMPORT_MODEL || 'gpt-5.6-luna',
  importReasoningEffort =
    process.env.OPENAI_IMAGE_IMPORT_REASONING_EFFORT || 'low',
  verificationModel =
    process.env.OPENAI_IMAGE_IMPORT_VERIFICATION_MODEL || 'gpt-5.6-luna',
  verificationReasoningEffort =
    process.env.OPENAI_IMAGE_IMPORT_VERIFICATION_REASONING_EFFORT || 'none',
  semanticVerificationModel =
    process.env.OPENAI_IMAGE_IMPORT_SEMANTIC_VERIFICATION_MODEL || 'gpt-5.6-sol',
  semanticVerificationReasoningEffort =
    process.env.OPENAI_IMAGE_IMPORT_SEMANTIC_VERIFICATION_REASONING_EFFORT || 'none',
  enableValueVerification = true,
  enableSemanticVerification = getEnvironmentBoolean(
    process.env.OPENAI_IMAGE_IMPORT_SEMANTIC_VERIFICATION_ENABLED,
    true,
  ),
  enablePrimaryImageUpscale = getEnvironmentBoolean(
    process.env.OPENAI_IMAGE_IMPORT_PRIMARY_UPSCALE_ENABLED,
    true,
  ),
  primaryImageTargetShortSide =
    process.env.OPENAI_IMAGE_IMPORT_PRIMARY_TARGET_SHORT_SIDE
    || defaultPrimaryImageTargetShortSide,
  primaryImageMaxScale =
    process.env.OPENAI_IMAGE_IMPORT_PRIMARY_MAX_SCALE
    || defaultPrimaryImageMaxScale,
  trustPrimarySemanticReads = false,
  preferGearHint = false,
  throwOnVerificationError = false,
  onModelAttempt,
} = {}) {
  if (!apiKey) {
    throw new GearImageImportError(
      'api_key_missing',
      500,
      'OPENAI_API_KEY is not configured.',
    )
  }

  if (typeof fetchImpl !== 'function') {
    throw new GearImageImportError(
      'fetch_unavailable',
      500,
      'The image import service is unavailable.',
    )
  }

  const image = await validateGearImage({ buffer, mimeType })
  const hint = resolveGearHint(gearHint, gearCatalog)
  const parsingGearType = hint?.gearType || defaultGearType
  const parsingPieceType =
    hint?.pieceType
    || getValidPieceType(parsingGearType, defaultPieceType, gearCatalog)
    || getPieceNames(parsingGearType, gearCatalog)[0]
  const requestSignal = getRequestSignal(signal, timeoutMs)
  const originalImageUrl = toImageDataUrl(image.buffer, image.mimeType)
  const primaryImageUrl = await getPrimaryImageUrl(image, originalImageUrl, {
    enabled: enablePrimaryImageUpscale,
    targetShortSide: primaryImageTargetShortSide,
    maxScale: primaryImageMaxScale,
  })

  try {
    const modelExtraction = await requestImageModel({
      apiKey,
      imageUrl: primaryImageUrl,
      developerText: getExtractorPrompt(),
      userText: getRequestContext(
        parsingGearType,
        parsingPieceType,
        gearCatalog,
        { hintProvided: Boolean(hint) },
      ),
      formatName: 'gear_image_import',
      schema: getExtractorSchema(gearCatalog),
      model: importModel,
      reasoning: { effort: importReasoningEffort },
      verbosity: 'low',
      stage: 'primary',
      onModelAttempt,
      safetyIdentifier,
      signal: requestSignal,
      fetchImpl,
    })
    const extracted = trustPrimarySemanticReads
      ? markSemanticReadsTrusted(modelExtraction)
      : modelExtraction
    const normalizationOptions = {
      hintProvided: Boolean(hint),
      preferGearHint: Boolean(preferGearHint),
    }
    const normalized = normalizeExtraction(
      extracted,
      parsingGearType,
      parsingPieceType,
      gearCatalog,
      normalizationOptions,
    )
    const semanticReviewRowNumbers = getSemanticReviewRowNumbers(normalized)
    const reviewRowNumbers = getValueReviewRowNumbers(normalized)

    if (
      enableSemanticVerification
      && isSemanticVerificationEligible({
        normalized,
        reviewRowNumbers: semanticReviewRowNumbers,
        hint,
      })
    ) {
      const combinedReviewRowNumbers = Array.from(new Set([
        ...semanticReviewRowNumbers,
        ...(enableValueVerification ? reviewRowNumbers : []),
      ])).sort((left, right) => left - right)

      try {
        const verificationRequests = getSemanticVerificationRequests(
          combinedReviewRowNumbers,
        )
        const semanticImageUrl = await getSemanticImageUrl(image)
        if (!semanticImageUrl) {
          return normalized
        }
        const verification = await requestImageModel({
          apiKey,
          imageUrl: semanticImageUrl,
          model: semanticVerificationModel,
          reasoning: { effort: semanticVerificationReasoningEffort },
          verbosity: 'medium',
          stage: 'semantic_verification',
          onModelAttempt,
          developerText: getSemanticVerificationPrompt(),
          userText: getSemanticVerificationRequestText(verificationRequests),
          formatName: 'gear_image_semantic_verification',
          schema: getValueVerificationSchema(combinedReviewRowNumbers),
          safetyIdentifier,
          signal: requestSignal,
          fetchImpl,
        })
        const semanticallyVerifiedExtraction = mergeSemanticVerifiedLineReads(
          extracted,
          verification?.lines,
          semanticReviewRowNumbers,
        )
        const numericOnlyReviewRowNumbers = reviewRowNumbers.filter(
          rowNumber => !semanticReviewRowNumbers.includes(rowNumber),
        )
        const verifiedExtraction = mergeVerifiedLineReads(
          semanticallyVerifiedExtraction,
          verification?.lines,
          numericOnlyReviewRowNumbers,
        )

        return normalizeExtraction(
          verifiedExtraction,
          parsingGearType,
          parsingPieceType,
          gearCatalog,
          normalizationOptions,
        )
      }
      catch (error) {
        if (requestSignal?.aborted || throwOnVerificationError) {
          throw error
        }

        // Keep the safe review state when the independent re-read is unavailable.
        return normalized
      }
    }

    if (
      !enableValueVerification
      || !isValueVerificationEligible({
        normalized,
        reviewRowNumbers,
        hint,
      })
    ) {
      return normalized
    }

    try {
      const verificationRequests = getValueVerificationRequests(extracted, reviewRowNumbers)
      const verificationImageUrl = await getVerificationImageUrl(image, primaryImageUrl)
      const verification = await requestImageModel({
        apiKey,
        imageUrl: verificationImageUrl,
        model: verificationModel,
        reasoning: { effort: verificationReasoningEffort },
        verbosity: 'medium',
        stage: 'verification',
        onModelAttempt,
        developerText: getValueVerificationPrompt(),
        userText: getValueVerificationRequestText(verificationRequests),
        formatName: 'gear_image_value_verification',
        schema: getValueVerificationSchema(reviewRowNumbers),
        safetyIdentifier,
        signal: requestSignal,
        fetchImpl,
      })
      const verifiedExtraction = mergeVerifiedLineReads(
        extracted,
        verification?.lines,
        reviewRowNumbers,
      )
      const verifiedNormalized = normalizeExtraction(
        verifiedExtraction,
        parsingGearType,
        parsingPieceType,
        gearCatalog,
        normalizationOptions,
      )
      const improvedRowNumbers = reviewRowNumbers.filter((rowNumber) => {
        const originalLine = normalized.lines[rowNumber - 1]
        const verifiedLine = verifiedNormalized.lines[rowNumber - 1]
        return verifiedLine?.status === 'matched'
          && verifiedLine.stat === originalLine?.stat
          && verifiedLine.level === originalLine?.level
      })

      if (improvedRowNumbers.length) {
        return normalizeExtraction(
          mergeVerifiedLineReads(extracted, verification?.lines, improvedRowNumbers),
          parsingGearType,
          parsingPieceType,
          gearCatalog,
          normalizationOptions,
        )
      }
    }
    catch (error) {
      if (requestSignal?.aborted || throwOnVerificationError) {
        throw error
      }

      // Keep the original review state when the focused re-read is unavailable.
    }

    return normalized
  }
  catch (error) {
    if (error instanceof GearImageImportError) {
      throw error
    }

    if (requestSignal?.aborted) {
      throw new GearImageImportError(
        'import_timeout',
        504,
        'The equipment screenshot took too long to read. Try a tighter crop.',
        { cause: error },
      )
    }

    throw new GearImageImportError(
      'upstream_unavailable',
      502,
      'Could not read the uploaded image.',
      { cause: error },
    )
  }
}

export async function validateGearImage({ buffer, mimeType } = {}) {
  const imageBuffer = toBuffer(buffer)
  if (!imageBuffer?.length) {
    throw new GearImageImportError(
      'image_missing',
      400,
      'Upload an equipment screenshot image.',
    )
  }

  if (!allowedGearImageTypes.has(mimeType)) {
    throw new GearImageImportError(
      'image_type_unsupported',
      400,
      'Use a PNG, JPEG, or WebP image.',
    )
  }

  if (imageBuffer.length > maxGearImageBytes) {
    throw new GearImageImportError(
      'image_too_large',
      413,
      'Image must be smaller than 8 MB.',
    )
  }

  let metadata
  try {
    metadata = await sharp(imageBuffer, {
      animated: true,
      failOn: 'error',
      limitInputPixels: false,
    }).metadata()
  }
  catch (error) {
    throw new GearImageImportError(
      'image_invalid',
      400,
      'The uploaded file is not a readable image.',
      { cause: error },
    )
  }

  const expectedFormat = imageFormatsByMimeType[mimeType]
  if (metadata.format !== expectedFormat) {
    throw new GearImageImportError(
      'image_type_mismatch',
      400,
      'The uploaded file does not match its image type.',
    )
  }

  if (Number(metadata.pages || 1) > 1) {
    throw new GearImageImportError(
      'image_animated',
      400,
      'Animated images are not supported.',
    )
  }

  const width = Number(metadata.autoOrient?.width || metadata.width) || 0
  const height = Number(metadata.autoOrient?.height || metadata.height) || 0
  if (!width || !height) {
    throw new GearImageImportError(
      'image_invalid',
      400,
      'The uploaded image has invalid dimensions.',
    )
  }

  if (
    width > maxGearImageDimension
    || height > maxGearImageDimension
    || width * height > maxGearImagePixels
  ) {
    throw new GearImageImportError(
      'image_dimensions_exceeded',
      413,
      'Image dimensions are too large.',
      {
        details: {
          width,
          height,
        },
      },
    )
  }

  return {
    buffer: imageBuffer,
    mimeType,
    width,
    height,
    format: metadata.format,
  }
}

export function getMultipartFields(parts = []) {
  return (Array.isArray(parts) ? parts : []).reduce((fields, part) => {
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

export function parseImageModelOutput(payload) {
  const outputText =
    payload?.output_text
    || payload?.output
      ?.flatMap((item) => item.content || [])
      ?.find((content) => content.type === 'output_text')
      ?.text

  if (!outputText) {
    throw new GearImageImportError(
      'parser_empty',
      502,
      'The image parser did not return readable results.',
    )
  }

  try {
    return JSON.parse(outputText)
  }
  catch (error) {
    throw new GearImageImportError(
      'parser_invalid',
      502,
      'The image parser returned invalid results.',
      { cause: error },
    )
  }
}

async function getPrimaryImageUrl(
  image,
  fallbackImageUrl,
  { enabled, targetShortSide, maxScale } = {},
) {
  if (!getEnvironmentBoolean(enabled, true)) {
    return fallbackImageUrl
  }

  const scale = getPrimaryImageScale(image, { targetShortSide, maxScale })
  if (scale <= 1) {
    return fallbackImageUrl
  }

  try {
    const enlarged = await sharp(image.buffer, {
      failOn: 'none',
      limitInputPixels: maxGearImagePixels,
    })
      .autoOrient()
      .resize({
        width: image.width * scale,
        height: image.height * scale,
        fit: 'fill',
        kernel: sharp.kernel.nearest,
      })
      .png({ compressionLevel: 9 })
      .toBuffer()

    return enlarged.length <= maxGearImageBytes
      ? toImageDataUrl(enlarged, 'image/png')
      : fallbackImageUrl
  }
  catch {
    return fallbackImageUrl
  }
}

async function getSemanticImageUrl(image) {
  try {
    const normalized = await sharp(image.buffer, {
      failOn: 'none',
      limitInputPixels: maxGearImagePixels,
    })
      .autoOrient()
      .png({ compressionLevel: 9 })
      .toBuffer()

    if (normalized.length <= maxGearImageBytes) {
      return toImageDataUrl(normalized, 'image/png')
    }

    for (const quality of [95, 85, 75, 60]) {
      const compact = await sharp(image.buffer, {
        failOn: 'none',
        limitInputPixels: maxGearImagePixels,
      })
        .autoOrient()
        .webp({ quality, smartSubsample: true })
        .toBuffer()

      if (compact.length <= maxGearImageBytes) {
        return toImageDataUrl(compact, 'image/webp')
      }
    }

    return ''
  }
  catch {
    return ''
  }
}

function getPrimaryImageScale(
  image,
  {
    targetShortSide = defaultPrimaryImageTargetShortSide,
    maxScale = defaultPrimaryImageMaxScale,
  } = {},
) {
  const width = Number(image?.width) || 0
  const height = Number(image?.height) || 0
  if (!width || !height) {
    return 1
  }

  const target = getPositiveInteger(
    targetShortSide,
    defaultPrimaryImageTargetShortSide,
  )
  const configuredMaxScale = Math.min(
    defaultPrimaryImageMaxScale,
    getPositiveInteger(maxScale, defaultPrimaryImageMaxScale),
  )
  const desiredScale = Math.max(1, Math.ceil(target / Math.min(width, height)))
  const dimensionScale = Math.floor(Math.min(
    maxGearImageDimension / width,
    maxGearImageDimension / height,
  ))
  const pixelScale = Math.floor(Math.sqrt(
    maxGearImagePixels / (width * height),
  ))
  const targetLongSideScale = Math.floor(
    primaryImageTargetLongSide / Math.max(width, height),
  )
  const targetPixelScale = Math.floor(Math.sqrt(
    primaryImageTargetPixels / (width * height),
  ))

  return Math.max(1, Math.min(
    desiredScale,
    configuredMaxScale,
    dimensionScale,
    pixelScale,
    targetLongSideScale,
    targetPixelScale,
  ))
}

async function getVerificationImageUrl(image, fallbackImageUrl) {
  try {
    const longestSide = Math.max(image.width, image.height)
    const scale = Math.min(
      maxVerificationImageScale,
      Math.floor(verificationImageTargetSize / longestSide),
    )
    if (scale <= 1) {
      return fallbackImageUrl
    }

    const enlarged = await sharp(image.buffer, {
      failOn: 'none',
      limitInputPixels: maxGearImagePixels,
    })
      .autoOrient()
      .resize({
        width: image.width * scale,
        height: image.height * scale,
        fit: 'fill',
        kernel: sharp.kernel.nearest,
      })
      .png({ compressionLevel: 9 })
      .toBuffer()

    return enlarged.length <= maxGearImageBytes
      ? toImageDataUrl(enlarged, 'image/png')
      : fallbackImageUrl
  }
  catch {
    return fallbackImageUrl
  }
}

function isSemanticVerificationEligible({ normalized, reviewRowNumbers, hint }) {
  if (normalized?.equipment?.status !== 'resolved' || hasGearHintConflict(normalized, hint)) {
    return false
  }

  const lines = Array.isArray(normalized?.lines) ? normalized.lines : []
  const activeLines = lines.filter(line => !line?.ignored)
  if (activeLines.length < 1 || activeLines.length > 5 || !reviewRowNumbers.length) {
    return false
  }

  return reviewRowNumbers.every((rowNumber) => {
    const line = lines[rowNumber - 1]
    return !line?.ignored && line?.status === 'needs_review'
  })
}

function markSemanticReadsTrusted(extracted) {
  return {
    ...extracted,
    lines: (Array.isArray(extracted?.lines) ? extracted.lines : []).map(line => ({
      ...line,
      semanticVerified: true,
    })),
  }
}

async function requestImageModel({
  apiKey,
  imageUrl,
  developerText,
  userText,
  formatName,
  schema,
  model,
  reasoning,
  verbosity,
  stage,
  onModelAttempt,
  safetyIdentifier,
  signal,
  fetchImpl,
}) {
  const startedAt = Date.now()
  let payload = null

  try {
    const response = await fetchImpl('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      signal,
      body: JSON.stringify({
        model,
        store: false,
        ...(reasoning ? { reasoning } : {}),
        ...(safetyIdentifier ? { safety_identifier: String(safetyIdentifier) } : {}),
        input: [
          {
            role: 'developer',
            content: [
              {
                type: 'input_text',
                text: developerText,
              },
            ],
          },
          {
            role: 'user',
            content: [
              {
                type: 'input_text',
                text: userText,
              },
              {
                type: 'input_image',
                image_url: imageUrl,
                detail: 'original',
              },
            ],
          },
        ],
        text: {
          verbosity,
          format: {
            type: 'json_schema',
            name: formatName,
            strict: true,
            schema,
          },
        },
      }),
    })

    payload = await response.json().catch(() => null)
    if (!response.ok) {
      throw new GearImageImportError(
        'upstream_error',
        response.status,
        payload?.error?.message || 'Could not read the uploaded image.',
      )
    }

    return parseImageModelOutput(payload)
  }
  finally {
    notifyModelAttempt(onModelAttempt, {
      stage,
      model,
      reasoningEffort: reasoning?.effort || '',
      elapsedMs: Math.max(0, Date.now() - startedAt),
      usage: getModelAttemptUsage(payload?.usage),
    })
  }
}

function isValueVerificationEligible({ normalized, reviewRowNumbers, hint }) {
  if (normalized?.equipment?.status !== 'resolved' || hasGearHintConflict(normalized, hint)) {
    return false
  }

  const lines = Array.isArray(normalized?.lines) ? normalized.lines : []
  const activeLines = lines.filter(line => !line?.ignored)
  if (activeLines.length < 1 || activeLines.length > 5 || !reviewRowNumbers.length) {
    return false
  }

  const reviewRows = new Set(reviewRowNumbers)
  const unresolvedRows = lines.flatMap((line, index) =>
    !line?.ignored && line?.status === 'needs_review' ? [index + 1] : [],
  )
  if (
    unresolvedRows.length !== reviewRows.size
    || unresolvedRows.some(rowNumber => !reviewRows.has(rowNumber))
  ) {
    return false
  }

  const maximumLevel = getMaxEnchantLevel(normalized.gearType)
  return activeLines.every((line) => {
    const level = Number(line?.level)
    return Number.isInteger(level) && level >= 2 && level <= maximumLevel
  })
}

function hasGearHintConflict(imported, hint) {
  return Boolean(
    hint
    && imported?.equipment?.source === 'image'
    && (
      imported?.gearType !== hint.gearType
      || imported?.pieceType !== hint.pieceType
    ),
  )
}

function getModelAttemptUsage(usage) {
  if (!usage || typeof usage !== 'object') {
    return null
  }

  return {
    inputTokens: toTokenCount(usage.input_tokens),
    cachedInputTokens: toTokenCount(usage.input_tokens_details?.cached_tokens),
    outputTokens: toTokenCount(usage.output_tokens),
    reasoningTokens: toTokenCount(usage.output_tokens_details?.reasoning_tokens),
    totalTokens: toTokenCount(usage.total_tokens),
  }
}

function toTokenCount(value) {
  const count = Number(value)
  return Number.isFinite(count) && count >= 0 ? Math.trunc(count) : 0
}

function getEnvironmentBoolean(value, fallback) {
  if (typeof value === 'boolean') {
    return value
  }

  const normalized = String(value ?? '').trim().toLowerCase()
  if (['1', 'true', 'yes', 'on'].includes(normalized)) {
    return true
  }
  if (['0', 'false', 'no', 'off'].includes(normalized)) {
    return false
  }

  return fallback
}

function getPositiveInteger(value, fallback) {
  const number = Number(value)
  return Number.isInteger(number) && number > 0 ? number : fallback
}

function notifyModelAttempt(callback, attempt) {
  if (typeof callback !== 'function') {
    return
  }

  try {
    const result = callback(attempt)
    if (result && typeof result.catch === 'function') {
      result.catch(() => {})
    }
  }
  catch {
    // Observability must never change the import result.
  }
}

function resolveGearHint(gearHint, gearCatalog) {
  const gearType = getValidGearType(gearHint?.gearType, gearCatalog)
  const pieceType = getValidPieceType(gearType, gearHint?.pieceType, gearCatalog)
  return gearType && pieceType ? { gearType, pieceType } : null
}

function getRequestSignal(signal, timeoutMs) {
  const timeout = Number(timeoutMs)
  const timeoutSignal =
    Number.isFinite(timeout) && timeout > 0 && typeof AbortSignal?.timeout === 'function'
      ? AbortSignal.timeout(timeout)
      : null

  if (signal && timeoutSignal && typeof AbortSignal?.any === 'function') {
    return AbortSignal.any([signal, timeoutSignal])
  }

  return signal || timeoutSignal || undefined
}

function toBuffer(value) {
  if (Buffer.isBuffer(value)) {
    return value
  }

  if (value instanceof Uint8Array) {
    return Buffer.from(value.buffer, value.byteOffset, value.byteLength)
  }

  if (value instanceof ArrayBuffer) {
    return Buffer.from(value)
  }

  return null
}

function toImageDataUrl(buffer, mimeType) {
  return `data:${mimeType};base64,${buffer.toString('base64')}`
}
