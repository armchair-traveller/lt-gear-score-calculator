import { renderGearSnapshotCanvas } from './snapshot-renderer.js'

const browserImageCache = new Map()

function canvasToBlob(canvas) {
  return new Promise((resolve, reject) => {
    try {
      canvas.toBlob((blob) => {
        if (blob) {
          resolve(blob)
        }
        else {
          reject(new Error('Could not create snapshot image.'))
        }
      }, 'image/png')
    }
    catch (error) {
      reject(error)
    }
  })
}

function createBrowserCanvas(width, height) {
  if (typeof document === 'undefined') {
    throw new Error('Canvas 2D is not available in this browser.')
  }

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  return canvas
}

function loadBrowserImageUncached(src, timeoutMs = 6000) {
  if (!src || typeof Image === 'undefined') {
    return Promise.resolve(null)
  }

  return new Promise((resolve) => {
    let settled = false
    let timeoutId
    const image = new Image()
    image.crossOrigin = 'anonymous'

    const finish = (result) => {
      if (settled) {
        return
      }

      settled = true
      clearTimeout(timeoutId)
      image.onload = null
      image.onerror = null
      resolve(result)
    }

    image.onload = () => finish(image)
    image.onerror = () => finish(null)
    timeoutId = setTimeout(() => finish(null), timeoutMs)

    try {
      image.src = src
    }
    catch {
      finish(null)
    }
  })
}

function loadBrowserSnapshotImage(src) {
  if (!src) {
    return Promise.resolve(null)
  }

  if (typeof src !== 'string') {
    return loadBrowserImageUncached(src)
  }

  if (!browserImageCache.has(src)) {
    browserImageCache.set(src, loadBrowserImageUncached(src))
  }

  return browserImageCache.get(src)
}

async function waitForSnapshotFonts() {
  if (typeof document === 'undefined' || !document.fonts) {
    return
  }

  try {
    await Promise.allSettled([
      document.fonts.load('700 32px "Noto Sans KR"'),
      document.fonts.load('700 20px "Geist"'),
    ])
    await document.fonts.ready
  }
  catch {
    // The renderer's font stacks provide local fallbacks.
  }
}

export async function renderGearSnapshot(payload) {
  if (typeof document === 'undefined') {
    throw new Error('Canvas 2D is not available in this browser.')
  }

  await waitForSnapshotFonts()
  const canvas = await renderGearSnapshotCanvas(payload, {
    createCanvas: createBrowserCanvas,
    loadImage: loadBrowserSnapshotImage,
  })
  return canvasToBlob(canvas)
}
