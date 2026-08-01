export const gearSnapshotWidth = 1200
const snapshotWidth = gearSnapshotWidth
const outerPadding = 40
const heroHeight = 310
const linePanelY = 354
const lineHeaderY = 452
const lineRowsY = 500
const lineRowHeight = 64
const linePanelBottomPadding = 14
const legalGap = 26
const legalHeight = 20

const grid = {
  left: 72,
  right: 1128,
  statText: 96,
  comparisonMiddle: 600,
  projected: {
    currentLeft: 488,
    currentCenter: 648,
    currentRight: 784,
    currentSeparator: 666,
    estimateLeft: 808,
    estimateCenter: 968,
    estimateRight: 1104,
    estimateSeparator: 986,
  },
  currentOnly: {
    currentLeft: 808,
    currentCenter: 968,
    currentRight: 1104,
    currentSeparator: 986,
  },
}

export const gearSnapshotAssets = Object.freeze({
  hero: 'https://static.latale.com/latale/Contents/2025/10/2025100111475855513.jpg',
})

const fonts = {
  display: '"Noto Sans KR", "Geist", Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  data: '"Geist", "Noto Sans KR", Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
}

const colors = {
  ink: '#4a2941',
  raw: '#4a3343',
  muted: '#806879',
  quiet: '#9d8594',
  white: '#ffffff',
  paper: '#fff7fa',
  soft: '#f7eff4',
  line: '#eddce5',
  current: '#5964a8',
  currentDisplay: '#5964a8',
  currentSoft: '#f0f1fc',
  currentLine: '#d8daf3',
  estimate: '#c63969',
  estimateDisplay: '#df5c86',
  estimateSoft: '#fff0f5',
  estimateLine: '#f2c5d7',
  itemFill: '#fffcf5',
  itemLine: '#e7c968',
}

const tierColors = {
  F: ['#f0edf3', '#696275', '#d8d2df'],
  E: ['#f0edf3', '#696275', '#d8d2df'],
  D: ['#e4f4ff', '#2879a9', '#b9def2'],
  C: ['#e5f8ee', '#218158', '#bce4cf'],
  B: ['#e7edff', '#315fb5', '#c3d1f4'],
  A: ['#fff4bc', '#806000', '#ead36a'],
  S: ['#f1ecfc', '#7362bf', '#d5c9ef'],
  SS: ['#ffeaf3', '#b9346d', '#f1bfd3'],
  SSS: ['#ffe4ef', '#c63969', '#f0b8ce'],
}

const discreteFontWeightContexts = new WeakSet()

function normalizeText(value, fallback = '—') {
  const text = String(value ?? '').trim()
  return text || fallback
}

function setFont(ctx, size, weight = 600, family = 'data') {
  const resolvedWeight = discreteFontWeightContexts.has(ctx)
    ? Math.min(900, Math.max(100, Math.round(Number(weight) / 100) * 100))
    : weight
  ctx.font = `${resolvedWeight} ${Math.max(1, size)}px ${fonts[family] ?? fonts.data}`
}

function drawRoundRect(ctx, x, y, width, height, radius) {
  const safeWidth = Math.max(0, width)
  const safeHeight = Math.max(0, height)
  const safeRadius = Math.max(0, Math.min(radius, safeWidth / 2, safeHeight / 2))

  ctx.beginPath()
  ctx.moveTo(x + safeRadius, y)
  ctx.lineTo(x + safeWidth - safeRadius, y)
  ctx.quadraticCurveTo(x + safeWidth, y, x + safeWidth, y + safeRadius)
  ctx.lineTo(x + safeWidth, y + safeHeight - safeRadius)
  ctx.quadraticCurveTo(x + safeWidth, y + safeHeight, x + safeWidth - safeRadius, y + safeHeight)
  ctx.lineTo(x + safeRadius, y + safeHeight)
  ctx.quadraticCurveTo(x, y + safeHeight, x, y + safeHeight - safeRadius)
  ctx.lineTo(x, y + safeRadius)
  ctx.quadraticCurveTo(x, y, x + safeRadius, y)
  ctx.closePath()
}

function fillRoundRect(ctx, x, y, width, height, radius, fill) {
  drawRoundRect(ctx, x, y, width, height, radius)
  ctx.fillStyle = fill
  ctx.fill()
}

