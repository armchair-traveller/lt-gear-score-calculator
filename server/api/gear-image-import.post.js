import { createError, defineEventHandler, readMultipartFormData } from 'h3'
import {
  GearImageImportError,
  getMultipartFields,
  importGearImage,
} from '../utils/gear-image-import-service.js'

export default defineEventHandler(async (event) => {
  const parts = await readMultipartFormData(event)
  const fields = getMultipartFields(parts)
  const image = fields.image

  try {
    return await importGearImage({
      buffer: image?.data,
      mimeType: image?.type,
      gearHint: {
        gearType: fields.gearType?.value,
        pieceType: fields.pieceType?.value,
      },
    })
  }
  catch (error) {
    if (error instanceof GearImageImportError) {
      throw createError({
        statusCode: error.statusCode,
        statusMessage: error.message,
        data: {
          code: error.code,
          ...(error.details ? { details: error.details } : {}),
        },
      })
    }

    throw error
  }
})
