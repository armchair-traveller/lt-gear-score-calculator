import assert from 'node:assert/strict'
import test from 'node:test'
import {
  GearImageImportError,
  importGearImage,
  validateGearImage,
} from '../server/utils/gear-image-import-service.js'

const pngBuffer = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64',
)

test('imports a validated image buffer and records screenshot equipment provenance', async () => {
  const requests = []
  const extraction = {
    gearType: '[9999] Armor',
    pieceType: 'Helmet',
    equipmentVisible: true,
    confidence: 0.98,
    lines: [
      createLine(
        'Lv. 2 Dual Critical Damage +21 [17%]',
        'Dual Critical Damage',
        21,
        17,
        2,
      ),
    ],
  }
  const result = await importGearImage({
    buffer: pngBuffer,
    mimeType: 'image/png',
    apiKey: 'test-key',
    safetyIdentifier: 'hashed-user',
    fetchImpl: async (_url, init) => {
      requests.push(JSON.parse(init.body))
      return jsonResponse({ output_text: JSON.stringify(extraction) })
    },
  })

  assert.equal(requests.length, 1)
  assert.equal(requests[0].store, false)
  assert.equal(requests[0].safety_identifier, 'hashed-user')
  assert.equal(
    requests[0].text.format.schema.properties.equipmentVisible.type,
    'boolean',
  )
  assert.deepEqual(result.equipment, {
    status: 'resolved',
    source: 'image',
    imageVisible: true,
    confidence: 0.98,
    reason: 'Equipment identity read from the screenshot',
  })
  assert.equal(result.lines[0].status, 'matched')
})

test('uses an explicit gear hint when equipment identity is not visible', async () => {
  const result = await importGearImage({
    buffer: pngBuffer,
    mimeType: 'image/png',
    gearHint: {
      gearType: '[sLv5] Accessories',
      pieceType: 'Cloak',
    },
    apiKey: 'test-key',
    fetchImpl: createExtractionFetch({
      gearType: '[9999] Armor',
      pieceType: 'Helmet',
      equipmentVisible: false,
      confidence: 0.95,
      lines: [
        createLine(
          'Lv. 2 Dual Critical Damage +50 [49%]',
          'Dual Critical Damage',
          50,
          49,
          2,
        ),
      ],
    }),
  })

  assert.equal(result.gearType, '[sLv5] Accessories')
  assert.equal(result.pieceType, 'Cloak')
  assert.equal(result.equipment.status, 'resolved')
  assert.equal(result.equipment.source, 'hint')
  assert.equal(result.equipment.imageVisible, false)
})

test('marks a parsing fallback as unresolved when no identity or hint is available', async () => {
  const result = await importGearImage({
    buffer: pngBuffer,
    mimeType: 'image/png',
    apiKey: 'test-key',
    fetchImpl: createExtractionFetch({
      gearType: '[9999] Armor',
      pieceType: 'Helmet',
      equipmentVisible: false,
      confidence: 0.95,
      lines: [
        createLine(
          'Lv. 2 Dual Critical Damage +21 [17%]',
          'Dual Critical Damage',
          21,
          17,
          2,
        ),
      ],
    }),
  })

  assert.equal(result.gearType, '[9999] Armor')
  assert.equal(result.pieceType, 'Helmet')
  assert.equal(result.equipment.status, 'needs_review')
  assert.equal(result.equipment.source, 'fallback')
  assert.match(result.equipment.reason, /no equipment hint/i)
})

test('rejects files whose bytes do not match the declared image type', async () => {
  await assert.rejects(
    validateGearImage({
      buffer: pngBuffer,
      mimeType: 'image/jpeg',
    }),
    (error) =>
      error instanceof GearImageImportError
      && error.code === 'image_type_mismatch'
      && error.statusCode === 400,
  )
})

function createExtractionFetch(extraction) {
  return async () => jsonResponse({
    output_text: JSON.stringify(extraction),
  })
}

function jsonResponse(payload) {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
    },
  })
}

function createLine(rawText, statText, value, rollPercent, level) {
  return {
    rawText,
    level,
    statText,
    value,
    rollPercent,
    ignored: false,
    ignoreReason: '',
  }
}