function strokeRoundRect(ctx, x, y, width, height, radius, stroke = colors.line, lineWidth = 1) {
  drawRoundRect(ctx, x, y, width, height, radius)
  ctx.strokeStyle = stroke
  ctx.lineWidth = lineWidth
  ctx.stroke()
}

function drawPanel(ctx, x, y, width, height, options = {}) {
  const radius = options.radius ?? 28
  ctx.save()
  ctx.shadowColor = options.shadowColor ?? 'rgba(82, 48, 68, 0.09)'
  ctx.shadowBlur = options.shadowBlur ?? 24
  ctx.shadowOffsetY = options.shadowOffsetY ?? 7
  fillRoundRect(ctx, x, y, width, height, radius, options.fill ?? colors.white)
  ctx.restore()
  strokeRoundRect(ctx, x, y, width, height, radius, options.stroke ?? colors.line)
}

function fitText(ctx, value, maxWidth, options = {}) {
  const normalized = normalizeText(value, options.fallback ?? '—')
  const family = options.family ?? 'data'
  const weight = options.weight ?? 600
  const minimumSize = Math.max(8, options.minSize ?? 12)
  let size = Math.max(minimumSize, options.size ?? 24)

  setFont(ctx, size, weight, family)
  while (size > minimumSize && ctx.measureText(normalized).width > maxWidth) {
    size -= 1
    setFont(ctx, size, weight, family)
  }

  if (ctx.measureText(normalized).width <= maxWidth) {
    return { text: normalized, size, width: ctx.measureText(normalized).width }
  }

  const characters = Array.from(normalized)
  const ellipsis = '…'
  let low = 0
  let high = characters.length
  let best = ellipsis

  while (low <= high) {
    const middle = Math.floor((low + high) / 2)
    const candidate = `${characters.slice(0, middle).join('').trimEnd()}${ellipsis}`
    if (ctx.measureText(candidate).width <= maxWidth) {
      best = candidate
      low = middle + 1
    }
    else {
      high = middle - 1
    }
  }

  return { text: best, size, width: ctx.measureText(best).width }
}

function drawFittedText(ctx, value, x, y, maxWidth, options = {}) {
  const fitted = fitText(ctx, value, Math.max(1, maxWidth), options)
  setFont(ctx, fitted.size, options.weight ?? 600, options.family ?? 'data')
  ctx.fillStyle = options.color ?? colors.ink
  ctx.textAlign = options.align ?? 'left'
  ctx.textBaseline = options.baseline ?? 'alphabetic'
  ctx.fillText(fitted.text, x, y)
  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'
  return fitted
}

function drawMetricPair(ctx, value, metric, rightX, y, maxWidth, options = {}) {
  const leftX = rightX - maxWidth
  const separatorX = options.separatorX ?? leftX + maxWidth / 2
  const separatorGap = options.separatorGap ?? 20
  const valueRight = separatorX - separatorGap
  const metricLeft = separatorX + separatorGap
  const sharedOptions = {
    family: options.family ?? 'data',
    minSize: options.minSize ?? 12,
    size: options.size ?? 21,
  }

  const valueLayout = drawFittedText(ctx, value, valueRight, y, valueRight - leftX, {
    ...sharedOptions,
    align: 'right',
    color: options.valueColor ?? colors.ink,
    weight: options.valueWeight ?? 650,
  })
  const metricLayout = drawFittedText(ctx, metric, rightX, y, rightX - metricLeft, {
    ...sharedOptions,
    align: 'right',
    color: options.metricColor ?? colors.current,
    weight: options.metricWeight ?? 760,
  })

  return { metricLayout, valueLayout }
}

function drawMetricSubheaders(ctx, metricWord, rightX, y, maxWidth, separatorX) {
  const leftX = rightX - maxWidth
  const separatorGap = 20
  const valueRight = separatorX - separatorGap
  const metricLeft = separatorX + separatorGap
  const options = {
    align: 'center',
    color: colors.quiet,
    minSize: 9,
    size: 11,
    weight: 750,
  }

  drawFittedText(ctx, 'ROLL', (leftX + valueRight) / 2, y, valueRight - leftX, options)
  drawFittedText(ctx, metricWord, (metricLeft + rightX) / 2, y, rightX - metricLeft, options)
}

