import assert from 'node:assert/strict'
import test from 'node:test'
import { nextTick, ref } from 'vue'
import {
  createGearPlanPersistence,
} from '../app/composables/useGearPlanPersistence.js'
import {
  createEmptyGearPlan,
} from '../app/features/gear-plan/plan-validation.js'
import {
  encodeGearPlanShare,
  parseGearPlanShare,
  readStoredGearPlan,
} from '../app/features/gear-plan/plan-state.js'

const planStorageKey = 'ltGearPlanV1'
const metadataStorageKey = 'ltGearPlanDeviceMetaV1'

class MemoryStorage {
  constructor(values = {}) {
    this.values = new Map(Object.entries(values))
  }

  getItem(key) {
    return this.values.has(key) ? this.values.get(key) : null
  }

  setItem(key, value) {
    this.values.set(key, String(value))
  }
}

class RecoveringStorage extends MemoryStorage {
  failures = new Map()

  failNext(key, count = 1) {
    this.failures.set(key, count)
  }

  setItem(key, value) {
    const remaining = this.failures.get(key) ?? 0
    if (remaining > 0) {
      this.failures.set(key, remaining - 1)
      throw new DOMException('redacted quota detail', 'QuotaExceededError')
    }

    super.setItem(key, value)
  }
}

function createEntry(pieceType = 'Cloak', value = 1) {
  const statsByPiece = {
    Cloak: [
      'Critical Damage',
      'Basic Stats %',
      'Attack/Intensity',
      'Strength/Magic',
      'Basic Stats',
    ],
    Earrings: [
      'Critical Damage',
      'Maximum Damage',
      'Attack/Intensity',
      'Strength/Magic',
      'Basic Stats',
    ],
  }

  return {
    gearType: '[sLv5] Accessories',
    pieceType,
    statType: statsByPiece[pieceType],
    statInput: [value, value, value, 0, 0],
  }
}

function createPlan(...entries) {
  return {
    version: 1,
    slots: Object.fromEntries(entries.map(entry => [
      `${entry.gearType}::${entry.pieceType}`,
      entry,
    ])),
  }
}

function createStorage(plan = createEmptyGearPlan(), metadata) {
  const values = {
    [planStorageKey]: JSON.stringify(plan),
  }
  if (metadata) {
    values[metadataStorageKey] = JSON.stringify(metadata)
  }
  return new MemoryStorage(values)
}

function createAuth(userId = null) {
  return {
    user: ref(userId ? { id: userId } : null),
    isSessionPending: ref(false),
  }
}

function createClock() {
  let timestamp = Date.parse('2026-08-02T12:00:00.000Z')
  return () => new Date(timestamp += 1000)
}

async function settle(turns = 8) {
  for (let turn = 0; turn < turns; turn += 1) {
    await new Promise(resolve => setImmediate(resolve))
  }
}

test('legacy local storage salvages valid entries without overwriting the raw blob', () => {
  const validEntry = createEntry()
  const invalidEntry = {
    ...createEntry('Earrings'),
    statType: Array(5).fill('Critical Damage'),
  }
  const rawPlan = {
    version: 1,
    slots: {
      'legacy-valid-key': validEntry,
      'legacy-invalid-key': invalidEntry,
    },
  }
  const storage = new MemoryStorage({
    [planStorageKey]: JSON.stringify(rawPlan),
  })

  assert.deepEqual(readStoredGearPlan(storage), createPlan(validEntry))
  assert.deepEqual(JSON.parse(storage.getItem(planStorageKey)), rawPlan)
})

test('signed-out mutations persist immediately with device metadata and no request', (t) => {
  const storage = createStorage()
  const requests = []
  const persistence = createGearPlanPersistence({
    auth: createAuth(),
    storage,
    now: () => new Date('2026-08-02T12:00:00.000Z'),
    request: async (...args) => requests.push(args),
  })
  t.after(persistence.dispose)

  assert.equal(persistence.saveEntry(createEntry()), true)
  assert.equal(persistence.entryCount.value, 1)
  assert.equal(persistence.syncStatus.value, 'local')
  assert.deepEqual(JSON.parse(storage.getItem(planStorageKey)), createPlan(createEntry()))
  assert.deepEqual(JSON.parse(storage.getItem(metadataStorageKey)), {
    updatedAt: '2026-08-02T12:00:00.000Z',
    ownerId: null,
  })
  assert.equal(requests.length, 0)

  const replacement = createPlan(createEntry('Earrings'))
  assert.equal(persistence.replacePlan(replacement), true)
  assert.deepEqual(persistence.plan.value, replacement)
  assert.deepEqual(JSON.parse(storage.getItem(planStorageKey)), replacement)
})

