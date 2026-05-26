const snapshotWidth = 1200
const snapshotPadding = 56
const colors = {
  bgTop: '#101114',
  bgBottom: '#191a1f',
  panel: '#f7f5ef',
  panelWarm: '#fff8ea',
  ink: '#15161a',
  muted: '#62646d',
  faint: '#d9d4c8',
  line: '#c9c2b4',
  gold: '#d8a445',
  amber: '#f2c76e',
  emerald: '#29a474',
  blue: '#4f8edc',
  rose: '#e36079',
  red: '#e5484d',
  darkPanel: '#202126',
  darkLine: '#32343b',
  white: '#fffaf0',
}

const tierColors = {
  F: ['#ece7dd', '#6d6a63'],
  E: ['#ece7dd', '#6d6a63'],
  D: ['#dff1ff', '#1c6fa7'],
  C: ['#dff8e8', '#167b51'],
  B: ['#e1ecff', '#2360b4'],
  A: ['#fff2c9', '#9a6500'],
  S: ['#f8e4ff', '#a234b2'],
  SS: ['#ffe0e9', '#bf3154'],
  SSS: ['#ffe0df', '#c3202d'],
}

function getCanvasContext() {
  const canvas = document.createElement('canvas')
  canvas.width = snapshotWidth
  canvas.height = 1600
  return [canvas, canvas.getContext('2d')]
}

function setFont(ctx, size, weight = 500) {
  ctx.font = `${weight} ${size}px Geist, Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`
}

function drawRoundRect(ctx, x, y, width, height, radius) {
  ctx.beginPath()
  ctx.moveTo(x + radius, y)
  ctx.lineTo(x + width - radius, y)
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius)
  ctx.lineTo(x + width, y + height - radius)
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height)
  ctx.lineTo(x + radius, y + height)
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius)
  ctx.lineTo(x, y + radius)
  ctx.quadraticCurveTo(x, y, x + radius, y)
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

function drawLabel(ctx, text, x, y, color = colors.muted) {
  setFont(ctx, 22, 700)
  ctx.fillStyle = color
  ctx.letterSpacing = '0px'
  ctx.fillText(String(text).toUpperCase(), x, y)
}

function drawFittedText(ctx, text, x, y, maxWidth, size, weight = 600, color = colors.ink) {
  setFont(ctx, size, weight)
  ctx.fillStyle = color

  const normalized = String(text || '-')
  if (ctx.measureText(normalized).width <= maxWidth) {
    ctx.fillText(normalized, x, y)
    return
  }

  let shortened = normalized
  while (shortened.length > 1 && ctx.measureText(`${shortened}...`).width > maxWidth) {
    shortened = shortened.slice(0, -1)
  }

  ctx.fillText(`${shortened}...`, x, y)
}

function drawCenteredFittedText(ctx, text, centerX, y, maxWidth, size, weight = 600, color = colors.ink) {
  setFont(ctx, size, weight)
  ctx.fillStyle = color

  const normalized = String(text || '-')
  let output = normalized
  if (ctx.measureText(output).width > maxWidth) {
    while (output.length > 1 && ctx.measureText(`${output}...`).width > maxWidth) {
      output = output.slice(0, -1)
    }
    output = `${output}...`
  }

  ctx.textAlign = 'center'
  ctx.fillText(output, centerX, y)
  ctx.textAlign = 'left'
}

function getBadgeWidth(ctx, text, options = {}) {
  const paddingX = options.paddingX ?? 18
  setFont(ctx, options.size ?? 20, 800)
  return Math.ceil(ctx.measureText(String(text || '-')).width + paddingX * 2)
}

function drawBadge(ctx, text, x, y, options = {}) {
  const normalized = String(text || '-')
  const firstTier = normalized.split(' ')[0]
  const [bg, fg] = options.palette ?? tierColors[firstTier] ?? tierColors.F
  const paddingX = options.paddingX ?? 18
  const height = options.height ?? 38

  const width = getBadgeWidth(ctx, normalized, options)
  fillRoundRect(ctx, x, y, width, height, height / 2, bg)
  ctx.fillStyle = fg
  ctx.fillText(normalized, x + paddingX, y + height / 2 + 8)
  return width
}

function drawCenteredBadge(ctx, text, centerX, y, options = {}) {
  const width = getBadgeWidth(ctx, text, options)
  drawBadge(ctx, text, centerX - width / 2, y, options)
}

