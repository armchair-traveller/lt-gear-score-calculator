const discordApiBaseUrl = 'https://discord.com/api/v10'
const allowedAttachmentHosts = new Set([
  'cdn.discordapp.com',
  'media.discordapp.net',
])

export const discordImageLimits = Object.freeze({
  maxBytes: 8 * 1024 * 1024,
  maxDimension: 8192,
  maxPixels: 20_000_000,
})

const allowedImageTypes = new Set(['image/png', 'image/jpeg', 'image/webp'])

export function validateDiscordAttachment(attachment) {
  const mimeType = normalizeMimeType(attachment?.content_type)
  if (!allowedImageTypes.has(mimeType)) {
    throw new DiscordApiError(
      'INVALID_IMAGE_TYPE',
      'Use a PNG, JPEG, or WebP image.',
    )
  }

  const size = Number(attachment?.size)
  if (!Number.isFinite(size) || size <= 0) {
    throw new DiscordApiError(
      'INVALID_IMAGE',
      'The attached image is empty or does not have a readable size.',
    )
  }
  if (size > discordImageLimits.maxBytes) {
    throw new DiscordApiError(
      'IMAGE_TOO_LARGE',
      'Image must be smaller than 8 MB.',
    )
  }

  const width = Number(attachment?.width)
  const height = Number(attachment?.height)
  if (
    (Number.isFinite(width) && width > discordImageLimits.maxDimension)
    || (Number.isFinite(height) && height > discordImageLimits.maxDimension)
    || (
      Number.isFinite(width)
      && Number.isFinite(height)
      && width > 0
      && height > 0
      && width * height > discordImageLimits.maxPixels
    )
  ) {
    throw new DiscordApiError(
      'IMAGE_DIMENSIONS_TOO_LARGE',
      'Image dimensions are too large. Use an image no larger than 8192px per side.',
    )
  }

  let url
  try {
    url = new URL(attachment.url)
  }
  catch {
    throw new DiscordApiError('INVALID_ATTACHMENT_URL', 'Discord returned an invalid attachment URL.')
  }
  if (url.protocol !== 'https:' || !allowedAttachmentHosts.has(url.hostname)) {
    throw new DiscordApiError('INVALID_ATTACHMENT_URL', 'Discord returned an unsupported attachment URL.')
  }

  return {
    mimeType,
    size,
    url,
  }
}

export async function downloadDiscordAttachment(
  attachment,
  {
    fetchImpl = fetch,
    signal,
  } = {},
) {
  const validated = validateDiscordAttachment(attachment)
  const timeoutSignal = AbortSignal.timeout(30_000)
  const requestSignal = signal
    ? AbortSignal.any([signal, timeoutSignal])
    : timeoutSignal
  let response

  try {
    response = await fetchImpl(validated.url, {
      method: 'GET',
      redirect: 'error',
      signal: requestSignal,
      headers: {
        Accept: validated.mimeType,
      },
    })
  }
  catch (error) {
    if (requestSignal.aborted) {
      throw new DiscordApiError('IMAGE_DOWNLOAD_TIMEOUT', 'The image download timed out.', { cause: error })
    }
    throw new DiscordApiError('IMAGE_DOWNLOAD_FAILED', 'Could not download the Discord attachment.', {
      cause: error,
    })
  }

  if (!response.ok) {
    throw new DiscordApiError(
      'IMAGE_DOWNLOAD_FAILED',
      `Discord returned HTTP ${response.status} while downloading the image.`,
    )
  }

  const responseType = normalizeMimeType(response.headers.get('content-type'))
  if (responseType && !allowedImageTypes.has(responseType)) {
    throw new DiscordApiError(
      'INVALID_IMAGE_TYPE',
      'Discord returned a file that is not a PNG, JPEG, or WebP image.',
    )
  }

  const contentLength = Number(response.headers.get('content-length'))
  if (Number.isFinite(contentLength) && contentLength > discordImageLimits.maxBytes) {
    throw new DiscordApiError('IMAGE_TOO_LARGE', 'Image must be smaller than 8 MB.')
  }

  const buffer = await readBodyWithLimit(response, discordImageLimits.maxBytes)
  if (!buffer.length) {
    throw new DiscordApiError('INVALID_IMAGE', 'The attached image is empty.')
  }

  return {
    buffer,
    mimeType: responseType || validated.mimeType,
  }
}

export async function editOriginalDiscordResponse({
  applicationId,
  interactionToken,
  content,
  file,
  filename = 'latale-gear-score.png',
  fetchImpl = fetch,
  signal,
}) {
  const url = `${discordApiBaseUrl}/webhooks/${encodeURIComponent(applicationId)}/${encodeURIComponent(interactionToken)}/messages/@original`
  const payload = {
    content: String(content || ''),
    allowed_mentions: { parse: [] },
    attachments: file
      ? [{ id: 0, filename, description: 'LaTale gear-score evaluation snapshot' }]
      : [],
  }
  let body
  let headers

  if (file) {
    body = new FormData()
    body.append('payload_json', JSON.stringify(payload))
    body.append(
      'files[0]',
      new Blob([file], { type: 'image/png' }),
      filename,
    )
  }
  else {
    body = JSON.stringify(payload)
    headers = { 'Content-Type': 'application/json' }
  }

  const response = await fetchImpl(url, {
    method: 'PATCH',
    headers,
    body,
    signal,
  })
  if (!response.ok) {
    throw new DiscordApiError(
      'DISCORD_EDIT_FAILED',
      `Discord returned HTTP ${response.status} while editing the result.`,
    )
  }

  return response
}