test('a failed primary device write rejects the mutation, blocks PUT, and recovers on retry', async (t) => {
  const storage = new RecoveringStorage({
    [planStorageKey]: JSON.stringify(createEmptyGearPlan()),
  })
  const calls = []
  const logs = []
  t.mock.method(console, 'error', (...args) => logs.push(args))
  const persistence = createGearPlanPersistence({
    auth: createAuth('user-a'),
    storage,
    request: async (path, options) => {
      calls.push(options.method)
      if (options.method === 'GET') {
        return { plan: null, revision: 0, updatedAt: null }
      }
      return {
        plan: options.body.plan,
        revision: 1,
        updatedAt: '2026-08-02T12:05:00.000Z',
      }
    },
  })
  t.after(persistence.dispose)

  await settle()
  storage.failNext(planStorageKey)
  assert.equal(persistence.saveEntry(createEntry()), false)
  assert.equal(persistence.syncStatus.value, 'paused')
  assert.equal(persistence.pauseReason.value, 'device')
  assert.deepEqual(persistence.plan.value, createEmptyGearPlan())
  assert.deepEqual(calls, ['GET'])
  assert.deepEqual(logs, [[
    '[gear-plan-persistence] device_plan_write_failed',
  ]])

  assert.equal(persistence.retry(), true)
  await settle()

  assert.deepEqual(persistence.plan.value, createPlan(createEntry()))
  assert.deepEqual(calls, ['GET', 'PUT'])
  assert.equal(persistence.syncStatus.value, 'saved')
  assert.equal(persistence.pauseReason.value, '')
})

test('a failed metadata write does not report success or upload before recovery', async (t) => {
  const storage = new RecoveringStorage({
    [planStorageKey]: JSON.stringify(createEmptyGearPlan()),
  })
  const calls = []
  const logs = []
  t.mock.method(console, 'error', (...args) => logs.push(args))
  const persistence = createGearPlanPersistence({
    auth: createAuth('user-a'),
    storage,
    request: async (path, options) => {
      calls.push(options.method)
      if (options.method === 'GET') {
        return { plan: null, revision: 0, updatedAt: null }
      }
      return {
        plan: options.body.plan,
        revision: 1,
        updatedAt: '2026-08-02T12:06:00.000Z',
      }
    },
  })
  t.after(persistence.dispose)

  await settle()
  storage.failNext(metadataStorageKey)
  assert.equal(persistence.saveEntry(createEntry()), false)
  assert.equal(persistence.syncStatus.value, 'paused')
  assert.equal(persistence.pauseReason.value, 'device')
  assert.deepEqual(calls, ['GET'])
  assert.deepEqual(logs, [[
    '[gear-plan-persistence] device_metadata_write_failed',
  ]])

  assert.equal(persistence.retry(), true)
  await settle()
  assert.deepEqual(calls, ['GET', 'PUT'])
  assert.equal(persistence.syncStatus.value, 'saved')
})

test('first sign-in maps an absent cloud snapshot to empty and uploads an anonymous device plan', async (t) => {
  const devicePlan = createPlan(createEntry())
  const storage = createStorage(devicePlan)
  const requests = []
  const persistence = createGearPlanPersistence({
    auth: createAuth('user-a'),
    storage,
    now: createClock(),
    request: async (path, options) => {
      requests.push({ path, ...options })
      if (options.method === 'GET') {
        return { plan: null, revision: 0, updatedAt: null }
      }

      return {
        plan: options.body.plan,
        revision: 1,
        updatedAt: '2026-08-02T12:10:00.000Z',
      }
    },
  })
  t.after(persistence.dispose)

  await settle()

  assert.deepEqual(requests.map(call => call.method), ['GET', 'PUT'])
  assert.equal(requests[1].body.expectedRevision, 0)
  assert.deepEqual(requests[1].body.plan, devicePlan)
  assert.equal(persistence.syncStatus.value, 'saved')
  assert.deepEqual(JSON.parse(storage.getItem(metadataStorageKey)), {
    updatedAt: '2026-08-02T12:10:00.000Z',
    ownerId: 'user-a',
  })
})

