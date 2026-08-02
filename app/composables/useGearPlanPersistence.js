import {
  computed,
  inject,
  onBeforeUnmount,
  provide,
  readonly,
  ref,
  unref,
  watch,
} from 'vue'
import { getGearPlanSlotId } from '../features/gear-plan/data.js'
import {
  createEmptyGearPlan,
  parseGearPlanStrict,
} from '../features/gear-plan/plan-validation.js'
import {
  normalizeGearPlanUpdatedAt,
  readStoredGearPlan,
  readStoredGearPlanDeviceMeta,
  writeStoredGearPlan,
  writeStoredGearPlanDeviceMeta,
} from '../features/gear-plan/plan-state.js'

const gearPlanPersistenceKey = Symbol('gear-plan-persistence')

function getPlanSignature(plan) {
  return JSON.stringify(
    Object.keys(plan.slots)
      .sort()
      .map(slotId => [slotId, plan.slots[slotId]]),
  )
}

function getEntryCount(plan) {
  return Object.keys(plan.slots).length
}

function getTimestamp(now) {
  const value = now()
  const date = value instanceof Date ? value : new Date(value)
  return Number.isFinite(date.getTime())
    ? date.toISOString()
    : new Date().toISOString()
}

function parseCloudPayload(value) {
  if (
    !value
    || typeof value !== 'object'
    || !Number.isInteger(value.revision)
    || value.revision < 0
  ) {
    throw new TypeError('The cloud planner response is invalid.')
  }

  if (value.plan === null) {
    if (value.revision !== 0 || value.updatedAt !== null) {
      throw new TypeError('The absent cloud planner response is invalid.')
    }

    return {
      plan: createEmptyGearPlan(),
      revision: 0,
      updatedAt: null,
    }
  }

  const updatedAt = normalizeGearPlanUpdatedAt(value.updatedAt)
  if (value.revision === 0 || !updatedAt) {
    throw new TypeError('The saved cloud planner response is invalid.')
  }

  return {
    plan: parseGearPlanStrict(value.plan),
    revision: value.revision,
    updatedAt,
  }
}

function getConflictPayload(error) {
  const candidates = [
    error,
    error?.data?.data,
    error?.data,
    error?.response?._data?.data,
    error?.response?._data,
  ]

  for (const candidate of candidates) {
    if (candidate?.code !== 'GEAR_PLAN_CONFLICT' || !candidate.cloud) {
      continue
    }

    try {
      return parseCloudPayload(candidate.cloud)
    }
    catch {
      return null
    }
  }

  return null
}

