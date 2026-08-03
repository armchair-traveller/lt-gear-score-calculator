import assert from 'node:assert/strict'
import test from 'node:test'
import { evaluateImportedGear } from '../app/features/gear-score/gear-evaluation.js'
import { processGearScoreInteraction } from '../server/api/discord/interactions.post.js'
import { importGearImage } from '../server/utils/gear-image-import-service.js'

const pngBuffer = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64',
)
const modelEnvironmentNames = [
  'OPENAI_IMAGE_IMPORT_MODEL',
  'OPENAI_IMAGE_IMPORT_REASONING_EFFORT',
  'OPENAI_IMAGE_IMPORT_VERIFICATION_MODEL',
  'OPENAI_IMAGE_IMPORT_VERIFICATION_REASONING_EFFORT',
  'OPENAI_IMAGE_IMPORT_FALLBACK_MODEL',
  'OPENAI_IMAGE_IMPORT_FALLBACK_REASONING_EFFORT',
]
const originalModelEnvironment = Object.fromEntries(
  modelEnvironmentNames.map(name => [name, process.env[name]]),
)

test.before(() => {
  modelEnvironmentNames.forEach(name => delete process.env[name])
})

test.after(() => {
  modelEnvironmentNames.forEach((name) => {
    const value = originalModelEnvironment[name]
    if (value === undefined) {
      delete process.env[name]
    }
    else {
      process.env[name] = value
    }
  })
})

test('imports, evaluates, renders, and edits the same Discord response', async () => {
  const calls = []
  const evaluation = {
    gearType: '[9999] Armor',
    pieceType: 'Helmet',
    sharePath: '/?it=abc',
    snapshotPayload: {
      itemName: '[9999] Armor · Helmet',
      itemImageKey: 'Helmet_9999.png',
      current: { value: '72%', tier: 'S', levelLabel: 'Lv.2' },
      projected: null,
    },
  }

  await processGearScoreInteraction({
    applicationId: 'application',
    interactionToken: 'token',
    attachment: { id: 'attachment' },
    gearHint: { gearType: '[9999] Armor', pieceType: 'Helmet' },
    safetyIdentifier: 'safety',
    publicSiteUrl: 'https://latale.example',
    downloadDiscordAttachmentImpl: async () => ({
      buffer: Buffer.from('image'),
      mimeType: 'image/png',
    }),
    importGearImageImpl: async (input) => {
      calls.push(['import', input])
      return { imported: true }
    },
    evaluateImportedGearImpl: (input) => {
      calls.push(['evaluate', input])
      return evaluation
    },
    loadSnapshotItemImageImpl: async (payload) => {
      calls.push(['asset', payload])
      return Buffer.from('item')
    },
    loadSnapshotFontImpl: async () => {
      calls.push(['font'])
      return [Buffer.from('font')]
    },
    renderGearSnapshotBufferImpl: async (payload, options) => {
      calls.push(['render', payload, options])
      return Buffer.from('snapshot')
    },
    editOriginalDiscordResponseImpl: async (input) => {
      calls.push(['edit', input])
    },
  })

  assert.equal(calls[0][0], 'import')
  assert.deepEqual(calls[0][1].gearHint, {
    gearType: '[9999] Armor',
    pieceType: 'Helmet',
  })
  assert.equal(calls[0][1].safetyIdentifier, 'safety')
  assert.equal(calls[0][1].throwOnVerificationError, true)
  assert.equal(calls[1][0], 'evaluate')
  assert.deepEqual(calls[4][2], {
    itemImageBuffer: Buffer.from('item'),
    geistFontBuffers: [Buffer.from('font')],
  })
  assert.equal(calls[5][1].applicationId, 'application')
  assert.equal(calls[5][1].interactionToken, 'token')
  assert.deepEqual(calls[5][1].file, Buffer.from('snapshot'))
  assert.match(calls[5][1].content, /Open in the calculator/)
})

