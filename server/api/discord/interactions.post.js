import {
  createError,
  defineEventHandler,
  getHeader,
  getRequestURL,
  readRawBody,
} from 'h3'
import {
  buildDiscordSuccessContent,
  downloadDiscordAttachment,
  editOriginalDiscordResponse,
  getDiscordFailureContent,
  getDiscordLimiterMessage,
} from '../../utils/discord-api.js'
import { registerDiscordBackgroundTask } from '../../utils/discord-background.js'
import {
  createDeferredDiscordResponse,
  createImmediateDiscordMessage,
  discordInteractionResponseType,
  discordInteractionType,
  parseGearScoreCommand,
} from '../../utils/discord-command.js'
import { discordJobLimiter } from '../../utils/discord-rate-limit.js'
import {
  discordInteractionReplayGuard,
  getDiscordSafetyIdentifier,
  verifyDiscordRequest,
} from '../../utils/discord-request.js'

const backgroundDeadlineMs = 210_000
const discordEditDeadlineMs = 15_000
const discordImageFallbackCodes = new Set([
  'parser_empty',
  'parser_invalid',
  'equipment_hint_conflict',
  'equipment_unresolved',
  'lines_missing',
  'lines_too_many',
  'lines_need_review',
  'stats_duplicated',
  'values_out_of_range',
])

export default defineEventHandler(async (event) => {
  const applicationId = process.env.DISCORD_APPLICATION_ID
  const publicKey = process.env.DISCORD_PUBLIC_KEY
  if (!applicationId || !publicKey) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Discord interactions are not configured.',
    })
  }

  const signature = getHeader(event, 'x-signature-ed25519')
  const timestamp = getHeader(event, 'x-signature-timestamp')
  const rawBody = await readRawBody(event, false)
  const isVerified = await verifyDiscordRequest({
    body: rawBody,
    signature,
    timestamp,
    publicKey,
  })
  if (!isVerified) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Invalid Discord request signature.',
    })
  }

  let interaction
  try {
    interaction = JSON.parse(rawBody.toString('utf8'))
  }
  catch {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid Discord interaction payload.',
    })
  }

  if (String(interaction.application_id || '') !== applicationId) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Discord application ID does not match.',
    })
  }

  if (interaction.type === discordInteractionType.ping) {
    return { type: discordInteractionResponseType.pong }
  }

  let command
  try {
    command = parseGearScoreCommand(interaction)
  }
  catch (error) {
    return createImmediateDiscordMessage(error.message)
  }

  const interactionId = String(interaction.id || '')
  if (!interactionId) {
    return createImmediateDiscordMessage('Discord did not provide a valid interaction ID.')
  }
  if (!discordInteractionReplayGuard.claim(interactionId)) {
    return discordInteractionReplayGuard.getResponse(interactionId)
      || createDeferredDiscordResponse(command.isPrivate)
  }

  const safetyIdentifier = getDiscordSafetyIdentifier(command.userId, applicationId)
  const lease = discordJobLimiter.acquire(safetyIdentifier)
  if (!lease.ok) {
    const response = createImmediateDiscordMessage(getDiscordLimiterMessage(lease))
    discordInteractionReplayGuard.setResponse(interactionId, response)
    return response
  }

  const publicSiteUrl = getPublicSiteUrl(event)
  let backgroundCancelled = false
  const backgroundTask = scheduleDiscordBackgroundTask(() => {
    if (backgroundCancelled) {
      return undefined
    }

    return processGearScoreInteraction({
      applicationId,
      interactionToken: interaction.token,
      attachment: command.attachment,
      gearHint: command.gearHint,
      safetyIdentifier,
      publicSiteUrl,
    })
  })
    .catch(error => logDiscordJob('background_failed', Date.now(), error))
    .finally(() => lease.release())

  try {
    registerDiscordBackgroundTask(event, backgroundTask)
  }
  catch (error) {
    backgroundCancelled = true
    lease.release()
    discordInteractionReplayGuard.release(interactionId)
    throw createError({
      statusCode: 500,
      statusMessage: error.message,
    })
  }

  const response = createDeferredDiscordResponse(command.isPrivate)
  discordInteractionReplayGuard.setResponse(interactionId, response)
  return response
})