test('an intentionally empty cloud row conflicts instead of repopulating automatically', async (t) => {
  const storage = createStorage(createPlan(createEntry()), {
    updatedAt: '2026-08-02T11:00:00.000Z',
    ownerId: 'user-a',
  })
  const requests = []
  const persistence = createGearPlanPersistence({
    auth: createAuth('user-a'),
    storage,
    request: async (path, options) => {
      requests.push({ path, ...options })
      if (options.method === 'GET') {
        return {
          plan: createEmptyGearPlan(),
          revision: 3,
          updatedAt: '2026-08-02T11:30:00.000Z',
        }
      }

      return {
        plan: options.body.plan,
        revision: 4,
        updatedAt: '2026-08-02T12:30:00.000Z',
      }
    },
  })
  t.after(persistence.dispose)

  await settle()

  assert.equal(persistence.syncStatus.value, 'conflict')
  assert.deepEqual(persistence.conflict.value, {
    device: {
      entryCount: 1,
      updatedAt: '2026-08-02T11:00:00.000Z',
    },
    cloud: {
      entryCount: 0,
      updatedAt: '2026-08-02T11:30:00.000Z',
    },
  })
  assert.deepEqual(requests.map(call => call.method), ['GET'])

  assert.equal(persistence.replaceCloudWithDevice(), true)
  await settle()

  assert.deepEqual(requests.map(call => call.method), ['GET', 'PUT'])
  assert.equal(requests[1].body.expectedRevision, 3)
  assert.equal(persistence.syncStatus.value, 'saved')
})

test('equal copies retain the fetched revision for the next mutation', async (t) => {
  const devicePlan = createPlan(createEntry())
  const putCalls = []
  const persistence = createGearPlanPersistence({
    auth: createAuth('user-a'),
    storage: createStorage(devicePlan, {
      updatedAt: '2026-08-02T11:00:00.000Z',
      ownerId: 'user-a',
    }),
    request: async (path, options) => {
      if (options.method === 'GET') {
        return {
          plan: devicePlan,
          revision: 7,
          updatedAt: '2026-08-02T11:00:00.000Z',
        }
      }

      putCalls.push(options)
      return {
        plan: options.body.plan,
        revision: 8,
        updatedAt: '2026-08-02T12:00:00.000Z',
      }
    },
  })
  t.after(persistence.dispose)

  await settle()
  persistence.saveEntry(createEntry('Cloak', 2))
  await settle()

  assert.equal(putCalls.length, 1)
  assert.equal(putCalls[0].body.expectedRevision, 7)
  assert.equal(persistence.syncStatus.value, 'saved')
})

test('different populated copies require a choice and cloud choice replaces device state', async (t) => {
  const devicePlan = createPlan(createEntry())
  const cloudPlan = createPlan(createEntry('Earrings'))
  const storage = createStorage(devicePlan, {
    updatedAt: '2026-08-02T11:00:00.000Z',
    ownerId: 'user-a',
  })
  let requestCount = 0
  const persistence = createGearPlanPersistence({
    auth: createAuth('user-a'),
    storage,
    request: async () => {
      requestCount += 1
      return {
        plan: cloudPlan,
        revision: 2,
        updatedAt: '2026-08-02T11:30:00.000Z',
      }
    },
  })
  t.after(persistence.dispose)

  await settle()
  assert.equal(persistence.syncStatus.value, 'conflict')
  assert.deepEqual(persistence.conflict.value, {
    device: {
      entryCount: 1,
      updatedAt: '2026-08-02T11:00:00.000Z',
    },
    cloud: {
      entryCount: 1,
      updatedAt: '2026-08-02T11:30:00.000Z',
    },
  })

  assert.equal(persistence.useCloudPlan(), true)
  assert.equal(persistence.syncStatus.value, 'saved')
  assert.deepEqual(persistence.plan.value, cloudPlan)
  assert.deepEqual(JSON.parse(storage.getItem(planStorageKey)), cloudPlan)
  assert.equal(requestCount, 1)
})