function getPillLayout(ctx, text, options = {}) {
  const height = options.height ?? 34
  const paddingX = options.paddingX ?? 14
  const maxWidth = Math.max(24, options.maxWidth ?? 200)
  const fitted = fitText(ctx, text, maxWidth - paddingX * 2, {
    size: options.size ?? 15,
    minSize: options.minSize ?? 11,
    weight: options.weight ?? 800,
  })
  const width = Math.min(maxWidth, Math.max(options.minWidth ?? 0, Math.ceil(fitted.width + paddingX * 2)))
  return { ...fitted, width, height }
}

function drawPill(ctx, text, anchorX, y, options = {}) {
  const layout = getPillLayout(ctx, text, options)
  let x = anchorX
  if (options.align === 'right') {
    x -= layout.width
  }
  else if (options.align === 'center') {
    x -= layout.width / 2
  }

  fillRoundRect(ctx, x, y, layout.width, layout.height, layout.height / 2, options.fill ?? colors.soft)
  if (options.stroke) {
    strokeRoundRect(ctx, x, y, layout.width, layout.height, layout.height / 2, options.stroke)
  }

  setFont(ctx, layout.size, options.weight ?? 800)
  ctx.fillStyle = options.color ?? colors.ink
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(layout.text, x + layout.width / 2, y + layout.height / 2)
  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'
  return { ...layout, x }
}

function getTierPalette(tier) {
  const firstTier = normalizeText(tier, 'F').split(/\s+/)[0]
  return tierColors[firstTier] ?? tierColors.F
}

function drawTierPill(ctx, tier, anchorX, y, options = {}) {
  const [fill, color, stroke] = getTierPalette(tier)
  return drawPill(ctx, tier, anchorX, y, {
    align: options.align ?? 'left',
    fill,
    color,
    stroke,
    height: options.height ?? 36,
    maxWidth: options.maxWidth ?? 150,
    minWidth: options.minWidth ?? 58,
    paddingX: options.paddingX ?? 14,
    size: options.size ?? 17,
    minSize: options.minSize ?? 11,
  })
}

function drawImageCover(ctx, image, x, y, width, height, positionX = 0.5, positionY = 0.5) {
  const imageWidth = image?.naturalWidth || image?.width || 0
  const imageHeight = image?.naturalHeight || image?.height || 0
  if (!imageWidth || !imageHeight) {
    return false
  }

  const scale = Math.max(width / imageWidth, height / imageHeight)
  const sourceWidth = width / scale
  const sourceHeight = height / scale
  const sourceX = Math.max(0, Math.min(imageWidth - sourceWidth, (imageWidth - sourceWidth) * positionX))
  const sourceY = Math.max(0, Math.min(imageHeight - sourceHeight, (imageHeight - sourceHeight) * positionY))

  ctx.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, x, y, width, height)
  return true
}

function drawCanvasBackground(ctx, height) {
  const wash = ctx.createLinearGradient(0, 0, snapshotWidth, height)
  wash.addColorStop(0, '#fff9fb')
  wash.addColorStop(0.5, colors.paper)
  wash.addColorStop(1, '#faf3f8')
  ctx.fillStyle = wash
  ctx.fillRect(0, 0, snapshotWidth, height)
}

function drawHeroBackdrop(ctx, image) {
  const fallback = ctx.createLinearGradient(0, 0, snapshotWidth, heroHeight)
  fallback.addColorStop(0, '#fff1f6')
  fallback.addColorStop(0.56, '#f9cde2')
  fallback.addColorStop(1, '#ef91bd')
  ctx.fillStyle = fallback
  ctx.fillRect(0, 0, snapshotWidth, heroHeight)

  if (image) {
    drawImageCover(ctx, image, 0, 0, snapshotWidth, heroHeight, 0.5, 0.5)
  }

  ctx.fillStyle = 'rgba(255, 255, 255, 0.08)'
  ctx.fillRect(0, 0, snapshotWidth, heroHeight)

  const identityFade = ctx.createLinearGradient(0, 0, 760, 0)
  identityFade.addColorStop(0, 'rgba(255, 249, 252, 0.98)')
  identityFade.addColorStop(0.68, 'rgba(255, 249, 252, 0.83)')
  identityFade.addColorStop(1, 'rgba(255, 249, 252, 0)')
  ctx.fillStyle = identityFade
  ctx.fillRect(0, 0, 760, heroHeight)
}

