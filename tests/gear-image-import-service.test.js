import assert from 'node:assert/strict'
import test from 'node:test'
import {
  GearImageImportError,
  importGearImage,
  validateGearImage,
} from '../server/utils/gear-image-import-service.js'

const modelEnvironmentNames = [
  'OPENAI_IMAGE_IMPORT_MODEL',
  'OPENAI_IMAGE_IMPORT_REASONING_EFFORT',
  'OPENAI_IMAGE_IMPORT_VERIFICATION_MODEL',
  'OPENAI_IMAGE_IMPORT_VERIFICATION_REASONING_EFFORT',
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

const pngBuffer = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64',
)

const weaponMismatchExtraction = {
  gearType: '[8000] Weapons',
  pieceType: 'Weapon',
  equipmentVisible: true,
  confidence: 0.99,
  lines: [
    createLine('Lv. 1 Dual Back Attack Damage +1', 'Dual Back Attack Damage', 1, 0, 1),
    createLine('Lv. 2 Basic Stats +15% [100%]', 'Basic Stats', 15, 100, 2),
    createLine('Lv. 2 Dual Critical Damage +147 [97%]', 'Dual Critical Damage', 147, 97, 2),
    createLine('Lv. 2 Basic Stats +1553 [80%]', 'Basic Stats', 1553, 80, 2),
    createLine('Lv. 2 Dual Maximum Damage +14 [65%]', 'Dual Maximum Damage', 14, 65, 2),
  ],
}

test('imports a validated image buffer and records screenshot equipment provenance', async () => {
  const requests = []
  const attempts = []
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
    onModelAttempt: attempt => attempts.push(attempt),
    fetchImpl: async (_url, init) => {
      requests.push(JSON.parse(init.body))
      return jsonResponse({
        output_text: JSON.stringify(extraction),
        usage: {
          input_tokens: 120,
          input_tokens_details: { cached_tokens: 20 },
          output_tokens: 30,
          output_tokens_details: { reasoning_tokens: 10 },
          total_tokens: 150,
        },
      })
    },
  })

  assert.equal(requests.length, 1)
  assert.equal(requests[0].model, 'gpt-5.6-luna')
  assert.deepEqual(requests[0].reasoning, { effort: 'low' })
  assert.equal(requests[0].store, false)
  assert.equal(requests[0].safety_identifier, 'hashed-user')
  assert.equal(requests[0].text.verbosity, 'low')
  assert.equal(requests[0].input[1].content[1].detail, 'original')
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
  assert.equal(attempts.length, 1)
  assert.deepEqual(Object.keys(attempts[0]).sort(), [
    'elapsedMs',
    'model',
    'reasoningEffort',
    'stage',
    'usage',
  ])
  assert.deepEqual(attempts[0], {
    stage: 'primary',
    model: 'gpt-5.6-luna',
    reasoningEffort: 'low',
    elapsedMs: attempts[0].elapsedMs,
    usage: {
      inputTokens: 120,
      cachedInputTokens: 20,
      outputTokens: 30,
      reasoningTokens: 10,
      totalTokens: 150,
    },
  })
  assert.ok(Number.isInteger(attempts[0].elapsedMs))
  assert.ok(attempts[0].elapsedMs >= 0)
  const attemptText = JSON.stringify(attempts[0])
  assert.doesNotMatch(attemptText, /data:image|hashed-user|Dual Critical Damage|Helmet/)
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