function drawProgress(ctx, x, y, width, value, fill = colors.gold, track = '#e8e1d5') {
  const progress = Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : 0
  fillRoundRect(ctx, x, y, width, 12, 6, track)
  if (progress > 0) {
    fillRoundRect(ctx, x, y, width * progress / 100, 12, 6, fill)
  }
}

function drawMetricCard(ctx, metric, x, y, width, height, accent = colors.gold) {
  fillRoundRect(ctx, x, y, width, height, 22, metric.highlight ? colors.panelWarm : '#ffffff')
  strokeRoundRect(ctx, x, y, width, height, 22, metric.highlight ? '#dfb95e' : '#ddd6c9', metric.highlight ? 2 : 1)

  drawLabel(ctx, metric.label, x + 28, y + 40, colors.muted)
  drawFittedText(ctx, metric.value, x + 28, y + 106, width - 56, metric.size ?? 52, 800, colors.ink)
  if (metric.meta) {
    drawFittedText(ctx, metric.meta, x + 28, y + height - 30, width - 56, 24, 600, metric.metaColor ?? colors.muted)
  }

  ctx.fillStyle = accent
  fillRoundRect(ctx, x + 28, y + height - 15, width - 56, 5, 3, accent)
}

function drawLineRow(ctx, line, x, y, width, index) {
  const rowHeight = 122
  const rowFill = index % 2 === 0 ? '#ffffff' : '#faf7f0'
  const currentColumn = { center: x + 560, width: 130 }
  const projectedColumn = { center: x + 740, width: 170 }
  const tierColumn = { center: x + 950, width: 140 }

  fillRoundRect(ctx, x, y, width, rowHeight, 18, rowFill)
  strokeRoundRect(ctx, x, y, width, rowHeight, 18, '#e2dacc')

  fillRoundRect(ctx, x + 18, y + 24, 48, 48, 14, '#f0eadf')
  setFont(ctx, 22, 800)
  ctx.fillStyle = colors.muted
  ctx.textAlign = 'center'
  ctx.fillText(String(line.index), x + 42, y + 56)
  ctx.textAlign = 'left'

  drawFittedText(ctx, line.stat, x + 86, y + 44, 390, 28, 800)
  drawFittedText(ctx, line.value, x + 86, y + 80, 280, 22, 600, colors.muted)

  drawCenteredFittedText(ctx, line.currentScore, currentColumn.center, y + 48, currentColumn.width, 30, 800)
  drawCenteredBadge(ctx, line.currentTier, currentColumn.center, y + 64, { size: 17, height: 30, paddingX: 13 })

  drawCenteredFittedText(ctx, line.projectedScore, projectedColumn.center, y + 48, projectedColumn.width, 30, 800)
  drawCenteredFittedText(ctx, line.projectedValue, projectedColumn.center, y + 80, projectedColumn.width, 22, 700, colors.muted)
  drawCenteredBadge(ctx, line.projectedTier, tierColumn.center, y + 44, { size: 18, height: 34, paddingX: 14 })

  drawProgress(ctx, x + 86, y + 96, width - 122, line.progress, colors.gold)
}

function drawHeader(ctx, payload, itemImage, y) {
  const x = snapshotPadding
  fillRoundRect(ctx, x, y, snapshotWidth - snapshotPadding * 2, 200, 30, colors.darkPanel)
  strokeRoundRect(ctx, x, y, snapshotWidth - snapshotPadding * 2, 200, 30, colors.darkLine)

  if (itemImage) {
    fillRoundRect(ctx, x + 28, y + 32, 136, 136, 26, '#2b2d34')
    ctx.drawImage(itemImage, x + 48, y + 52, 96, 96)
  }

  drawLabel(ctx, 'LaTale Gear Snapshot', x + 190, y + 58, '#aaa59b')
  drawFittedText(ctx, payload.itemName, x + 190, y + 114, 650, 44, 800, colors.white)
  drawFittedText(ctx, payload.subtitle, x + 190, y + 154, 690, 24, 600, '#cfc7b8')

  const badgeWidth = drawBadge(ctx, payload.upgradeLabel, snapshotWidth - snapshotPadding - 260, y + 44, {
    palette: ['#f8de9d', '#6d4700'],
    size: 20,
    height: 40,
  })
  drawFittedText(
    ctx,
    payload.generatedLabel,
    snapshotWidth - snapshotPadding - 260,
    y + 126,
    Math.max(190, badgeWidth),
    20,
    600,
    '#aaa59b',
  )
}

