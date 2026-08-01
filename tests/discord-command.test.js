import assert from 'node:assert/strict'
import test from 'node:test'
import {
  createDeferredDiscordResponse,
  createImmediateDiscordMessage,
  decodeDiscordEquipmentChoice,
  discordApplicationCommandOptionType,
  discordInteractionResponseType,
  discordMessageFlags,
  getDiscordEquipmentChoices,
  getGearScoreCommandDefinition,
  parseGearScoreCommand,
} from '../server/utils/discord-command.js'
import { createDiscordJobLimiter } from '../server/utils/discord-rate-limit.js'

test('registers one user-installed command with every supported equipment choice', () => {
  const command = getGearScoreCommandDefinition()
  const choices = getDiscordEquipmentChoices()

  assert.equal(command.name, 'gear-score')
  assert.deepEqual(command.integration_types, [1])
  assert.deepEqual(command.contexts, [0, 1, 2])
  assert.equal(choices.length, 23)
  assert.equal(new Set(choices.map(choice => choice.name)).size, choices.length)
  assert.equal(new Set(choices.map(choice => choice.value)).size, choices.length)
  assert.equal(
    command.options.find(option => option.name === 'image').type,
    discordApplicationCommandOptionType.attachment,
  )
  assert.deepEqual(
    command.options.find(option => option.name === 'equipment').choices,
    choices,
  )
  assert.equal(choices.some(choice => choice.name.includes('[5000] Accessories')), false)
  assert.equal(choices.some(choice => choice.name.includes('[4000] Weapon')), false)
})

test('decodes only catalog-backed equipment choices', () => {
  assert.deepEqual(
    decodeDiscordEquipmentChoice('[9999] Armor::Chestplate'),
    { gearType: '[9999] Armor', pieceType: 'Chestplate' },
  )
  assert.equal(decodeDiscordEquipmentChoice('[9999] Armor::Missing'), null)
  assert.equal(decodeDiscordEquipmentChoice('[5000] Accessories::Crystal'), null)
  assert.equal(decodeDiscordEquipmentChoice('[9999] Armor::Chestplate::extra'), null)
})

test('parses the attachment, equipment hint, privacy, and guild user', () => {
  const attachment = {
    id: 'attachment-1',
    url: 'https://cdn.discordapp.com/attachments/a/b/image.png',
    content_type: 'image/png',
    size: 128,
  }
  const parsed = parseGearScoreCommand({
    type: 2,
    member: { user: { id: 'user-1' } },
    data: {
      name: 'gear-score',
      options: [
        { type: 11, name: 'image', value: 'attachment-1' },
        { type: 3, name: 'equipment', value: '[9999] Armor::Chestplate' },
        { type: 5, name: 'private', value: true },
      ],
      resolved: {
        attachments: {
          'attachment-1': attachment,
        },
      },
    },
  })

  assert.equal(parsed.attachment, attachment)
  assert.deepEqual(parsed.gearHint, {
    gearType: '[9999] Armor',
    pieceType: 'Chestplate',
  })
  assert.equal(parsed.isPrivate, true)
  assert.equal(parsed.userId, 'user-1')
})

test('requires a resolved attachment and a valid generated equipment value', () => {
  assert.throws(
    () => parseGearScoreCommand({
      type: 2,
      data: {
        name: 'gear-score',
        options: [{ type: 11, name: 'image', value: 'missing' }],
        resolved: { attachments: {} },
      },
    }),
    error => error.code === 'MISSING_IMAGE',
  )

  assert.throws(
    () => parseGearScoreCommand({
      type: 2,
      data: {
        name: 'gear-score',
        options: [
          { type: 11, name: 'image', value: 'image' },
          { type: 3, name: 'equipment', value: 'invalid' },
        ],
        resolved: { attachments: { image: {} } },
      },
    }),
    error => error.code === 'INVALID_EQUIPMENT_HINT',
  )
})

test('deferred privacy is fixed on the initial Discord response', () => {
  assert.deepEqual(createDeferredDiscordResponse(false), {
    type: discordInteractionResponseType.deferredChannelMessage,
    data: {},
  })
  assert.deepEqual(createDeferredDiscordResponse(true), {
    type: discordInteractionResponseType.deferredChannelMessage,
    data: { flags: discordMessageFlags.ephemeral },
  })
  assert.deepEqual(createImmediateDiscordMessage('Try later.').data.allowed_mentions, {
    parse: [],
  })
})

test('warm-instance limiter enforces active, global, and cooldown limits', () => {
  const limiter = createDiscordJobLimiter({ cooldownMs: 30_000, maxActiveJobs: 2 })
  const first = limiter.acquire('one', 100_000)
  const second = limiter.acquire('two', 100_000)

  assert.equal(first.ok, true)
  assert.equal(second.ok, true)
  assert.equal(limiter.acquire('one', 100_001).code, 'USER_ACTIVE')
  assert.equal(limiter.acquire('three', 100_001).code, 'BUSY')

  first.release()
  assert.deepEqual(limiter.acquire('one', 110_000), {
    ok: false,
    code: 'COOLDOWN',
    retryAfterSeconds: 20,
  })

  const third = limiter.acquire('three', 110_000)
  assert.equal(third.ok, true)
  first.release()
  assert.equal(limiter.activeJobs, 2)
  second.release()
  third.release()
  assert.equal(limiter.activeJobs, 0)
})
