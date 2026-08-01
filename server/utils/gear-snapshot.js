import { readFile } from 'node:fs/promises'
import {
  createCanvas,
  GlobalFonts,
  loadImage as loadCanvasImage,
} from '@napi-rs/canvas'
import {
  gearSnapshotAssets,
  renderGearSnapshotCanvas,
} from '../../app/utils/snapshot-renderer.js'

const maxRemoteAssetBytes = 12 * 1024 * 1024
const defaultImageTimeoutMs = 6000
const decodedImageCache = new Map()
const geistFontWeights = [400, 500, 600, 700, 800, 900]
const localGeistFontUrls = geistFontWeights.map((weight) =>
  new URL(
    `../../node_modules/@fontsource/geist/files/geist-latin-${weight}-normal.woff2`,
    import.meta.url,
  ),
)
let geistFontRegistered = false

const itemImageKeys = new Set([
  'Badge_3500.png',
  'Badge_9999.png',
  'Boots_6000.png',
  'Boots_9999.png',
  'Chestplate_6000.png',
  'Chestplate_9999.png',
  'Cloak_7000.png',
  'Cloak_sLv5.png',
  'Crystal_9000.png',
  'Earrings_7000.png',
  'Earrings_sLv5.png',
  'Fauld_6000.png',
  'Fauld_9999.png',
  'Glasses_9000.png',
  'Gloves_6000.png',
  'Gloves_9999.png',
  'Helmet_6000.png',
  'Helmet_9999.png',
  'Ring_7000.png',
  'Ring_sLv5.png',
  'Stockings_9000.png',
  'Stone_8000.png',
  'Weapon_8000.png',
])

function hasOwn(value, key) {
  return Object.prototype.hasOwnProperty.call(value, key)
}

function isDecodedImage(value) {
  return Boolean(
    value
    && typeof value === 'object'
    && !Buffer.isBuffer(value)
    && !ArrayBuffer.isView(value)
    && Number(value.width) > 0
    && Number(value.height) > 0,
  )
}

function toBuffer(value) {
  if (Buffer.isBuffer(value)) {
    return value
  }

  if (value instanceof ArrayBuffer) {
    return Buffer.from(value)
  }

  if (ArrayBuffer.isView(value)) {
    return Buffer.from(value.buffer, value.byteOffset, value.byteLength)
  }

  return null
}

function parseImageUrl(source) {
  if (source instanceof URL) {
    return source
  }

  if (typeof source !== 'string') {
    return null
  }

  try {
    return new URL(source)
  }
  catch {
    return null
  }
}

async function fetchRemoteImage(url, timeoutMs) {
  if (
    url.protocol !== 'https:'
    || (url.hostname !== 'static.latale.com' && url.hostname !== 'www.latale.com')
  ) {
    throw new Error('Remote snapshot assets must use an approved LaTale host.')
  }

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(url, {
      redirect: 'error',
      signal: controller.signal,
    })
    if (!response.ok) {
      throw new Error(`Snapshot asset request failed with status ${response.status}.`)
    }

    const contentLength = Number(response.headers.get('content-length'))
    if (Number.isFinite(contentLength) && contentLength > maxRemoteAssetBytes) {
      throw new Error('Snapshot asset is too large.')
    }

    const buffer = Buffer.from(await response.arrayBuffer())
    if (buffer.length > maxRemoteAssetBytes) {
      throw new Error('Snapshot asset is too large.')
    }

    return buffer
  }
  finally {
    clearTimeout(timeoutId)
  }
}

async function decodeServerImage(source, timeoutMs) {
  if (!source) {
    return null
  }

  if (isDecodedImage(source)) {
    return source
  }

  const directBuffer = toBuffer(source)
  if (directBuffer) {
    return loadCanvasImage(directBuffer)
  }

  const url = parseImageUrl(source)
  if (url?.protocol === 'file:') {
    return loadCanvasImage(await readFile(url))
  }
  if (url?.protocol === 'https:') {
    return loadCanvasImage(await fetchRemoteImage(url, timeoutMs))
  }

  return loadCanvasImage(source)
}

