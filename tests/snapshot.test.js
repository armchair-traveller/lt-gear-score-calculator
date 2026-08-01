import assert from 'node:assert/strict'
import test from 'node:test'
import {
  createCanvas,
  loadImage,
} from '@napi-rs/canvas'
import {
  getGearSnapshotLayout,
  normalizeGearSnapshotPayload,
} from '../app/utils/snapshot-renderer.js'
import { renderGearSnapshot } from '../app/utils/snapshot.js'
import {
  getGearSnapshotItemAssetUrl,
  registerServerSnapshotFonts,
  renderGearSnapshotBuffer,
} from '../server/utils/gear-snapshot.js'

function createSnapshotPayload(lineCount = 5) {
  return {
    itemName: '[9999] Armor · Chestplate',
    itemImage: '',
    itemImageKey: 'Chestplate_9999.png',
    metricMode: 'score',
    current: {
      value: '77%',
      tier: 'A',
      levelLabel: 'Lv.2',
    },
    projected: {
      value: '92% – 98%',
      tier: 'SS',
      levelLabel: 'Lv.5 Ascended',
    },
    lines: Array.from({ length: lineCount }, (_, index) => ({
      stat: `Enchant stat ${index + 1}`,
      value: `${100 + index}`,
      currentMetric: `${70 + index}%`,
      projectedValue: `${120 + index} – ${130 + index}`,
      projectedMetric: `${90 + index}% – 100%`,
    })),
  }
}

function getPngDimensions(buffer) {
  assert.deepEqual([...buffer.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10])
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  }
}

async function getExactColorRatio(buffer, hexColor) {
  const image = await loadImage(buffer)
  const canvas = createCanvas(image.width, image.height)
  const context = canvas.getContext('2d')
  context.drawImage(image, 0, 0)
  const pixels = context.getImageData(0, 0, image.width, image.height).data
  const [red, green, blue] = hexColor
    .match(/[\da-f]{2}/gi)
    .map(component => Number.parseInt(component, 16))
  let matchingPixels = 0

  for (let offset = 0; offset < pixels.length; offset += 4) {
    if (
      pixels[offset] === red
      && pixels[offset + 1] === green
      && pixels[offset + 2] === blue
      && pixels[offset + 3] === 255
    ) {
      matchingPixels += 1
    }
  }

  return matchingPixels / (image.width * image.height)
}

test('snapshot layout stays compatible with the existing five-line design', () => {
  assert.deepEqual(
    getGearSnapshotLayout(5),
    {
      width: 1200,
      height: 880,
      legalY: 860,
      linesY: 500,
      lineCount: 5,
    },
  )

  const normalized = normalizeGearSnapshotPayload(createSnapshotPayload(8))
  assert.equal(normalized.lines.length, 5)
})

test('Node snapshot renderer creates a PNG and resolves a known local item asset', async () => {
  assert.equal(await registerServerSnapshotFonts(), true)
  assert.match(getGearSnapshotItemAssetUrl('Chestplate_9999.png').pathname, /Chestplate_9999\.png$/)
  assert.equal(getGearSnapshotItemAssetUrl('../background.png'), null)

  const buffer = await renderGearSnapshotBuffer(createSnapshotPayload(), {
    heroImage: null,
  })

  assert.ok(Buffer.isBuffer(buffer))
  assert.ok(buffer.length > 50_000)
  assert.deepEqual(getPngDimensions(buffer), {
    width: 1200,
    height: 880,
  })
  assert.ok(
    await getExactColorRatio(buffer, '#5964a8') < 0.03,
    'score text must not expand into oversized solid shapes',
  )
  assert.ok(
    await getExactColorRatio(buffer, '#9d8594') < 0.03,
    'label text must not expand into oversized solid shapes',
  )
})

test('browser snapshot API still returns a PNG Blob', async () => {
  const originalDocument = globalThis.document
  const originalImage = globalThis.Image

  globalThis.document = {
    createElement() {
      const canvas = createCanvas(1, 1)
      canvas.toBlob = (callback) => {
        callback(new Blob([canvas.toBuffer('image/png')], { type: 'image/png' }))
      }
      return canvas
    },
  }
  delete globalThis.Image

  try {
    const blob = await renderGearSnapshot({
      ...createSnapshotPayload(1),
      itemImage: '',
      projected: null,
    })

    assert.ok(blob instanceof Blob)
    assert.equal(blob.type, 'image/png')
    assert.ok(blob.size > 25_000)

    const buffer = Buffer.from(await blob.arrayBuffer())
    assert.deepEqual(getPngDimensions(buffer), {
      width: 1200,
      height: 624,
    })
  }
  finally {
    if (originalDocument === undefined) {
      delete globalThis.document
    }
    else {
      globalThis.document = originalDocument
    }

    if (originalImage === undefined) {
      delete globalThis.Image
    }
    else {
      globalThis.Image = originalImage
    }
  }
})