function drawItemArtwork(ctx, itemImage, x, y, size = 96) {
  ctx.save()
  ctx.shadowColor = 'rgba(78, 47, 64, 0.11)'
  ctx.shadowBlur = 16
  ctx.shadowOffsetY = 4
  fillRoundRect(ctx, x, y, size, size, 18, colors.itemFill)
  ctx.restore()
  strokeRoundRect(ctx, x, y, size, size, 18, colors.itemLine, 1.5)

  if (itemImage) {
    ctx.save()
    ctx.imageSmoothingEnabled = false
    const inset = Math.round(size * 0.11)
    ctx.drawImage(itemImage, x + inset, y + inset, size - inset * 2, size - inset * 2)
    ctx.restore()
    return
  }

  drawFittedText(ctx, '?', x + size / 2, y + size * 0.66, 50, {
    align: 'center',
    family: 'display',
    size: 32,
    minSize: 28,
    weight: 800,
    color: colors.quiet,
  })
}

function drawScoreHalf(ctx, result, x, options = {}) {
  const isEstimate = options.kind === 'estimate'
  const accent = isEstimate ? colors.estimate : colors.current
  const display = isEstimate ? colors.estimateDisplay : colors.currentDisplay

  const label = drawPill(ctx, options.label, x, 260, {
    fill: accent,
    color: colors.white,
    height: 30,
    maxWidth: 190,
    paddingX: 13,
    size: 12,
    minSize: 11,
    weight: 850,
  })

  drawFittedText(ctx, result?.levelLabel, label.x + label.width + 14, 281, 180, {
    size: 13,
    minSize: 11,
    weight: 720,
    color: colors.muted,
  })

  const value = drawFittedText(ctx, result?.value, x, 346, 300, {
    family: 'display',
    size: 52,
    minSize: 34,
    weight: 820,
    color: display,
  })
  if (result?.tier) {
    drawTierPill(ctx, result.tier, x + value.width + 22, 310, {
      maxWidth: 150,
      height: 38,
      size: 18,
    })
  }
}

function drawSummaryContent(ctx, payload, itemImage) {
  const hasProjection = Boolean(payload.projected)
  const metricWord = payload.metricMode === 'rating' ? 'RATING' : 'SCORE'

  drawItemArtwork(ctx, itemImage, 64, 48, 94)
  drawFittedText(ctx, payload.itemName, 184, 107, 360, {
    family: 'display',
    size: 32,
    minSize: 22,
    weight: 800,
    color: colors.ink,
  })

  drawPanel(ctx, 64, 236, hasProjection ? 1072 : 536, 150, {
    fill: colors.white,
    stroke: colors.line,
    radius: 36,
    shadowColor: 'rgba(82, 43, 68, 0.13)',
    shadowBlur: 26,
    shadowOffsetY: 9,
  })

  if (hasProjection) {
    ctx.fillStyle = colors.line
    ctx.fillRect(grid.comparisonMiddle, 260, 1, 102)
  }

  drawScoreHalf(ctx, payload.current, 96, {
    kind: 'current',
    label: `CURRENT ${metricWord}`,
  })

  if (hasProjection) {
    drawScoreHalf(ctx, payload.projected, 632, {
      kind: 'estimate',
      label: `ESTIMATED ${metricWord}`,
    })
  }
}

function drawProjectedLine(ctx, line, y) {
  drawFittedText(ctx, line.stat, grid.statText, y + 39, 368, {
    size: 19,
    minSize: 15,
    weight: 700,
    color: colors.ink,
  })
  drawMetricPair(ctx, line.value, line.currentMetric, grid.projected.currentRight, y + 39, 272, {
    size: 18,
    minSize: 12,
    valueColor: colors.raw,
    metricColor: colors.current,
    separatorX: grid.projected.currentSeparator,
  })
  drawMetricPair(ctx, line.projectedValue, line.projectedMetric, grid.projected.estimateRight, y + 39, 272, {
    size: 18,
    minSize: 12,
    valueColor: colors.raw,
    metricColor: colors.estimate,
    separatorX: grid.projected.estimateSeparator,
  })
}

