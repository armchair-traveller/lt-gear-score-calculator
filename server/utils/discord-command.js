import gears from '../../app/utils/gear.js'

export const discordInteractionType = Object.freeze({
  ping: 1,
  applicationCommand: 2,
})

export const discordInteractionResponseType = Object.freeze({
  pong: 1,
  channelMessage: 4,
  deferredChannelMessage: 5,
})

export const discordApplicationCommandOptionType = Object.freeze({
  string: 3,
  boolean: 5,
  attachment: 11,
})

export const discordMessageFlags = Object.freeze({
  ephemeral: 1 << 6,
})

export const gearScoreCommandName = 'gear-score'

const excludedGearCategories = new Set(['[5000] Accessories', '[4000] Weapon'])
const metadataKeys = new Set(['Sheet Link', 'Potential'])
const choiceSeparator = '::'

export function getDiscordEquipmentChoices(gearCatalog = gears) {
  return Object.entries(gearCatalog).flatMap(([gearType, pieces]) => {
    if (excludedGearCategories.has(gearType)) {
      return []
    }

    return Object.keys(pieces)
      .filter(pieceType => !metadataKeys.has(pieceType))
      .map(pieceType => ({
        name: `${gearType} · ${pieceType}`,
        value: encodeDiscordEquipmentChoice({ gearType, pieceType }),
      }))
  })
}

export function encodeDiscordEquipmentChoice({ gearType, pieceType }) {
  return `${gearType}${choiceSeparator}${pieceType}`
}

export function decodeDiscordEquipmentChoice(value, gearCatalog = gears) {
  const [gearType, pieceType, ...remainder] = String(value || '').split(choiceSeparator)
  const choices = gearCatalog?.[gearType]
  if (
    remainder.length
    || excludedGearCategories.has(gearType)
    || !choices
    || metadataKeys.has(pieceType)
    || !Object.hasOwn(choices, pieceType)
  ) {
    return null
  }

  return { gearType, pieceType }
}

export function getGearScoreCommandDefinition(gearCatalog = gears) {
  return {
    name: gearScoreCommandName,
    description: 'Evaluate a LaTale equipment screenshot and create a gear-score snapshot.',
    type: 1,
    integration_types: [1],
    contexts: [0, 1, 2],
    options: [
      {
        type: discordApplicationCommandOptionType.attachment,
        name: 'image',
        description: 'A PNG, JPEG, or WebP screenshot of one equipment tooltip.',
        required: true,
      },
      {
        type: discordApplicationCommandOptionType.string,
        name: 'equipment',
        description: 'Optional equipment hint when the item identity is cropped or unclear.',
        required: false,
        choices: getDiscordEquipmentChoices(gearCatalog),
      },
      {
        type: discordApplicationCommandOptionType.boolean,
        name: 'private',
        description: 'Only you can see the result. Defaults to false.',
        required: false,
      },
    ],
  }
}

export function parseGearScoreCommand(interaction, gearCatalog = gears) {
  if (
    interaction?.type !== discordInteractionType.applicationCommand
    || interaction?.data?.name !== gearScoreCommandName
  ) {
    throw new DiscordCommandError(
      'UNSUPPORTED_COMMAND',
      `Expected the /${gearScoreCommandName} command.`,
    )
  }

  const options = new Map(
    (Array.isArray(interaction.data.options) ? interaction.data.options : [])
      .filter(option => typeof option?.name === 'string')
      .map(option => [option.name, option]),
  )
  const imageOption = options.get('image')
  const attachmentId = String(imageOption?.value || '')
  const attachment = interaction.data.resolved?.attachments?.[attachmentId]
  if (
    imageOption?.type !== discordApplicationCommandOptionType.attachment
    || !attachmentId
    || !attachment
  ) {
    throw new DiscordCommandError(
      'MISSING_IMAGE',
      'Attach an equipment screenshot to the image option.',
    )
  }

  const equipmentOption = options.get('equipment')
  const gearHint = equipmentOption
    ? decodeDiscordEquipmentChoice(equipmentOption.value, gearCatalog)
    : null
  if (equipmentOption && !gearHint) {
    throw new DiscordCommandError(
      'INVALID_EQUIPMENT_HINT',
      'Choose a supported equipment hint from the command menu.',
    )
  }

  const privateOption = options.get('private')
  if (
    privateOption
    && (
      privateOption.type !== discordApplicationCommandOptionType.boolean
      || typeof privateOption.value !== 'boolean'
    )
  ) {
    throw new DiscordCommandError(
      'INVALID_PRIVATE_OPTION',
      'The private option must be true or false.',
    )
  }

  return {
    attachment,
    gearHint,
    isPrivate: privateOption?.value === true,
    userId: String(interaction.member?.user?.id || interaction.user?.id || ''),
  }
}

export function createDeferredDiscordResponse(isPrivate = false) {
  return {
    type: discordInteractionResponseType.deferredChannelMessage,
    data: isPrivate ? { flags: discordMessageFlags.ephemeral } : {},
  }
}

export function createImmediateDiscordMessage(content, { ephemeral = true } = {}) {
  return {
    type: discordInteractionResponseType.channelMessage,
    data: {
      content: String(content || ''),
      allowed_mentions: { parse: [] },
      ...(ephemeral ? { flags: discordMessageFlags.ephemeral } : {}),
    },
  }
}

export class DiscordCommandError extends Error {
  constructor(code, message) {
    super(message)
    this.name = 'DiscordCommandError'
    this.code = code
  }
}