test('uses Luna none for one focused request that repairs every roll mismatch', async () => {
  const requests = []
  const attempts = []
  const responses = [
    {
      output_text: JSON.stringify(weaponMismatchExtraction),
      usage: { input_tokens: 100, output_tokens: 40, total_tokens: 140 },
    },
    {
      output_text: JSON.stringify({
        lines: [
          { rowNumber: 4, rawText: 'Lv. 2 Basic Stats +14553 [80%]' },
          { rowNumber: 5, rawText: 'Lv. 2 Dual Maximum Damage +144 [65%]' },
        ],
      }),
      usage: {
        input_tokens: 200,
        output_tokens: 20,
        output_tokens_details: { reasoning_tokens: 0 },
        total_tokens: 220,
      },
    },
  ]

  const result = await importGearImage({
    buffer: pngBuffer,
    mimeType: 'image/png',
    apiKey: 'test-key',
    onModelAttempt: attempt => attempts.push(attempt),
    fetchImpl: createSequentialFetch(responses, requests),
  })

  assert.equal(requests.length, 2)
  assert.equal(requests[1].model, 'gpt-5.6-luna')
  assert.deepEqual(requests[1].reasoning, { effort: 'none' })
  assert.equal(requests[1].text.verbosity, 'medium')
  assert.equal(requests[1].text.format.name, 'gear_image_value_verification')
  assert.deepEqual(
    requests[1].text.format.schema.properties.lines.items.properties.rowNumber.enum,
    [4, 5],
  )
  assert.equal(requests[1].input[1].content[1].detail, 'original')
  assert.doesNotMatch(requests[1].input[1].content[0].text, /1553|14553|80%/)
  assert.deepEqual(
    result.lines.slice(3).map(line => ({ value: line.value, status: line.status })),
    [
      { value: 14553, status: 'matched' },
      { value: 144, status: 'matched' },
    ],
  )
  assert.deepEqual(
    attempts.map(({ stage, model, reasoningEffort }) => ({
      stage,
      model,
      reasoningEffort,
    })),
    [
      { stage: 'primary', model: 'gpt-5.6-luna', reasoningEffort: 'low' },
      { stage: 'verification', model: 'gpt-5.6-luna', reasoningEffort: 'none' },
    ],
  )
})

test('keeps unrepaired rows in review when a focused re-read is only partially useful', async () => {
  const result = await importGearImage({
    buffer: pngBuffer,
    mimeType: 'image/png',
    apiKey: 'test-key',
    fetchImpl: createSequentialFetch([
      { output_text: JSON.stringify(weaponMismatchExtraction) },
      {
        output_text: JSON.stringify({
          lines: [
            { rowNumber: 4, rawText: 'Lv. 2 Basic Stats +14553 [80%]' },
            { rowNumber: 5, rawText: 'Lv. 2 Basic Stats +14553 [80%]' },
          ],
        }),
      },
    ]),
  })

  assert.equal(result.lines[3].status, 'matched')
  assert.equal(result.lines[3].value, 14553)
  assert.equal(result.lines[4].status, 'needs_review')
  assert.equal(result.lines[4].value, 14)
})

test('can disable focused value verification for a full fallback pass', async () => {
  const requests = []
  const result = await importGearImage({
    buffer: pngBuffer,
    mimeType: 'image/png',
    apiKey: 'test-key',
    enableValueVerification: false,
    fetchImpl: createSequentialFetch([
      { output_text: JSON.stringify(weaponMismatchExtraction) },
    ], requests),
  })

  assert.equal(requests.length, 1)
  assert.equal(result.lines[3].status, 'needs_review')
  assert.equal(result.lines[4].status, 'needs_review')
})