function drawCurrentLine(ctx, line, y) {
  drawFittedText(ctx, line.stat, grid.statText, y + 39, 620, {
    size: 19,
    minSize: 15,
    weight: 700,
    color: colors.ink,
  })
  drawMetricPair(ctx, line.value, line.currentMetric, grid.currentOnly.currentRight, y + 39, 272, {
    size: 18,
    minSize: 12,
    valueColor: colors.raw,
    metricColor: colors.current,
    separatorX: grid.currentOnly.currentSeparator,
  })
}

function drawLineSection(ctx, payload, rowsY) {
  const lines = payload.lines
  const hasProjection = Boolean(payload.projected)
  const metricWord = payload.metricMode === 'rating' ? 'RATING' : 'SCORE'
  const panelHeight = rowsY - linePanelY + lines.length * lineRowHeight + linePanelBottomPadding

  drawPanel(ctx, outerPadding, linePanelY, snapshotWidth - outerPadding * 2, panelHeight, {
    fill: colors.white,
    stroke: colors.line,
    radius: 28,
    shadowColor: 'rgba(80, 45, 66, 0.09)',
    shadowBlur: 24,
    shadowOffsetY: 7,
  })

  drawFittedText(ctx, 'Enchant rolls', grid.left, linePanelY + 79, 300, {
    family: 'display',
    size: 28,
    minSize: 22,
    weight: 800,
    color: colors.ink,
  })
  drawFittedText(ctx, 'STAT', grid.statText, lineHeaderY + 33, 250, {
    size: 12,
    minSize: 10,
    weight: 850,
    color: colors.quiet,
  })

  if (hasProjection) {
    fillRoundRect(ctx, grid.projected.currentLeft, lineHeaderY, 320, 42, 15, colors.currentSoft)
    strokeRoundRect(ctx, grid.projected.currentLeft, lineHeaderY, 320, 42, 15, colors.currentLine)
    fillRoundRect(ctx, grid.projected.estimateLeft, lineHeaderY, 320, 42, 15, colors.estimateSoft)
    strokeRoundRect(ctx, grid.projected.estimateLeft, lineHeaderY, 320, 42, 15, colors.estimateLine)

    drawFittedText(ctx, 'CURRENT', grid.projected.currentCenter, lineHeaderY + 16, 272, {
      align: 'center',
      size: 12,
      minSize: 10,
      weight: 850,
      color: colors.current,
    })
    drawMetricSubheaders(
      ctx,
      metricWord,
      grid.projected.currentRight,
      lineHeaderY + 34,
      272,
      grid.projected.currentSeparator,
    )
    drawFittedText(ctx, 'ESTIMATED', grid.projected.estimateCenter, lineHeaderY + 16, 272, {
      align: 'center',
      size: 12,
      minSize: 10,
      weight: 850,
      color: colors.estimate,
    })
    drawMetricSubheaders(
      ctx,
      metricWord,
      grid.projected.estimateRight,
      lineHeaderY + 34,
      272,
      grid.projected.estimateSeparator,
    )
  }
  else {
    fillRoundRect(ctx, grid.currentOnly.currentLeft, lineHeaderY, 320, 42, 15, colors.currentSoft)
    strokeRoundRect(ctx, grid.currentOnly.currentLeft, lineHeaderY, 320, 42, 15, colors.currentLine)
    drawFittedText(ctx, 'CURRENT', grid.currentOnly.currentCenter, lineHeaderY + 16, 272, {
      align: 'center',
      size: 12,
      minSize: 10,
      weight: 850,
      color: colors.current,
    })
    drawMetricSubheaders(
      ctx,
      metricWord,
      grid.currentOnly.currentRight,
      lineHeaderY + 34,
      272,
      grid.currentOnly.currentSeparator,
    )
  }

  ctx.fillStyle = colors.line
  ctx.fillRect(grid.left, rowsY - 1, grid.right - grid.left, 1)

  lines.forEach((line, index) => {
    const rowY = rowsY + index * lineRowHeight
    if (index > 0) {
      ctx.fillStyle = colors.line
      ctx.fillRect(grid.left, rowY, grid.right - grid.left, 1)
    }

    if (hasProjection) {
      drawProjectedLine(ctx, line, rowY)
    }
    else {
      drawCurrentLine(ctx, line, rowY)
    }
  })
}