test('edits the deferred response with guidance when evaluation fails', async () => {
  const edits = []

  await processGearScoreInteraction({
    applicationId: 'application',
    interactionToken: 'token',
    attachment: { id: 'attachment' },
    gearHint: null,
    safetyIdentifier: 'safety',
    publicSiteUrl: 'https://latale.example',
    downloadDiscordAttachmentImpl: async () => ({
      buffer: Buffer.from('image'),
      mimeType: 'image/png',
    }),
    importGearImageImpl: async () => ({ imported: true }),
    loadSnapshotFontImpl: async () => null,
    evaluateImportedGearImpl: () => {
      const error = new Error('review')
      error.code = 'lines_need_review'
      throw error
    },
    editOriginalDiscordResponseImpl: async input => edits.push(input),
  })

  assert.equal(edits.length, 1)
  assert.equal(edits[0].file, undefined)
  assert.match(edits[0].content, /did not score/i)
})

test('runs one independent Sol fallback for parser and evaluation accuracy failures', async (t) => {
  const cases = [
    { name: 'empty parser output', importCode: 'parser_empty' },
    { name: 'invalid parser output', importCode: 'parser_invalid' },
    { name: 'unresolved equipment', evaluationCode: 'equipment_unresolved' },
    { name: 'missing lines', evaluationCode: 'lines_missing' },
    { name: 'too many lines', evaluationCode: 'lines_too_many' },
    { name: 'review lines', evaluationCode: 'lines_need_review' },
    { name: 'duplicated stats', evaluationCode: 'stats_duplicated' },
    { name: 'out of range values', evaluationCode: 'values_out_of_range' },
  ]

  for (const testCase of cases) {
    await t.test(testCase.name, async () => {
      const imageBuffer = Buffer.from('original-image')
      const gearHint = { gearType: '[9999] Armor', pieceType: 'Helmet' }
      const importCalls = []
      const evaluationCalls = []
      const modelAttempts = []
      const edits = []

      await processGearScoreInteraction(createProcessOptions({
        gearHint,
        imageBuffer,
        importGearImageImpl: async (input) => {
          importCalls.push(input)
          input.onModelAttempt?.({
            stage: 'primary',
            model: importCalls.length === 1 ? 'gpt-5.6-luna' : 'gpt-5.6-sol',
            reasoningEffort: importCalls.length === 1 ? 'low' : 'none',
            elapsedMs: 1,
            usage: null,
          })
          if (importCalls.length === 1 && testCase.importCode) {
            throw createCodedError(testCase.importCode)
          }
          return importCalls.length === 1 ? { pass: 'primary' } : { pass: 'fallback' }
        },
        evaluateImportedGearImpl: (imported) => {
          evaluationCalls.push(imported)
          if (imported.pass === 'primary' && testCase.evaluationCode) {
            throw createCodedError(testCase.evaluationCode)
          }
          return createEvaluation()
        },
        editOriginalDiscordResponseImpl: async input => edits.push(input),
        onModelAttemptImpl: attempt => modelAttempts.push(attempt),
      }))

      assert.equal(importCalls.length, 2)
      assert.equal(importCalls[0].buffer, imageBuffer)
      assert.equal(importCalls[1].buffer, imageBuffer)
      assert.equal(importCalls[0].mimeType, 'image/png')
      assert.equal(importCalls[1].mimeType, 'image/png')
      assert.equal(importCalls[1].gearHint, gearHint)
      assert.equal(importCalls[1].safetyIdentifier, 'safety')
      assert.equal(importCalls[1].signal, importCalls[0].signal)
      assert.equal(importCalls[1].importModel, 'gpt-5.6-sol')
      assert.equal(importCalls[1].importReasoningEffort, 'none')
      assert.equal(importCalls[1].enableValueVerification, false)
      assert.equal(importCalls[1].enableSemanticVerification, false)
      assert.equal(importCalls[1].trustPrimarySemanticReads, true)
      assert.equal(importCalls[1].preferGearHint, true)
      assert.equal(modelAttempts.at(-1).stage, 'fallback')
      assert.equal(
        evaluationCalls.filter(imported => imported.pass === 'primary').length,
        testCase.importCode ? 0 : 1,
      )
      assert.equal(evaluationCalls.at(-1).pass, 'fallback')
      assert.equal(edits.length, 1)
      assert.ok(edits[0].file)
    })
  }
})