test('runs the focused verifier only for isolated, legal value mismatches', async (t) => {
  const cases = [
    {
      name: 'unresolved equipment',
      extraction: { ...weaponMismatchExtraction, equipmentVisible: false },
    },
    {
      name: 'equipment hint conflict',
      extraction: weaponMismatchExtraction,
      gearHint: { gearType: '[9999] Armor', pieceType: 'Helmet' },
    },
    {
      name: 'mixed review reasons',
      extraction: {
        ...weaponMismatchExtraction,
        lines: [
          ...weaponMismatchExtraction.lines,
          createLine('Lv. 2 Dual Mystery +9 [50%]', 'Dual Mystery', 9, 50, 2),
        ],
      },
    },
    {
      name: 'too many active rows',
      extraction: {
        ...weaponMismatchExtraction,
        lines: [
          ...weaponMismatchExtraction.lines,
          createLine('Lv. 2 Dual Accuracy +80 [50%]', 'Dual Accuracy', 80, 50, 2),
          createLine('Lv. 2 Stamina +1000 [50%]', 'Stamina', 1000, 50, 2),
        ],
      },
    },
    {
      name: 'illegal enchant level',
      extraction: {
        ...weaponMismatchExtraction,
        lines: weaponMismatchExtraction.lines.map((line, index) =>
          index === 3 ? { ...line, level: 5, rawText: line.rawText.replace('Lv. 2', 'Lv. 5') } : line,
        ),
      },
    },
    {
      name: 'no active rows',
      extraction: { ...weaponMismatchExtraction, lines: [] },
    },
  ]

  for (const testCase of cases) {
    await t.test(testCase.name, async () => {
      const requests = []
      await importGearImage({
        buffer: pngBuffer,
        mimeType: 'image/png',
        gearHint: testCase.gearHint,
        apiKey: 'test-key',
        fetchImpl: createSequentialFetch([
          { output_text: JSON.stringify(testCase.extraction) },
        ], requests),
      })
      assert.equal(requests.length, 1)
    })
  }
})

test('preserves verifier failures by default and can propagate parser or upstream errors', async (t) => {
  const defaultResult = await importGearImage({
    buffer: pngBuffer,
    mimeType: 'image/png',
    apiKey: 'test-key',
    fetchImpl: createSequentialFetch([
      { output_text: JSON.stringify(weaponMismatchExtraction) },
      {},
    ]),
  })
  assert.equal(defaultResult.lines[3].status, 'needs_review')

  const failures = [
    {
      name: 'empty parser output',
      response: {},
      code: 'parser_empty',
    },
    {
      name: 'upstream response',
      response: new Response(JSON.stringify({ error: { message: 'unavailable' } }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      }),
      code: 'upstream_error',
    },
  ]

  for (const failure of failures) {
    await t.test(failure.name, async () => {
      await assert.rejects(
        importGearImage({
          buffer: pngBuffer,
          mimeType: 'image/png',
          apiKey: 'test-key',
          throwOnVerificationError: true,
          fetchImpl: createSequentialFetch([
            { output_text: JSON.stringify(weaponMismatchExtraction) },
            failure.response,
          ]),
        }),
        error => error instanceof GearImageImportError && error.code === failure.code,
      )
    })
  }
})

test('honors explicit model and reasoning overrides without letting telemetry fail imports', async () => {
  const requests = []
  const result = await importGearImage({
    buffer: pngBuffer,
    mimeType: 'image/png',
    apiKey: 'test-key',
    importModel: 'gpt-5.6-terra',
    importReasoningEffort: 'none',
    verificationModel: 'gpt-5.6-sol',
    verificationReasoningEffort: 'high',
    onModelAttempt: () => {
      throw new Error('telemetry unavailable')
    },
    fetchImpl: createSequentialFetch([
      { output_text: JSON.stringify(weaponMismatchExtraction) },
      {
        output_text: JSON.stringify({
          lines: [
            { rowNumber: 4, rawText: 'Lv. 2 Basic Stats +14553 [80%]' },
            { rowNumber: 5, rawText: 'Lv. 2 Dual Maximum Damage +144 [65%]' },
          ],
        }),
      },
    ], requests),
  })

  assert.deepEqual(
    requests.map(request => ({ model: request.model, reasoning: request.reasoning })),
    [
      { model: 'gpt-5.6-terra', reasoning: { effort: 'none' } },
      { model: 'gpt-5.6-sol', reasoning: { effort: 'high' } },
    ],
  )
  assert.equal(result.lines[3].status, 'matched')
  assert.equal(result.lines[4].status, 'matched')
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

function createSequentialFetch(responses, requests = []) {
  const queue = [...responses]
  return async (_url, init) => {
    requests.push(JSON.parse(init.body))
    const response = queue.shift()
    assert.notEqual(response, undefined, 'received an unexpected extra model request')
    return response instanceof Response ? response : jsonResponse(response)
  }
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