function drawSummary(ctx, payload, y) {
  const x = snapshotPadding
  const width = snapshotWidth - snapshotPadding * 2
  fillRoundRect(ctx, x, y, width, 306, 30, colors.panel)

  drawLabel(ctx, 'Current Results', x + 34, y + 48)
  drawLabel(ctx, payload.finalUpgrade ? `${payload.finalUpgrade} Summary` : 'Projection Summary', x + 548, y + 48)

  drawMetricCard(ctx, {
    label: 'Score',
    value: payload.current.score,
    meta: `${payload.current.levelLabel} / ${payload.current.rating} rating`,
  }, x + 34, y + 72, 224, 176, colors.blue)

  drawMetricCard(ctx, {
    label: 'Tier',
    value: payload.current.tier,
    size: 46,
    meta: 'Current roll',
  }, x + 276, y + 72, 224, 176, colors.blue)

  drawMetricCard(ctx, {
    label: 'Projected Score',
    value: payload.projected.score,
    meta: `${payload.projected.levelLabel} / ${payload.projected.rating} rating`,
    highlight: true,
  }, x + 548, y + 72, 284, 176, colors.gold)

  drawMetricCard(ctx, {
    label: 'Projected Tier',
    value: payload.projected.tier,
    size: payload.projected.tier.length > 6 ? 40 : 46,
    meta: `${payload.projected.scoreGain} score`,
    metaColor: colors.emerald,
    highlight: true,
  }, x + 850, y + 72, 224, 176, colors.emerald)

  drawProgress(ctx, x + 34, y + 276, 466, payload.current.progress, colors.blue, '#ddd8cf')
  drawProgress(ctx, x + 548, y + 276, 526, payload.projected.progress, colors.gold, '#ddd8cf')
}

function drawLineSection(ctx, payload, y) {
  const x = snapshotPadding
  const width = snapshotWidth - snapshotPadding * 2
  const rowX = x + 34
  const currentColumn = { center: rowX + 560, width: 130 }
  const projectedColumn = { center: rowX + 740, width: 170 }
  const tierColumn = { center: rowX + 950, width: 140 }

  fillRoundRect(ctx, x, y, width, 86 + payload.lines.length * 138, 30, colors.panel)

  setFont(ctx, 20, 800)
  ctx.fillStyle = colors.muted
  drawCenteredFittedText(ctx, 'CURRENT %', currentColumn.center, y + 48, currentColumn.width, 20, 800, colors.muted)
  drawCenteredFittedText(ctx, 'PROJECTED %', projectedColumn.center, y + 48, projectedColumn.width, 20, 800, colors.muted)
  drawCenteredFittedText(ctx, 'TIER', tierColumn.center, y + 48, tierColumn.width, 20, 800, colors.muted)

  let rowY = y + 70
  payload.lines.forEach((line, index) => {
    drawLineRow(ctx, line, rowX, rowY, width - 68, index)
    rowY += 138
  })

  return y + 86 + payload.lines.length * 138
}

function canvasToBlob(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob)
      }
      else {
        reject(new Error('Could not create snapshot image.'))
      }
    }, 'image/png')
  })
}

function loadImage(src) {
  if (!src) {
    return Promise.resolve(null)
  }

  return new Promise((resolve) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => resolve(null)
    image.src = src
  })
}

export async function renderGearSnapshot(payload) {
  const [canvas, ctx] = getCanvasContext()
  const itemImage = await loadImage(payload.itemImage)

  const hasLines = payload.lines.length > 0
  const lineHeight = hasLines ? 86 + payload.lines.length * 138 : 0
  const height = snapshotPadding + 200 + 34 + 306 + (hasLines ? 34 + lineHeight : 0) + snapshotPadding
  canvas.height = height

  const gradient = ctx.createLinearGradient(0, 0, 0, height)
  gradient.addColorStop(0, colors.bgTop)
  gradient.addColorStop(0.55, '#242025')
  gradient.addColorStop(1, colors.bgBottom)
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, snapshotWidth, height)

  const accent = ctx.createLinearGradient(snapshotPadding, 0, snapshotWidth - snapshotPadding, 0)
  accent.addColorStop(0, colors.gold)
  accent.addColorStop(0.45, colors.emerald)
  accent.addColorStop(1, colors.rose)
  fillRoundRect(ctx, snapshotPadding, snapshotPadding - 18, snapshotWidth - snapshotPadding * 2, 8, 4, accent)

  let y = snapshotPadding
  drawHeader(ctx, payload, itemImage, y)
  y += 234
  drawSummary(ctx, payload, y)
  if (hasLines) {
    y += 340
    drawLineSection(ctx, payload, y)
  }

  return canvasToBlob(canvas)
}