export function isGearSnapshotItemImageKey(value) {
  return typeof value === 'string' && itemImageKeys.has(value)
}

export function getGearSnapshotItemAssetUrl(itemImageKey) {
  if (!isGearSnapshotItemImageKey(itemImageKey)) {
    return null
  }

  return new URL(`../../app/assets/${itemImageKey}`, import.meta.url)
}

export async function loadServerSnapshotImage(source, options = {}) {
  const timeoutMs = Number.isFinite(Number(options.timeoutMs))
    ? Math.max(1, Number(options.timeoutMs))
    : defaultImageTimeoutMs
  const url = parseImageUrl(source)
  const cacheKey = url
    ? url.href
    : typeof source === 'string'
      ? source
      : ''

  if (!cacheKey) {
    return decodeServerImage(source, timeoutMs)
  }

  if (!decodedImageCache.has(cacheKey)) {
    decodedImageCache.set(cacheKey, decodeServerImage(source, timeoutMs).catch(() => null))
  }

  return decodedImageCache.get(cacheKey)
}

async function loadOptionalImage(loadImage, source) {
  if (!source) {
    return null
  }

  try {
    return await loadImage(source)
  }
  catch {
    return null
  }
}

function getItemImageSource(payload, options) {
  if (hasOwn(options, 'itemImageBuffer')) {
    return options.itemImageBuffer
  }
  if (hasOwn(options, 'itemImage')) {
    return options.itemImage
  }

  const itemImageKey = payload?.itemImageKey ?? payload?.itemAssetName
  const itemAssetUrl = getGearSnapshotItemAssetUrl(itemImageKey)
  return itemAssetUrl ?? payload?.itemImage ?? null
}

export async function renderGearSnapshotBuffer(payload, options = {}) {
  await registerServerSnapshotFonts(options.geistFontBuffers)
  const imageLoader = options.loadImage ?? loadServerSnapshotImage
  const assets = {}

  if (hasOwn(options, 'heroImageBuffer')) {
    assets.hero = await loadOptionalImage(imageLoader, options.heroImageBuffer)
  }
  else if (hasOwn(options, 'heroImage')) {
    assets.hero = await loadOptionalImage(imageLoader, options.heroImage)
  }

  const itemImageSource = getItemImageSource(payload, options)
  if (itemImageSource) {
    assets.item = await loadOptionalImage(imageLoader, itemImageSource)
  }
  else if (hasOwn(options, 'itemImage') || hasOwn(options, 'itemImageBuffer')) {
    assets.item = null
  }

  const canvas = await renderGearSnapshotCanvas(payload, {
    createCanvas,
    loadImage: imageLoader,
    assets,
    discreteFontWeights: true,
    heroSource: options.heroImageUrl ?? gearSnapshotAssets.hero,
  })

  return canvas.toBuffer('image/png')
}

export async function registerServerSnapshotFonts(geistFontBuffers) {
  if (geistFontRegistered) {
    return true
  }

  let fontBuffers = Array.isArray(geistFontBuffers)
    ? geistFontBuffers.map(toBuffer).filter(Boolean)
    : []
  if (fontBuffers.length !== geistFontWeights.length) {
    try {
      fontBuffers = await Promise.all(
        localGeistFontUrls.map((fontUrl) => readFile(fontUrl)),
      )
    }
    catch {
      return false
    }
  }

  try {
    const registeredFonts = fontBuffers
      .map((fontBuffer) => GlobalFonts.register(fontBuffer, 'Geist'))
    geistFontRegistered =
      registeredFonts.length === geistFontWeights.length
      && registeredFonts.every(Boolean)
  }
  catch {
    geistFontRegistered = false
  }
  return geistFontRegistered
}