test('an unsynced retained plan cannot cross accounts after a reload', async (t) => {
  const storage = createStorage(createPlan(createEntry()))
  const firstPersistence = createGearPlanPersistence({
    auth: createAuth('user-a'),
    storage,
    request: async () => {
      throw new Error('network unavailable')
    },
  })

  await settle()
  assert.equal(firstPersistence.syncStatus.value, 'paused')
  assert.equal(
    JSON.parse(storage.getItem(metadataStorageKey)).ownerId,
    'user-a',
  )
  firstPersistence.dispose()

  const requests = []
  const secondPersistence = createGearPlanPersistence({
    auth: createAuth('user-b'),
    storage,
    request: async (path, options) => {
      requests.push({ path, ...options })
      return { plan: null, revision: 0, updatedAt: null }
    },
  })
  t.after(secondPersistence.dispose)

  await settle()

  assert.equal(secondPersistence.syncStatus.value, 'conflict')
  assert.equal(secondPersistence.conflict.value.device.entryCount, 1)
  assert.equal(secondPersistence.conflict.value.cloud.entryCount, 0)
  assert.deepEqual(requests.map(call => call.method), ['GET'])
  assert.equal(
    JSON.parse(storage.getItem(metadataStorageKey)).ownerId,
    'user-a',
  )
})

test('a live account switch never uploads the prior account device plan', async (t) => {
  const devicePlan = createPlan(createEntry())
  const auth = createAuth('user-a')
  let getCount = 0
  let putCount = 0
  const persistence = createGearPlanPersistence({
    auth,
    storage: createStorage(devicePlan, {
      updatedAt: '2026-08-02T11:00:00.000Z',
      ownerId: 'user-a',
    }),
    request: async (path, options) => {
      if (options.method === 'PUT') {
        putCount += 1
      }
      getCount += 1
      return getCount === 1
        ? {
            plan: devicePlan,
            revision: 1,
            updatedAt: '2026-08-02T11:00:00.000Z',
          }
        : { plan: null, revision: 0, updatedAt: null }
    },
  })
  t.after(persistence.dispose)

  await settle()
  auth.user.value = { id: 'user-b' }
  await nextTick()
  await settle()

  assert.equal(getCount, 2)
  assert.equal(putCount, 0)
  assert.equal(persistence.syncStatus.value, 'conflict')
})

test('PUTs are serial and coalesce mutations made while a save is in flight', async (t) => {
  const storage = createStorage()
  const auth = createAuth('user-a')
  const putCalls = []
  let resolveFirstPut
  let activePuts = 0
  let maximumActivePuts = 0

  const persistence = createGearPlanPersistence({
    auth,
    storage,
    now: createClock(),
    request: async (path, options) => {
      if (options.method === 'GET') {
        return { plan: null, revision: 0, updatedAt: null }
      }

      putCalls.push(options)
      activePuts += 1
      maximumActivePuts = Math.max(maximumActivePuts, activePuts)
      if (putCalls.length === 1) {
        return new Promise((resolve) => {
          resolveFirstPut = (value) => {
            activePuts -= 1
            resolve(value)
          }
        })
      }

      activePuts -= 1
      return {
        plan: options.body.plan,
        revision: 2,
        updatedAt: '2026-08-02T12:20:00.000Z',
      }
    },
  })
  t.after(persistence.dispose)

  await settle()
  persistence.saveEntry(createEntry())
  await Promise.resolve()
  await Promise.resolve()
  assert.equal(putCalls.length, 1)

  persistence.saveEntry(createEntry('Earrings'))
  persistence.saveEntry(createEntry('Cloak', 2))
  assert.equal(putCalls.length, 1)

  resolveFirstPut({
    plan: putCalls[0].body.plan,
    revision: 1,
    updatedAt: '2026-08-02T12:10:00.000Z',
  })
  await settle()

  assert.equal(putCalls.length, 2)
  assert.equal(maximumActivePuts, 1)
  assert.equal(putCalls[1].body.expectedRevision, 1)
  assert.equal(Object.keys(putCalls[1].body.plan.slots).length, 2)
  assert.deepEqual(
    putCalls[1].body.plan.slots['[sLv5] Accessories::Cloak'].statInput,
    [2, 2, 2, 0, 0],
  )
  assert.equal(persistence.syncStatus.value, 'saved')
})