export async function processGearScoreInteraction({
  applicationId,
  interactionToken,
  attachment,
  gearHint,
  safetyIdentifier,
  publicSiteUrl,
  importGearImageImpl,
  evaluateImportedGearImpl,
  renderGearSnapshotBufferImpl,
  downloadDiscordAttachmentImpl = downloadDiscordAttachment,
  editOriginalDiscordResponseImpl = editOriginalDiscordResponse,
  loadSnapshotItemImageImpl = loadSnapshotItemImage,
  loadSnapshotFontImpl = loadSnapshotFont,
  fallbackImportModel =
    process.env.OPENAI_IMAGE_IMPORT_FALLBACK_MODEL || 'gpt-5.6-sol',
  fallbackImportReasoningEffort =
    process.env.OPENAI_IMAGE_IMPORT_FALLBACK_REASONING_EFFORT || 'none',
  onModelAttemptImpl = logDiscordModelAttempt,
}) {
  const startedAt = Date.now()
  const signal = AbortSignal.timeout(backgroundDeadlineMs)

  try {
    const { buffer, mimeType } = await downloadDiscordAttachmentImpl(attachment, { signal })
    const importImage = importGearImageImpl
      || (await import('../../utils/gear-image-import-service.js')).importGearImage
    const evaluateGear = evaluateImportedGearImpl
      || (await import('../../../app/features/gear-score/gear-evaluation.js'))
        .evaluateImportedGear
    const importInput = {
      buffer,
      mimeType,
      gearHint,
      safetyIdentifier,
      signal,
    }
    let imported
    let evaluation
    let fallbackReason = null

    try {
      imported = await importImage({
        ...importInput,
        throwOnVerificationError: true,
        onModelAttempt: onModelAttemptImpl,
      })
      if (hasGearHintConflict(imported, gearHint)) {
        throw createGearHintConflictError()
      }
      evaluation = evaluateGear(imported)
    }
    catch (error) {
      if (!shouldRunImageFallback(error, signal)) {
        throw error
      }
      fallbackReason = error
    }

    if (fallbackReason) {
      imported = await importImage({
        ...importInput,
        importModel: fallbackImportModel,
        importReasoningEffort: fallbackImportReasoningEffort,
        enableValueVerification: false,
        enableSemanticVerification: false,
        trustPrimarySemanticReads: true,
        preferGearHint: true,
        onModelAttempt: attempt => onModelAttemptImpl({
          ...attempt,
          stage: 'fallback',
        }),
      })
      evaluation = evaluateGear(imported)
    }

    const [itemImageBuffer, geistFontBuffers] = await Promise.all([
      loadSnapshotItemImageImpl(evaluation.snapshotPayload),
      loadSnapshotFontImpl(),
    ])
    const renderSnapshot = renderGearSnapshotBufferImpl
      || (await import('../../utils/gear-snapshot.js')).renderGearSnapshotBuffer
    const snapshotBuffer = await renderSnapshot(
      evaluation.snapshotPayload,
      {
        ...(itemImageBuffer ? { itemImageBuffer } : {}),
        ...(geistFontBuffers?.length ? { geistFontBuffers } : {}),
      },
    )
    const content = buildDiscordSuccessContent(evaluation, publicSiteUrl)

    await editOriginalDiscordResponseImpl({
      applicationId,
      interactionToken,
      content,
      file: snapshotBuffer,
      signal: AbortSignal.timeout(discordEditDeadlineMs),
    })
    logDiscordJob('success', startedAt)
  }
  catch (error) {
    try {
      await editOriginalDiscordResponseImpl({
        applicationId,
        interactionToken,
        content: getDiscordFailureContent(error),
        signal: AbortSignal.timeout(discordEditDeadlineMs),
      })
    }
    catch (editError) {
      logDiscordJob('edit_failed', startedAt, editError)
    }
    logDiscordJob('evaluation_failed', startedAt, error)
  }
}

async function loadSnapshotItemImage(snapshotPayload) {
  const itemImageKey = String(snapshotPayload?.itemImageKey || '').split('/').pop()
  if (!itemImageKey) {
    return null
  }

  const itemImage = await useStorage('assets:gear-images').getItemRaw(itemImageKey)
  if (!itemImage) {
    return null
  }

  return Buffer.from(itemImage)
}

async function loadSnapshotFont() {
  const storage = useStorage('assets:snapshot-fonts')
  const fontBuffers = await Promise.all(
    [400, 500, 600, 700, 800, 900].map(async (weight) => {
      const font = await storage.getItemRaw(`geist-latin-${weight}-normal.woff2`)
      return font ? Buffer.from(font) : null
    }),
  )
  return fontBuffers.filter(Boolean)
}

export function scheduleDiscordBackgroundTask(task, schedule = setTimeout) {
  return new Promise((resolve) => {
    schedule(resolve, 0)
  }).then(task)
}

function getPublicSiteUrl(event) {
  const configuredUrl = process.env.NUXT_PUBLIC_SITE_URL
    || process.env.VERCEL_PROJECT_PRODUCTION_URL
    || process.env.VERCEL_URL
  if (configuredUrl) {
    return /^[a-z][a-z\d+.-]*:\/\//i.test(configuredUrl)
      ? configuredUrl
      : `https://${configuredUrl}`
  }

  return getRequestURL(event).origin
}

function logDiscordJob(outcome, startedAt, error) {
  const elapsedMs = Math.max(0, Date.now() - startedAt)
  const code = String(error?.code || error?.name || (outcome === 'success' ? 'OK' : 'UNKNOWN'))
  console.info('[discord-gear-score]', { outcome, code, elapsedMs })
}

function shouldRunImageFallback(error, signal) {
  return !signal?.aborted && discordImageFallbackCodes.has(String(error?.code || ''))
}

function hasGearHintConflict(imported, gearHint) {
  return Boolean(
    gearHint?.gearType
    && gearHint?.pieceType
    && imported?.equipment?.source === 'image'
    && (
      imported?.gearType !== gearHint.gearType
      || imported?.pieceType !== gearHint.pieceType
    ),
  )
}

function createGearHintConflictError() {
  const error = new Error('The screenshot equipment does not match the selected hint.')
  error.name = 'GearImageImportError'
  error.code = 'equipment_hint_conflict'
  error.statusCode = 422
  return error
}

function logDiscordModelAttempt(attempt) {
  const usage = attempt?.usage && typeof attempt.usage === 'object'
    ? {
        inputTokens: toTelemetryNumber(attempt.usage.inputTokens),
        cachedInputTokens: toTelemetryNumber(attempt.usage.cachedInputTokens),
        outputTokens: toTelemetryNumber(attempt.usage.outputTokens),
        reasoningTokens: toTelemetryNumber(attempt.usage.reasoningTokens),
        totalTokens: toTelemetryNumber(attempt.usage.totalTokens),
      }
    : null

  console.info('[discord-gear-score-model]', {
    stage: String(attempt?.stage || ''),
    model: String(attempt?.model || ''),
    reasoningEffort: String(attempt?.reasoningEffort || ''),
    elapsedMs: toTelemetryNumber(attempt?.elapsedMs),
    usage,
  })
}

function toTelemetryNumber(value) {
  const number = Number(value)
  return Number.isFinite(number) && number >= 0 ? Math.trunc(number) : 0
}
