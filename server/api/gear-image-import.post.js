import { createError, defineEventHandler, readMultipartFormData } from 'h3'
import sharp from 'sharp'
import gears from '@/utils/gear.js'
import {
  getExtractorPrompt,
  getExtractorSchema,
  getPieceNames,
  getRequestContext,
  getValidGearType,
  getValidPieceType,
  getValueReviewRowNumbers,
  getValueVerificationPrompt,
  getValueVerificationRequestText,
  getValueVerificationRequests,
  getValueVerificationSchema,
  mergeVerifiedLineReads,
  normalizeExtraction,
} from '../utils/gear-image-import.js'

const imageImportModel = process.env.OPENAI_IMAGE_IMPORT_MODEL || 'gpt-5.4-mini'
const imageVerificationModel = process.env.OPENAI_IMAGE_IMPORT_VERIFICATION_MODEL || 'gpt-4.1-mini'
const maxImageBytes = 8 * 1024 * 1024
const maxImagePixels = 20_000_000
const maxImageDimension = 8192
const verificationImageTargetSize = 1900
const maxVerificationImageScale = 3
const allowedImageTypes = new Set(['image/png', 'image/jpeg', 'image/webp'])

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

  const fallbackGearType = getValidGearType(fields.gearType?.value, gears) || '[9999] Armor'
  const fallbackPieceType =
    getValidPieceType(fallbackGearType, fields.pieceType?.value, gears) || getPieceNames(fallbackGearType, gears)[0]
  const imageUrl = `data:${image.type};base64,${Buffer.from(image.data).toString('base64')}`
  const extracted = await requestImageModel({
    apiKey,
    imageUrl,
    developerText: getExtractorPrompt(),
    userText: getRequestContext(fallbackGearType, fallbackPieceType, gears),
    formatName: 'gear_image_import',
    schema: getExtractorSchema(gears),
  })
  const normalized = normalizeExtraction(extracted, fallbackGearType, fallbackPieceType, gears)
  const reviewRowNumbers = getValueReviewRowNumbers(normalized)
  if (!reviewRowNumbers.length) {
    return normalized
  }

  try {
    const verificationRequests = getValueVerificationRequests(extracted, reviewRowNumbers)
    const verificationImageUrl = await getVerificationImageUrl(image, imageUrl)
    const verification = await requestImageModel({
      apiKey,
      imageUrl: verificationImageUrl,
      model: imageVerificationModel,
      reasoning: null,
      verbosity: 'medium',
      developerText: getValueVerificationPrompt(),
      userText: getValueVerificationRequestText(verificationRequests),
      formatName: 'gear_image_value_verification',
      schema: getValueVerificationSchema(reviewRowNumbers),
    })
    const verifiedExtraction = mergeVerifiedLineReads(extracted, verification?.lines, reviewRowNumbers)
    const verifiedNormalized = normalizeExtraction(
      verifiedExtraction,
      fallbackGearType,
      fallbackPieceType,
      gears,
    )
    const improvedRowNumbers = reviewRowNumbers.filter(
      (rowNumber) => {
        const originalLine = normalized.lines[rowNumber - 1]
        const verifiedLine = verifiedNormalized.lines[rowNumber - 1]
        return verifiedLine?.status === 'matched'
          && verifiedLine.stat === originalLine?.stat
          && verifiedLine.level === originalLine?.level
      },
    )

    if (improvedRowNumbers.length) {
      return normalizeExtraction(
        mergeVerifiedLineReads(extracted, verification?.lines, improvedRowNumbers),
        fallbackGearType,
        fallbackPieceType,
        gears,
      )
    }
  } catch {
    // Keep the original review state when the focused re-read is unavailable.
  }

  return normalized
})

async function getVerificationImageUrl(image, fallbackImageUrl) {
  try {
    const transformer = sharp(image.data, {
      failOn: 'none',
      limitInputPixels: maxImagePixels,
    })
    const metadata = await transformer.metadata()
    const width = metadata.width || 0
    const height = metadata.height || 0
    const pixelCount = width * height
    if (
      !width
      || !height
      || width > maxImageDimension
      || height > maxImageDimension
      || pixelCount > maxImagePixels
    ) {
      return fallbackImageUrl
    }

    const longestSide = Math.max(metadata.width || 0, metadata.height || 0)
    const scale = Math.min(maxVerificationImageScale, verificationImageTargetSize / longestSide)
    if (scale <= 1) {
      return fallbackImageUrl
    }

    const resizedWidth = Math.round(width * scale)
    const enlarged = await transformer
      .resize({ width: resizedWidth, kernel: sharp.kernel.nearest })
      .png({ compressionLevel: 9 })
      .toBuffer()

    return enlarged.length <= maxImageBytes
      ? `data:image/png;base64,${enlarged.toString('base64')}`
      : fallbackImageUrl
  } catch {
    return fallbackImageUrl
  }
}

async function requestImageModel({
  apiKey,
  imageUrl,
  developerText,
  userText,
  formatName,
  schema,
  model = imageImportModel,
  reasoning = { effort: 'none' },
  verbosity = 'low',
}) {
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      store: false,
      ...(reasoning ? { reasoning } : {}),
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
              detail: 'high',
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

  const payload = await response.json().catch(() => null)
  if (!response.ok) {
    throw createError({
      statusCode: response.status,
      statusMessage: payload?.error?.message || 'Could not read the uploaded image.',
    })
  }

  const extracted = parseOutput(payload)
  return extracted
}

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
