import { createError, defineEventHandler, readMultipartFormData } from 'h3'
import gears from '@/utils/gear.js'
import {
  getExtractorPrompt,
  getExtractorSchema,
  getPieceNames,
  getRequestContext,
  getValidGearType,
  getValidPieceType,
  normalizeExtraction,
} from '../utils/gear-image-import.js'

const imageImportModel = process.env.OPENAI_IMAGE_IMPORT_MODEL || 'gpt-5.4-mini'
const maxImageBytes = 8 * 1024 * 1024
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
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: imageImportModel,
      store: false,
      reasoning: { effort: 'none' },
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
              text: getRequestContext(fallbackGearType, fallbackPieceType, gears),
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
          schema: getExtractorSchema(gears),
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
  return normalizeExtraction(extracted, fallbackGearType, fallbackPieceType, gears)
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
