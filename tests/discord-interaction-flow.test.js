import assert from 'node:assert/strict'
import test from 'node:test'
import { processGearScoreInteraction } from '../server/api/discord/interactions.post.js'

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