test('runs the Sol fallback before evaluation when the screenshot conflicts with the selected hint', async () => {
  const importCalls = []
  const evaluationCalls = []
  const gearHint = { gearType: '[sLv5] Accessories', pieceType: 'Cloak' }

  await processGearScoreInteraction(createProcessOptions({
    gearHint,
    importGearImageImpl: async (input) => {
      importCalls.push(input)
      return importCalls.length === 1
        ? {
            pass: 'conflicting-primary',
            gearType: '[9999] Armor',
            pieceType: 'Helmet',
            equipment: { source: 'image' },
          }
        : {
            pass: 'fallback',
            gearType: gearHint.gearType,
            pieceType: gearHint.pieceType,
            equipment: { source: 'hint' },
          }
    },
    evaluateImportedGearImpl: (imported) => {
      evaluationCalls.push(imported)
      return createEvaluation()
    },
  }))

  assert.equal(importCalls.length, 2)
  assert.equal(evaluationCalls.length, 1)
  assert.equal(evaluationCalls[0].pass, 'fallback')
  assert.equal(evaluationCalls[0].gearType, gearHint.gearType)
  assert.equal(evaluationCalls[0].pieceType, gearHint.pieceType)
  assert.equal(importCalls[1].preferGearHint, true)
  assert.equal(importCalls[1].gearHint, gearHint)
})

test('does not use the accuracy fallback for transport, configuration, or unsupported gear failures', async (t) => {
  const cases = [
    { name: 'missing image', importCode: 'image_missing' },
    { name: 'missing API key', importCode: 'api_key_missing' },
    { name: 'missing fetch', importCode: 'fetch_unavailable' },
    { name: 'upstream response', importCode: 'upstream_error' },
    { name: 'upstream transport', importCode: 'upstream_unavailable' },
    { name: 'model timeout', importCode: 'import_timeout' },
    { name: 'unsupported equipment', evaluationCode: 'equipment_unsupported' },
  ]

  for (const testCase of cases) {
    await t.test(testCase.name, async () => {
      const importCalls = []
      const edits = []
      await processGearScoreInteraction(createProcessOptions({
        importGearImageImpl: async (input) => {
          importCalls.push(input)
          if (testCase.importCode) {
            throw createCodedError(testCase.importCode)
          }
          return { pass: 'primary' }
        },
        evaluateImportedGearImpl: () => {
          if (testCase.evaluationCode) {
            throw createCodedError(testCase.evaluationCode)
          }
          return createEvaluation()
        },
        editOriginalDiscordResponseImpl: async input => edits.push(input),
      }))

      assert.equal(importCalls.length, 1)
      assert.equal(edits.length, 1)
      assert.equal(edits[0].file, undefined)
    })
  }
})

test('does not recurse when the Sol fallback also returns a retryable failure', async () => {
  const importCalls = []
  const edits = []

  await processGearScoreInteraction(createProcessOptions({
    importGearImageImpl: async (input) => {
      importCalls.push(input)
      throw createCodedError(importCalls.length === 1 ? 'parser_invalid' : 'lines_need_review')
    },
    evaluateImportedGearImpl: () => createEvaluation(),
    editOriginalDiscordResponseImpl: async input => edits.push(input),
  }))

  assert.equal(importCalls.length, 2)
  assert.equal(edits.length, 1)
  assert.equal(edits[0].file, undefined)
})