export function buildDiscordSuccessContent(evaluation, publicSiteUrl = '') {
  const snapshot = evaluation?.snapshotPayload || {}
  const current = snapshot.current || {}
  const projected = snapshot.projected || null
  const lines = [
    `**${escapeDiscordMarkdown(snapshot.itemName || `${evaluation?.gearType || ''} · ${evaluation?.pieceType || ''}`)}**`,
    formatMetricLine(current),
  ]

  if (projected) {
    lines.push(formatMetricLine(projected, 'Estimated'))
  }

  const shareUrl = getDiscordShareUrl(publicSiteUrl, evaluation?.sharePath, evaluation?.shareQuery)
  if (shareUrl) {
    lines.push(`[Open in the calculator](${shareUrl})`)
  }

  return lines.filter(Boolean).join('\n')
}

export function getDiscordShareUrl(publicSiteUrl, sharePath, shareQuery) {
  if (!publicSiteUrl) {
    return ''
  }

  let base
  try {
    base = new URL(publicSiteUrl)
  }
  catch {
    return ''
  }
  if (!['http:', 'https:'].includes(base.protocol)) {
    return ''
  }

  const normalizedPath = String(sharePath || '').trim()
  if (normalizedPath) {
    return new URL(normalizedPath, base).toString()
  }

  const url = new URL('/', base)
  const query = String(shareQuery || '').replace(/^\?/, '')
  if (query) {
    url.search = query
  }
  return url.toString()
}

export function getDiscordFailureContent(error) {
  const code = String(error?.code || '')
  if ([
    'equipment_unresolved',
    'equipment_unsupported',
    'EQUIPMENT_NEEDS_REVIEW',
    'EQUIPMENT_NOT_RESOLVED',
    'INVALID_EQUIPMENT',
    'INVALID_EQUIPMENT_HINT',
  ].includes(code)) {
    return 'I could not identify the equipment confidently. Run `/gear-score` again and choose the **equipment** hint.'
  }

  if ([
    'lines_missing',
    'lines_too_many',
    'lines_need_review',
    'stats_duplicated',
    'values_out_of_range',
    'IMPORT_NEEDS_REVIEW',
    'OCR_NEEDS_REVIEW',
    'LINE_NEEDS_REVIEW',
    'DUPLICATE_STATS',
    'NO_VALID_LINES',
  ].includes(code)) {
    return 'I could not verify every enchant line safely, so I did not score this image. Use a tighter, higher-resolution crop and try again.'
  }

  if ([
    'image_missing',
    'image_type_unsupported',
    'image_too_large',
    'image_invalid',
    'image_type_mismatch',
    'image_animated',
    'image_dimensions_exceeded',
    'INVALID_IMAGE',
    'INVALID_IMAGE_TYPE',
    'IMAGE_TOO_LARGE',
    'IMAGE_DIMENSIONS_TOO_LARGE',
  ].includes(code)) {
    return error.message || 'Use a PNG, JPEG, or WebP image smaller than 8 MB.'
  }

  if (code === 'IMAGE_DOWNLOAD_TIMEOUT' || code === 'IMAGE_DOWNLOAD_FAILED') {
    return 'I could not download that attachment from Discord. Reattach the image and try again.'
  }

  if (
    code === 'import_timeout'
    || error?.name === 'AbortError'
    || error?.name === 'TimeoutError'
  ) {
    return 'The screenshot took too long to evaluate. Please try again with a tighter crop.'
  }

  return 'I could not evaluate that screenshot. Try a clear crop of one full equipment tooltip.'
}

export function getDiscordLimiterMessage(result) {
  if (result?.code === 'COOLDOWN') {
    return `Please wait ${result.retryAfterSeconds || 1} seconds before submitting another screenshot.`
  }
  if (result?.code === 'USER_ACTIVE') {
    return 'Your previous screenshot is still being evaluated. Please wait for that result.'
  }
  return 'The evaluator is handling other screenshots right now. Please try again shortly.'
}

async function readBodyWithLimit(response, maxBytes) {
  if (!response.body?.getReader) {
    const buffer = Buffer.from(await response.arrayBuffer())
    if (buffer.length > maxBytes) {
      throw new DiscordApiError('IMAGE_TOO_LARGE', 'Image must be smaller than 8 MB.')
    }
    return buffer
  }

  const reader = response.body.getReader()
  const chunks = []
  let totalBytes = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) {
      break
    }

    totalBytes += value.byteLength
    if (totalBytes > maxBytes) {
      await reader.cancel()
      throw new DiscordApiError('IMAGE_TOO_LARGE', 'Image must be smaller than 8 MB.')
    }
    chunks.push(Buffer.from(value))
  }

  return Buffer.concat(chunks, totalBytes)
}

function normalizeMimeType(value) {
  return String(value || '').split(';', 1)[0].trim().toLowerCase()
}

function formatMetricLine(metric, fallbackLabel = 'Current') {
  const label = escapeDiscordMarkdown(metric?.levelLabel || fallbackLabel)
  const value = escapeDiscordMarkdown(metric?.value || '—')
  const tier = String(metric?.tier || '').trim()
  return `${label}: **${value}**${tier ? ` · **${escapeDiscordMarkdown(tier)} tier**` : ''}`
}

function escapeDiscordMarkdown(value) {
  return String(value || '').replace(/([\\`*_{}[\]()#+\-.!|>])/g, '\\$1')
}

export class DiscordApiError extends Error {
  constructor(code, message, options) {
    super(message, options)
    this.name = 'DiscordApiError'
    this.code = code
  }
}