test('delete and reset mutations coalesce into the latest whole-plan PUT', async (t) => {
  const devicePlan = createPlan(createEntry(), createEntry('Earrings'))
  const putCalls = []
  const persistence = createGearPlanPersistence({
    auth: createAuth('user-a'),
    storage: createStorage(devicePlan, {
      updatedAt: '2026-08-02T11:00:00.000Z',
      ownerId: 'user-a',
    }),
    request: async (path, options) => {
      if (options.method === 'GET') {
        return {
          plan: devicePlan,
          revision: 5,
          updatedAt: '2026-08-02T11:00:00.000Z',
        }
      }
      putCalls.push(options)
      return {
        plan: options.body.plan,
        revision: 6,
        updatedAt: '2026-08-02T12:00:00.000Z',
      }
    },
  })
  t.after(persistence.dispose)

  await settle()
  assert.equal(
    persistence.deleteEntry('[sLv5] Accessories::Cloak'),
    true,
  )
  assert.equal(persistence.resetPlan(), true)
  await settle()

  assert.equal(putCalls.length, 1)
  assert.equal(putCalls[0].body.expectedRevision, 5)
  assert.deepEqual(putCalls[0].body.plan, createEmptyGearPlan())
})

test('a direct conflict response enters conflict once and does not retry the PUT', async (t) => {
  const putCalls = []
  const persistence = createGearPlanPersistence({
    auth: createAuth('user-a'),
    storage: createStorage(),
    request: async (path, options) => {
      if (options.method === 'GET') {
        return { plan: null, revision: 0, updatedAt: null }
      }

      putCalls.push(options)
      throw {
        code: 'GEAR_PLAN_CONFLICT',
        cloud: {
          plan: createEmptyGearPlan(),
          revision: 1,
          updatedAt: '2026-08-02T12:15:00.000Z',
        },
      }
    },
  })
  t.after(persistence.dispose)

  await settle()
  persistence.saveEntry(createEntry())
  await settle()

  assert.equal(putCalls.length, 1)
  assert.equal(persistence.syncStatus.value, 'conflict')
  assert.deepEqual(persistence.conflict.value.cloud, {
    entryCount: 0,
    updatedAt: '2026-08-02T12:15:00.000Z',
  })
})

test('a second conflict while replacing cloud refreshes the held cloud snapshot', async (t) => {
  const storage = createStorage(createPlan(createEntry()), {
    updatedAt: '2026-08-02T11:00:00.000Z',
    ownerId: 'user-a',
  })
  const putCalls = []
  const refreshedCloudPlan = createPlan(createEntry('Earrings'))
  const persistence = createGearPlanPersistence({
    auth: createAuth('user-a'),
    storage,
    request: async (path, options) => {
      if (options.method === 'GET') {
        return {
          plan: createEmptyGearPlan(),
          revision: 3,
          updatedAt: '2026-08-02T11:30:00.000Z',
        }
      }

      putCalls.push(options)
      throw {
        data: {
          data: {
            code: 'GEAR_PLAN_CONFLICT',
            cloud: {
              plan: refreshedCloudPlan,
              revision: 4,
              updatedAt: '2026-08-02T12:30:00.000Z',
            },
          },
        },
      }
    },
  })
  t.after(persistence.dispose)

  await settle()
  assert.equal(persistence.syncStatus.value, 'conflict')
  persistence.replaceCloudWithDevice()
  await settle()

  assert.equal(putCalls.length, 1)
  assert.equal(putCalls[0].body.expectedRevision, 3)
  assert.equal(persistence.syncStatus.value, 'conflict')
  assert.deepEqual(persistence.conflict.value.cloud, {
    entryCount: 1,
    updatedAt: '2026-08-02T12:30:00.000Z',
  })
})