test('does not retry after rendering fails', async () => {
  const importCalls = []
  const edits = []

  await processGearScoreInteraction(createProcessOptions({
    importGearImageImpl: async (input) => {
      importCalls.push(input)
      return { pass: 'primary' }
    },
    evaluateImportedGearImpl: () => createEvaluation(),
    renderGearSnapshotBufferImpl: async () => {
      throw new Error('render failed')
    },
    editOriginalDiscordResponseImpl: async input => edits.push(input),
  }))

  assert.equal(importCalls.length, 1)
  assert.equal(edits.length, 1)
  assert.equal(edits[0].file, undefined)
})

test('does not escalate a focused verifier upstream failure to the full fallback', async () => {
  const requests = []
  const edits = []
  const responses = [
    jsonResponse({ output_text: JSON.stringify(createWeaponMismatchExtraction()) }),
    new Response(JSON.stringify({ error: { message: 'verifier unavailable' } }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    }),
  ]
  const fetchImpl = async (_url, init) => {
    requests.push(JSON.parse(init.body))
    const response = responses.shift()
    assert.notEqual(response, undefined, 'received an unexpected full fallback request')
    return response
  }

  await processGearScoreInteraction(createProcessOptions({
    imageBuffer: pngBuffer,
    gearHint: { gearType: '[8000] Weapons', pieceType: 'Weapon' },
    importGearImageImpl: input => importGearImage({
      ...input,
      apiKey: 'test-key',
      fetchImpl,
    }),
    evaluateImportedGearImpl: evaluateImportedGear,
    editOriginalDiscordResponseImpl: async input => edits.push(input),
    onModelAttemptImpl: () => {},
  }))

  assert.equal(requests.length, 2)
  assert.deepEqual(
    requests.map(request => request.text.format.name),
    ['gear_image_import', 'gear_image_value_verification'],
  )
  assert.equal(edits.length, 1)
  assert.equal(edits[0].file, undefined)
})

test('caps primary, row verification, and full fallback at three model requests', async () => {
  const requests = []
  const edits = []
  const extraction = createWeaponMismatchExtraction()
  extraction.primarySentinel = 'PRIMARY_OCR_SENTINEL'
  const responses = [
    { output_text: JSON.stringify(extraction) },
    { output_text: 'not valid json' },
    { output_text: JSON.stringify(createWeaponMismatchExtraction()) },
  ]
  const fetchImpl = async (_url, init) => {
    requests.push(JSON.parse(init.body))
    const payload = responses.shift()
    assert.notEqual(payload, undefined, 'received a fourth model request')
    return jsonResponse(payload)
  }

  await processGearScoreInteraction(createProcessOptions({
    imageBuffer: pngBuffer,
    gearHint: { gearType: '[8000] Weapons', pieceType: 'Weapon' },
    importGearImageImpl: input => importGearImage({
      ...input,
      apiKey: 'test-key',
      fetchImpl,
    }),
    evaluateImportedGearImpl: evaluateImportedGear,
    editOriginalDiscordResponseImpl: async input => edits.push(input),
    onModelAttemptImpl: () => {},
  }))

  assert.equal(requests.length, 3)
  assert.deepEqual(
    requests.map(request => ({
      format: request.text.format.name,
      model: request.model,
      effort: request.reasoning.effort,
    })),
    [
      { format: 'gear_image_import', model: 'gpt-5.6-luna', effort: 'low' },
      { format: 'gear_image_value_verification', model: 'gpt-5.6-luna', effort: 'none' },
      { format: 'gear_image_import', model: 'gpt-5.6-sol', effort: 'none' },
    ],
  )
  assert.doesNotMatch(JSON.stringify(requests[2]), /PRIMARY_OCR_SENTINEL/)
  assert.equal(edits.length, 1)
  assert.equal(edits[0].file, undefined)
})

