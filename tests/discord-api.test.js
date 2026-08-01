import assert from 'node:assert/strict'
import test from 'node:test'
import {
  DiscordApiError,
  buildDiscordSuccessContent,
  discordImageLimits,
  downloadDiscordAttachment,
  editOriginalDiscordResponse,
  getDiscordFailureContent,
  getDiscordShareUrl,
  validateDiscordAttachment,
} from '../server/utils/discord-api.js'

function getAttachment(overrides = {}) {
  return {
    id: 'image',
    url: 'https://cdn.discordapp.com/attachments/channel/message/gear.png',
    content_type: 'image/png',
    size: 4,
    width: 2,
    height: 2,
    ...overrides,
  }
}

test('accepts bounded Discord CDN images and rejects SSRF, type, and size violations', () => {
  assert.equal(validateDiscordAttachment(getAttachment()).mimeType, 'image/png')

  assert.throws(
    () => validateDiscordAttachment(getAttachment({ url: 'https://example.com/gear.png' })),
    error => error.code === 'INVALID_ATTACHMENT_URL',
  )
  assert.throws(
    () => validateDiscordAttachment(getAttachment({ content_type: 'image/gif' })),
    error => error.code === 'INVALID_IMAGE_TYPE',
  )
  assert.throws(
    () => validateDiscordAttachment(getAttachment({ size: discordImageLimits.maxBytes + 1 })),
    error => error.code === 'IMAGE_TOO_LARGE',
  )
  assert.throws(
    () => validateDiscordAttachment(getAttachment({
      width: discordImageLimits.maxDimension + 1,
    })),
    error => error.code === 'IMAGE_DIMENSIONS_TOO_LARGE',
  )
})

test('downloads without redirects and returns the verified response MIME type', async () => {
  const fetchCalls = []
  const result = await downloadDiscordAttachment(getAttachment(), {
    fetchImpl: async (url, options) => {
      fetchCalls.push({ url, options })
      return new Response(new Uint8Array([1, 2, 3, 4]), {
        headers: {
          'content-type': 'image/png',
          'content-length': '4',
        },
      })
    },
  })

  assert.deepEqual(result.buffer, Buffer.from([1, 2, 3, 4]))
  assert.equal(result.mimeType, 'image/png')
  assert.equal(fetchCalls[0].url.hostname, 'cdn.discordapp.com')
  assert.equal(fetchCalls[0].options.redirect, 'error')
})

test('stops streaming a Discord response when it exceeds the byte limit', async () => {
  const oversizedChunk = new Uint8Array(discordImageLimits.maxBytes + 1)

  await assert.rejects(
    downloadDiscordAttachment(getAttachment(), {
      fetchImpl: async () => new Response(oversizedChunk, {
        headers: { 'content-type': 'image/png' },
      }),
    }),
    error => error instanceof DiscordApiError && error.code === 'IMAGE_TOO_LARGE',
  )
})

test('edits the original interaction with a PNG multipart body and no mentions', async () => {
  let request
  await editOriginalDiscordResponse({
    applicationId: 'application',
    interactionToken: 'interaction-token',
    content: 'Result',
    file: Buffer.from([137, 80, 78, 71]),
    fetchImpl: async (url, options) => {
      request = { url, options }
      return new Response('{}')
    },
  })

  assert.equal(
    request.url,
    'https://discord.com/api/v10/webhooks/application/interaction-token/messages/@original',
  )
  assert.equal(request.options.method, 'PATCH')
  assert.ok(request.options.body instanceof FormData)
  const payload = JSON.parse(request.options.body.get('payload_json'))
  assert.equal(payload.content, 'Result')
  assert.deepEqual(payload.allowed_mentions, { parse: [] })
  assert.deepEqual(payload.attachments, [{
    id: 0,
    filename: 'latale-gear-score.png',
    description: 'LaTale gear-score evaluation snapshot',
  }])
  assert.equal(request.options.body.get('files[0]').type, 'image/png')
})

test('builds a compact score summary and absolute calculator link', () => {
  const content = buildDiscordSuccessContent({
    gearType: '[9999] Armor',
    pieceType: 'Helmet',
    sharePath: '/?it=abc&el=5',
    snapshotPayload: {
      itemName: '[9999] Armor · Helmet',
      current: { value: '72%', tier: 'S', levelLabel: 'Lv.2' },
      projected: { value: '90%', tier: 'SS', levelLabel: 'Lv.5 Ascended' },
    },
  }, 'https://latale.example/calculator')

  assert.match(content, /Lv\\\.2: \*\*72%\*\* · \*\*S tier\*\*/)
  assert.match(content, /Lv\\\.5 Ascended: \*\*90%\*\* · \*\*SS tier\*\*/)
  assert.match(content, /\[Open in the calculator\]\(https:\/\/latale\.example\/\?it=abc&el=5\)/)
  assert.equal(
    getDiscordShareUrl('javascript:alert(1)', '/?it=abc', ''),
    '',
  )
})

test('turns review and image errors into actionable Discord guidance', () => {
  assert.match(
    getDiscordFailureContent({ code: 'equipment_unresolved' }),
    /equipment.*hint/i,
  )
  assert.match(
    getDiscordFailureContent({ code: 'lines_need_review' }),
    /did not score/i,
  )
  assert.equal(
    getDiscordFailureContent({ code: 'image_too_large', message: 'Image must be smaller than 8 MB.' }),
    'Image must be smaller than 8 MB.',
  )
})