test('failed PUTs retain local data and retry when connectivity returns', async (t) => {
  const eventTarget = new EventTarget()
  const storage = createStorage()
  let online = true
  let putCount = 0
  const persistence = createGearPlanPersistence({
    auth: createAuth('user-a'),
    storage,
    eventTarget,
    isOnline: () => online,
    request: async (path, options) => {
      if (options.method === 'GET') {
        return { plan: null, revision: 0, updatedAt: null }
      }

      putCount += 1
      if (putCount === 1) {
        throw new Error('save failed')
      }

      return {
        plan: options.body.plan,
        revision: 1,
        updatedAt: '2026-08-02T12:45:00.000Z',
      }
    },
  })
  t.after(persistence.dispose)

  await settle()
  persistence.saveEntry(createEntry())
  await settle()

  assert.equal(persistence.syncStatus.value, 'paused')
  assert.deepEqual(persistence.plan.value, createPlan(createEntry()))
  assert.deepEqual(
    JSON.parse(storage.getItem(planStorageKey)),
    createPlan(createEntry()),
  )

  online = false
  assert.equal(persistence.retry(), false)
  assert.equal(putCount, 1)
  online = true
  eventTarget.dispatchEvent(new Event('online'))
  await settle()

  assert.equal(putCount, 2)
  assert.equal(persistence.syncStatus.value, 'saved')
})

test('sign-out ignores an in-flight save result and retains the unsynced mutation', async (t) => {
  const auth = createAuth('user-a')
  const storage = createStorage()
  let resolvePut
  const persistence = createGearPlanPersistence({
    auth,
    storage,
    request: async (path, options) => {
      if (options.method === 'GET') {
        return { plan: null, revision: 0, updatedAt: null }
      }

      return new Promise((resolve) => {
        resolvePut = () => resolve({
          plan: options.body.plan,
          revision: 1,
          updatedAt: '2026-08-02T12:50:00.000Z',
        })
      })
    },
  })
  t.after(persistence.dispose)

  await settle()
  persistence.saveEntry(createEntry())
  await Promise.resolve()
  await Promise.resolve()
  assert.equal(typeof resolvePut, 'function')

  auth.user.value = null
  await nextTick()
  resolvePut()
  await settle()

  assert.equal(persistence.syncStatus.value, 'local')
  assert.deepEqual(persistence.plan.value, createPlan(createEntry()))
  assert.deepEqual(
    JSON.parse(storage.getItem(planStorageKey)),
    createPlan(createEntry()),
  )
})

test('online events retry paused reconciliation and sign-out retains the cloud-loaded plan', async (t) => {
  const auth = createAuth('user-a')
  const eventTarget = new EventTarget()
  const cloudPlan = createPlan(createEntry())
  let online = false
  let getCount = 0
  const storage = createStorage()
  const persistence = createGearPlanPersistence({
    auth,
    storage,
    eventTarget,
    isOnline: () => online,
    request: async () => {
      getCount += 1
      return {
        plan: cloudPlan,
        revision: 1,
        updatedAt: '2026-08-02T12:40:00.000Z',
      }
    },
  })
  t.after(persistence.dispose)

  await settle()
  assert.equal(persistence.syncStatus.value, 'paused')
  assert.equal(getCount, 0)

  online = true
  eventTarget.dispatchEvent(new Event('online'))
  await settle()

  assert.equal(getCount, 1)
  assert.equal(persistence.syncStatus.value, 'saved')
  assert.deepEqual(persistence.plan.value, cloudPlan)

  auth.user.value = null
  await nextTick()
  await settle()

  assert.equal(persistence.syncStatus.value, 'local')
  assert.deepEqual(persistence.plan.value, cloudPlan)
  assert.deepEqual(JSON.parse(storage.getItem(planStorageKey)), cloudPlan)
})

test('inconsistent absent-cloud metadata pauses without overwriting the device plan', async (t) => {
  const devicePlan = createPlan(createEntry())
  const storage = createStorage(devicePlan)
  const persistence = createGearPlanPersistence({
    auth: createAuth('user-a'),
    storage,
    request: async () => ({
      plan: null,
      revision: 1,
      updatedAt: null,
    }),
  })
  t.after(persistence.dispose)

  await settle()

  assert.equal(persistence.syncStatus.value, 'paused')
  assert.deepEqual(persistence.plan.value, devicePlan)
  assert.deepEqual(JSON.parse(storage.getItem(planStorageKey)), devicePlan)
})

test('legacy planner share encoding and round-trip remain unchanged', () => {
  const plan = createPlan(createEntry())
  const encoded = encodeGearPlanShare(plan)

  assert.equal(
    encoded,
    '1.0900000001015000010030000100500000002000000',
  )
  assert.deepEqual(parseGearPlanShare(encoded), {
    plan,
    error: '',
  })
})