test('caps primary, semantic verification, and full fallback at three model requests', async () => {
  const requests = []
  const edits = []
  const extraction = createCrystalSemanticMismatchExtraction()
  extraction.primarySentinel = 'PRIMARY_SEMANTIC_SENTINEL'
  const responses = [
    { output_text: JSON.stringify(extraction) },
    { output_text: 'not valid json' },
    { output_text: JSON.stringify(createCrystalSemanticMismatchExtraction()) },
  ]
  const fetchImpl = async (_url, init) => {
    requests.push(JSON.parse(init.body))
    const payload = responses.shift()
    assert.notEqual(payload, undefined, 'received a fourth model request')
    return jsonResponse(payload)
  }

  await processGearScoreInteraction(createProcessOptions({
    imageBuffer: pngBuffer,
    gearHint: { gearType: '[9000] Accessories', pieceType: 'Crystal' },
    importGearImageImpl: input => importGearImage({
      ...input,
      apiKey: 'test-key',
      fetchImpl,
    }),
    evaluateImportedGearImpl: evaluateImportedGear,
    editOriginalDiscordResponseImpl: async input => edits.push(input),
    onModelAttemptImpl: () => {},
  }))

  assert.equal(requests.length, 3)
  assert.deepEqual(
    requests.map(request => ({
      format: request.text.format.name,
      model: request.model,
      effort: request.reasoning.effort,
    })),
    [
      { format: 'gear_image_import', model: 'gpt-5.6-luna', effort: 'low' },
      { format: 'gear_image_semantic_verification', model: 'gpt-5.6-sol', effort: 'none' },
      { format: 'gear_image_import', model: 'gpt-5.6-sol', effort: 'none' },
    ],
  )
  assert.doesNotMatch(JSON.stringify(requests[2]), /PRIMARY_SEMANTIC_SENTINEL/)
  assert.equal(edits.length, 1)
})

function createProcessOptions({
  imageBuffer = Buffer.from('image'),
  ...overrides
} = {}) {
  return {
    applicationId: 'application',
    interactionToken: 'token',
    attachment: { id: 'attachment' },
    gearHint: null,
    safetyIdentifier: 'safety',
    publicSiteUrl: 'https://latale.example',
    downloadDiscordAttachmentImpl: async () => ({
      buffer: imageBuffer,
      mimeType: 'image/png',
    }),
    loadSnapshotItemImageImpl: async () => null,
    loadSnapshotFontImpl: async () => null,
    renderGearSnapshotBufferImpl: async () => Buffer.from('snapshot'),
    editOriginalDiscordResponseImpl: async () => {},
    onModelAttemptImpl: () => {},
    ...overrides,
  }
}

function createEvaluation() {
  return {
    gearType: '[9999] Armor',
    pieceType: 'Helmet',
    sharePath: '/?it=abc',
    snapshotPayload: {
      itemName: '[9999] Armor · Helmet',
      itemImageKey: 'Helmet_9999.png',
      current: { value: '72%', tier: 'S', levelLabel: 'Lv.2' },
      projected: null,
    },
  }
}

function createCodedError(code) {
  const error = new Error(code)
  error.code = code
  return error
}

function createWeaponMismatchExtraction() {
  return {
    gearType: '[8000] Weapons',
    pieceType: 'Weapon',
    equipmentVisible: true,
    confidence: 0.99,
    lines: [
      createLine('Lv. 1 Dual Back Attack Damage +1', 'Dual Back Attack Damage', 1, 0, 1),
      createLine('Lv. 2 Basic Stats +15% [100%]', 'Basic Stats', 15, 100, 2),
      createLine('Lv. 2 Dual Critical Damage +147 [97%]', 'Dual Critical Damage', 147, 97, 2),
      createLine('Lv. 2 Basic Stats +1553 [80%]', 'Basic Stats', 1553, 80, 2),
      createLine('Lv. 2 Dual Maximum Damage +144 [65%]', 'Dual Maximum Damage', 144, 65, 2),
    ],
  }
}

function createCrystalSemanticMismatchExtraction() {
  return {
    gearType: '[9000] Accessories',
    pieceType: 'Crystal',
    equipmentVisible: true,
    confidence: 0.99,
    lines: [
      createLine(
        'Lv. 2 Boss Damage Mitigation +2.8% [84%]',
        'Boss Damage Mitigation',
        2.8,
        84,
        2,
      ),
    ],
  }
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

function jsonResponse(payload) {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}