export function createGearPlanPersistence({
  auth,
  storage = globalThis.localStorage,
  request,
  now = () => new Date(),
  eventTarget = globalThis.window,
  isOnline = () => globalThis.navigator?.onLine !== false,
  schedule = queueMicrotask,
} = {}) {
  if (typeof request !== 'function') {
    throw new TypeError('A gear plan request function is required.')
  }

  const planState = ref(readStoredGearPlan(storage))
  const syncStatusState = ref('local')
  const pauseReasonState = ref('')
  const conflictState = ref(null)
  const storedMetadata = readStoredGearPlanDeviceMeta(storage)
  const localUpdatedAtState = ref(storedMetadata.updatedAt)
  const entryCount = computed(() => getEntryCount(planState.value))

  let activeUserId = ''
  let deviceOwnerId = storedMetadata.ownerId
  let lastSignedInUserId = ''
  let authMode = 'unknown'
  let cloudEpoch = 0
  let reconciliationEpoch = null
  let reconciled = false
  let cloudRevision = null
  let conflictCloud = null
  let forceConflictForDeviceDifference = false
  let dirty = false
  let mutationSerial = 0
  let putScheduled = false
  let putInFlight = false
  let disposed = false
  let pendingDeviceWrite = null

  function setSyncStatus(status, pauseReason = '') {
    syncStatusState.value = status
    pauseReasonState.value = status === 'paused' ? pauseReason : ''
  }

  function pauseForDeviceWriteFailure() {
    setSyncStatus('paused', 'device')
  }

  function writeDeviceState(
    nextPlan,
    updatedAt,
    ownerId = deviceOwnerId,
    onPersist = () => {},
  ) {
    const canonicalPlan = parseGearPlanStrict(nextPlan)
    const canonicalUpdatedAt = normalizeGearPlanUpdatedAt(updatedAt)
    const canonicalOwnerId = ownerId || null
    const pendingWrite = {
      plan: canonicalPlan,
      updatedAt: canonicalUpdatedAt,
      ownerId: canonicalOwnerId,
      onPersist,
    }

    try {
      writeStoredGearPlan(canonicalPlan, storage)
    }
    catch {
      pendingDeviceWrite = pendingWrite
      console.error('[gear-plan-persistence] device_plan_write_failed')
      pauseForDeviceWriteFailure()
      return false
    }

    planState.value = canonicalPlan

    try {
      writeStoredGearPlanDeviceMeta(
        { updatedAt: canonicalUpdatedAt, ownerId: canonicalOwnerId },
        storage,
      )
    }
    catch {
      pendingDeviceWrite = pendingWrite
      console.error('[gear-plan-persistence] device_metadata_write_failed')
      pauseForDeviceWriteFailure()
      return false
    }

    localUpdatedAtState.value = canonicalUpdatedAt
    deviceOwnerId = canonicalOwnerId
    pendingDeviceWrite = null
    onPersist()
    return true
  }

  function writeDeviceMetadata(
    updatedAt,
    ownerId = deviceOwnerId,
    onPersist = () => {},
  ) {
    return writeDeviceState(
      planState.value,
      updatedAt,
      ownerId,
      onPersist,
    )
  }

  function getDeviceSummary() {
    return {
      entryCount: getEntryCount(planState.value),
      updatedAt: localUpdatedAtState.value,
    }
  }

  function getCloudSummary(cloud) {
    return {
      entryCount: getEntryCount(cloud.plan),
      updatedAt: cloud.updatedAt,
    }
  }

  function enterConflict(cloud) {
    conflictCloud = cloud
    dirty = true
    conflictState.value = {
      device: getDeviceSummary(),
      cloud: getCloudSummary(cloud),
    }
    setSyncStatus('conflict')
  }

  function updateConflictDeviceSummary() {
    if (!conflictCloud) {
      return
    }

    conflictState.value = {
      device: getDeviceSummary(),
      cloud: getCloudSummary(conflictCloud),
    }
  }

  function canSaveToCloud() {
    return Boolean(
      activeUserId
      && reconciled
      && !conflictCloud
      && !disposed,
    )
  }

  function queueCloudSave() {
    if (!canSaveToCloud() || !dirty) {
      return
    }

    if (!isOnline()) {
      setSyncStatus('paused', 'cloud')
      return
    }

    setSyncStatus('saving')
    if (putScheduled || putInFlight) {
      return
    }

    putScheduled = true
    schedule(() => {
      putScheduled = false
      void saveToCloud()
    })
  }

  async function saveToCloud() {
    if (putInFlight || !canSaveToCloud() || !dirty) {
      return
    }

    if (!isOnline()) {
      setSyncStatus('paused', 'cloud')
      return
    }

    putInFlight = true
    setSyncStatus('saving')

    const epoch = cloudEpoch
    const userId = activeUserId
    const serial = mutationSerial
    const snapshot = parseGearPlanStrict(planState.value)
    const snapshotSignature = getPlanSignature(snapshot)
    const expectedRevision = cloudRevision

    try {
      const response = await request('/api/gear-plan', {
        method: 'PUT',
        body: {
          plan: snapshot,
          expectedRevision,
        },
      })
      const cloud = parseCloudPayload(response)

      if (
        disposed
        || epoch !== cloudEpoch
        || userId !== activeUserId
      ) {
        return
      }

      cloudRevision = cloud.revision
      reconciled = true

      if (getPlanSignature(cloud.plan) !== snapshotSignature) {
        throw new TypeError('The saved cloud planner did not match the request.')
      }

      if (
        serial === mutationSerial
        && getPlanSignature(planState.value) === snapshotSignature
      ) {
        dirty = false
        const metadataPersisted = writeDeviceMetadata(
          cloud.updatedAt ?? localUpdatedAtState.value,
          activeUserId,
          () => {
            dirty = false
            setSyncStatus('saved')
          },
        )
        if (!metadataPersisted) {
          return
        }
      }
      else {
        dirty = true
      }
    }
    catch (error) {
      if (
        disposed
        || epoch !== cloudEpoch
        || userId !== activeUserId
      ) {
        return
      }

      const cloud = getConflictPayload(error)
      if (cloud) {
        enterConflict(cloud)
      }
      else {
        setSyncStatus('paused', 'cloud')
      }
    }
    finally {
      putInFlight = false
      if (
        canSaveToCloud()
        && dirty
        && syncStatusState.value !== 'paused'
      ) {
        queueCloudSave()
      }
    }
  }

  async function reconcileCloud(epoch, userId) {
    if (!isOnline()) {
      if (epoch === cloudEpoch && userId === activeUserId) {
        setSyncStatus('paused', 'cloud')
      }
      return
    }

    reconciliationEpoch = epoch
    setSyncStatus('checking')

    try {
      const cloud = parseCloudPayload(await request('/api/gear-plan', {
        method: 'GET',
      }))

      if (
        disposed
        || epoch !== cloudEpoch
        || userId !== activeUserId
      ) {
        return
      }

      cloudRevision = cloud.revision
      reconciled = true

      const deviceSignature = getPlanSignature(planState.value)
      const cloudSignature = getPlanSignature(cloud.plan)
      const deviceEntryCount = getEntryCount(planState.value)
      const cloudEntryCount = getEntryCount(cloud.plan)

      if (deviceSignature === cloudSignature) {
        dirty = false
        conflictCloud = null
        conflictState.value = null
        if (!localUpdatedAtState.value && cloud.updatedAt) {
          if (!writeDeviceMetadata(
            cloud.updatedAt,
            activeUserId,
            () => setSyncStatus('saved'),
          )) {
            return
          }
        }
        else if (deviceOwnerId !== activeUserId) {
          if (!writeDeviceMetadata(
            localUpdatedAtState.value,
            activeUserId,
            () => setSyncStatus('saved'),
          )) {
            return
          }
        }
        setSyncStatus('saved')
      }
      else if (
        deviceEntryCount > 0
        && cloudEntryCount === 0
        && cloud.revision === 0
        && !forceConflictForDeviceDifference
      ) {
        dirty = true
        queueCloudSave()
      }
      else if (deviceEntryCount === 0 && cloudEntryCount > 0) {
        dirty = false
        conflictCloud = null
        conflictState.value = null
        if (!writeDeviceState(
          cloud.plan,
          cloud.updatedAt,
          activeUserId,
          () => setSyncStatus('saved'),
        )) {
          return
        }
        setSyncStatus('saved')
      }
      else {
        enterConflict(cloud)
      }
    }
    catch (error) {
      if (
        !disposed
        && epoch === cloudEpoch
        && userId === activeUserId
      ) {
        setSyncStatus('paused', 'cloud')
      }
    }
    finally {
      if (reconciliationEpoch === epoch) {
        reconciliationEpoch = null
      }
    }
  }

  function startReconciliation() {
    if (!activeUserId || disposed) {
      return
    }

    const epoch = cloudEpoch
    if (reconciliationEpoch === epoch) {
      return
    }

    void reconcileCloud(epoch, activeUserId)
  }

  function resetCloudSession() {
    cloudEpoch += 1
    reconciliationEpoch = null
    reconciled = false
    cloudRevision = null
    conflictCloud = null
    conflictState.value = null
    forceConflictForDeviceDifference = false
    dirty = false
  }

  function handleAuthState(userId, isPending) {
    const nextUserId = typeof userId === 'string' ? userId.trim() : ''
    const nextMode = isPending
      ? 'pending'
      : nextUserId
        ? `user:${nextUserId}`
        : 'anonymous'

    if (nextMode === authMode) {
      return
    }

    authMode = nextMode
    resetCloudSession()

    if (isPending) {
      activeUserId = ''
      setSyncStatus(
        pendingDeviceWrite ? 'paused' : 'checking',
        pendingDeviceWrite ? 'device' : '',
      )
      return
    }

    activeUserId = nextUserId
    if (!activeUserId) {
      setSyncStatus(pendingDeviceWrite ? 'paused' : 'local', pendingDeviceWrite ? 'device' : '')
      return
    }

    forceConflictForDeviceDifference = Boolean(
      (deviceOwnerId && deviceOwnerId !== activeUserId)
      || (lastSignedInUserId && lastSignedInUserId !== activeUserId),
    )
    lastSignedInUserId = activeUserId
    if (pendingDeviceWrite) {
      setSyncStatus('paused', 'device')
      return
    }
    if (!deviceOwnerId) {
      const epoch = cloudEpoch
      const userId = activeUserId
      if (!writeDeviceMetadata(
        localUpdatedAtState.value,
        activeUserId,
        () => {
          if (epoch === cloudEpoch && userId === activeUserId) {
            setSyncStatus('checking')
            startReconciliation()
          }
        },
      )) {
        return
      }
      return
    }
    setSyncStatus('checking')
    startReconciliation()
  }

  function finishLocalMutation() {
    mutationSerial += 1
    dirty = true

    if (conflictCloud) {
      updateConflictDeviceSummary()
      setSyncStatus('conflict')
    }
    else if (authMode === 'pending') {
      setSyncStatus('checking')
    }
    else if (!activeUserId) {
      setSyncStatus('local')
    }
    else if (!reconciled) {
      setSyncStatus('checking')
      startReconciliation()
    }
    else {
      queueCloudSave()
    }
  }

  function commitLocalPlan(nextPlan) {
    let canonicalPlan
    try {
      canonicalPlan = parseGearPlanStrict(nextPlan)
    }
    catch {
      return false
    }

    const updatedAt = getTimestamp(now)
    return writeDeviceState(
      canonicalPlan,
      updatedAt,
      deviceOwnerId,
      finishLocalMutation,
    )
  }

  function saveEntry(entry) {
    if (!entry || typeof entry !== 'object') {
      return false
    }

    const slotId = getGearPlanSlotId(entry.gearType, entry.pieceType)
    return commitLocalPlan({
      version: 1,
      slots: {
        ...(pendingDeviceWrite?.plan ?? planState.value).slots,
        [slotId]: entry,
      },
    })
  }

  function deleteEntry(slotId) {
    const workingPlan = pendingDeviceWrite?.plan ?? planState.value
    if (typeof slotId !== 'string' || !workingPlan.slots[slotId]) {
      return false
    }

    const slots = { ...workingPlan.slots }
    delete slots[slotId]
    return commitLocalPlan({ version: 1, slots })
  }

  function replacePlan(nextPlan) {
    return commitLocalPlan(nextPlan)
  }

  function resetPlan() {
    return commitLocalPlan(createEmptyGearPlan())
  }

  function retry() {
    if (pendingDeviceWrite) {
      const pendingWrite = pendingDeviceWrite
      return writeDeviceState(
        pendingWrite.plan,
        pendingWrite.updatedAt,
        pendingWrite.ownerId,
        pendingWrite.onPersist,
      )
    }

    if (!activeUserId || disposed || conflictCloud) {
      return false
    }

    if (!isOnline()) {
      setSyncStatus('paused', 'cloud')
      return false
    }

    if (!reconciled) {
      startReconciliation()
    }
    else if (dirty) {
      queueCloudSave()
    }
    else {
      resetCloudSession()
      activeUserId = authMode.startsWith('user:')
        ? authMode.slice('user:'.length)
        : ''
      setSyncStatus('checking')
      startReconciliation()
    }

    return true
  }

  function useCloudPlan() {
    if (!conflictCloud) {
      return false
    }

    const cloud = conflictCloud
    return writeDeviceState(
      cloud.plan,
      cloud.updatedAt,
      activeUserId,
      () => {
        cloudRevision = cloud.revision
        reconciled = true
        conflictCloud = null
        conflictState.value = null
        dirty = false
        setSyncStatus(activeUserId ? 'saved' : 'local')
      },
    )
  }

  function replaceCloudWithDevice() {
    if (!conflictCloud || !activeUserId) {
      return false
    }

    cloudRevision = conflictCloud.revision
    reconciled = true
    conflictCloud = null
    conflictState.value = null
    dirty = true
    queueCloudSave()
    return true
  }

  function handleOnline() {
    if (syncStatusState.value === 'paused' && pauseReasonState.value === 'cloud') {
      retry()
    }
  }

  eventTarget?.addEventListener?.('online', handleOnline)

  const stopAuthWatch = auth
    ? watch(
        [
          () => unref(auth.user)?.id ?? '',
          () => Boolean(unref(auth.isSessionPending)),
        ],
        ([userId, isPending]) => handleAuthState(userId, isPending),
        { immediate: true },
      )
    : (() => {
        handleAuthState('', false)
        return () => {}
      })()

  function dispose() {
    disposed = true
    cloudEpoch += 1
    stopAuthWatch()
    eventTarget?.removeEventListener?.('online', handleOnline)
  }

  return {
    plan: readonly(planState),
    syncStatus: readonly(syncStatusState),
    pauseReason: readonly(pauseReasonState),
    conflict: readonly(conflictState),
    localUpdatedAt: readonly(localUpdatedAtState),
    entryCount,
    saveEntry,
    deleteEntry,
    replacePlan,
    resetPlan,
    retry,
    useCloudPlan,
    replaceCloudWithDevice,
    dispose,
  }
}

export function provideGearPlanPersistence({ auth, request } = {}) {
  const persistence = createGearPlanPersistence({
    auth,
    request: request ?? ((path, options) => $fetch(path, options)),
  })

  provide(gearPlanPersistenceKey, persistence)
  onBeforeUnmount(persistence.dispose)
  return persistence
}

export function useGearPlanPersistence() {
  const persistence = inject(gearPlanPersistenceKey)
  if (!persistence) {
    throw new Error('Gear plan persistence context is missing.')
  }

  return persistence
}