function drawLegalLine(ctx, y) {
  drawFittedText(ctx, 'Unofficial calculator  ·  LaTale artwork © Actoz Soft', snapshotWidth / 2, y, snapshotWidth - outerPadding * 2, {
    align: 'center',
    size: 12,
    minSize: 10,
    weight: 550,
    color: colors.quiet,
  })
}

export function getGearSnapshotLayout(lineCount) {
  const safeLineCount = Math.max(0, Math.min(5, Number.isFinite(Number(lineCount)) ? Math.trunc(Number(lineCount)) : 0))
  const panelHeight = lineRowsY - linePanelY + safeLineCount * lineRowHeight + linePanelBottomPadding
  const legalY = linePanelY + panelHeight + legalGap
  return {
    width: snapshotWidth,
    height: legalY + legalHeight,
    legalY,
    linesY: lineRowsY,
    lineCount: safeLineCount,
  }
}

export function normalizeGearSnapshotPayload(payload) {
  return {
    ...(payload ?? {}),
    current: payload?.current ?? {},
    projected: payload?.projected ?? null,
    lines: Array.isArray(payload?.lines) ? payload.lines.slice(0, 5) : [],
  }
}

export function drawGearSnapshot(ctx, payload, assets = {}) {
  if (!ctx) {
    throw new Error('Canvas 2D is not available.')
  }

  const normalizedPayload = normalizeGearSnapshotPayload(payload)
  const layout = getGearSnapshotLayout(normalizedPayload.lines.length)

  ctx.textBaseline = 'alphabetic'
  ctx.imageSmoothingEnabled = true
  if ('imageSmoothingQuality' in ctx) {
    ctx.imageSmoothingQuality = 'high'
  }

  drawCanvasBackground(ctx, layout.height)
  drawHeroBackdrop(ctx, assets.hero ?? null)
  drawLineSection(ctx, normalizedPayload, layout.linesY)
  drawSummaryContent(ctx, normalizedPayload, assets.item ?? null)
  drawLegalLine(ctx, layout.legalY)

  return {
    layout,
    payload: normalizedPayload,
  }
}

async function loadSnapshotAsset(loadImage, source) {
  if (!source || typeof loadImage !== 'function') {
    return null
  }

  try {
    return await loadImage(source)
  }
  catch {
    return null
  }
}

export async function renderGearSnapshotCanvas(payload, options = {}) {
  if (typeof options.createCanvas !== 'function') {
    throw new TypeError('A canvas factory is required.')
  }

  const normalizedPayload = normalizeGearSnapshotPayload(payload)
  const layout = getGearSnapshotLayout(normalizedPayload.lines.length)
  const canvas = await options.createCanvas(layout.width, layout.height)

  if (!canvas) {
    throw new Error('Canvas is not available.')
  }

  canvas.width = layout.width
  canvas.height = layout.height
  const ctx = canvas.getContext?.('2d') ?? null
  if (!ctx) {
    throw new Error('Canvas 2D is not available.')
  }
  if (options.discreteFontWeights) {
    discreteFontWeightContexts.add(ctx)
  }

  const explicitAssets = options.assets ?? {}
  const hasExplicitHero = Object.prototype.hasOwnProperty.call(explicitAssets, 'hero')
  const hasExplicitItem = Object.prototype.hasOwnProperty.call(explicitAssets, 'item')
  const [heroImage, itemImage] = await Promise.all([
    hasExplicitHero
      ? explicitAssets.hero
      : loadSnapshotAsset(options.loadImage, options.heroSource ?? gearSnapshotAssets.hero),
    hasExplicitItem
      ? explicitAssets.item
      : loadSnapshotAsset(options.loadImage, normalizedPayload.itemImage),
  ])

  drawGearSnapshot(ctx, normalizedPayload, {
    hero: heroImage,
    item: itemImage,
  })
  return canvas
}
