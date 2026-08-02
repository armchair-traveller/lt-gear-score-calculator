import { computed, inject, provide, ref } from 'vue'
import { authClient } from '@/lib/auth-client.js'
import {
  getAuthErrorCallbackURL,
  sanitizeAuthReturnTo,
} from '@/utils/auth-navigation.js'

const authContextKey = Symbol('auth')

export function provideAuth() {
  const sessionState = authClient.useSession()
  const activeAction = ref('')
  const actionError = ref(null)

  const session = computed(() => sessionState.value?.data || null)
  const user = computed(() => session.value?.user || null)
  const sessionError = computed(() => sessionState.value?.error || null)
  const error = computed(() => actionError.value || sessionError.value)
  const isSessionPending = computed(() => Boolean(sessionState.value?.isPending))
  const isSessionRefetching = computed(() => Boolean(sessionState.value?.isRefetching))
  const isSignedIn = computed(() => Boolean(user.value))
  const isSigningIn = computed(() => activeAction.value === 'sign-in')
  const isSigningOut = computed(() => activeAction.value === 'sign-out')
  const isRefreshing = computed(() => activeAction.value === 'refresh' || isSessionRefetching.value)
  const isAccountUnavailable = computed(() =>
    !isSessionPending.value
    && Boolean(sessionError.value || actionError.value),
  )
  const status = computed(() => {
    if (isSessionPending.value || isRefreshing.value) {
      return 'loading'
    }

    if (isAccountUnavailable.value) {
      return 'unavailable'
    }

    return isSignedIn.value ? 'authenticated' : 'anonymous'
  })
  const displayName = computed(() => {
    const name = String(user.value?.name || '').trim()
    return name || 'Discord member'
  })
  const userImage = computed(() => {
    const image = String(user.value?.image || '').trim()
    return /^https:\/\//i.test(image) ? image : ''
  })

  async function signInWithDiscord(returnTo = '/') {
    if (activeAction.value) {
      return false
    }

    const callbackPath = sanitizeAuthReturnTo(returnTo)
    activeAction.value = 'sign-in'
    actionError.value = null

    try {
      const browserOrigin = globalThis.location?.origin
      if (!browserOrigin) {
        throw new Error('Discord sign-in requires a browser origin.')
      }

      const callbackURL = new URL(callbackPath, browserOrigin).toString()
      const errorCallbackURL = new URL(
        getAuthErrorCallbackURL(callbackPath),
        browserOrigin,
      ).toString()
      const response = await authClient.signIn.social({
        provider: 'discord',
        callbackURL,
        errorCallbackURL,
      })

      if (response?.error) {
        actionError.value = response.error
        return false
      }

      return true
    }
    catch (error) {
      actionError.value = error
      return false
    }
    finally {
      activeAction.value = ''
    }
  }

  async function signOut() {
    if (activeAction.value) {
      return false
    }

    activeAction.value = 'sign-out'
    actionError.value = null

    try {
      const response = await authClient.signOut()
      if (response?.error) {
        actionError.value = response.error
        return false
      }

      return true
    }
    catch (error) {
      actionError.value = error
      return false
    }
    finally {
      activeAction.value = ''
    }
  }

  async function refreshSession() {
    if (activeAction.value) {
      return false
    }

    activeAction.value = 'refresh'
    actionError.value = null

    try {
      await sessionState.value?.refetch?.()
      return !sessionState.value?.error
    }
    catch (error) {
      actionError.value = error
      return false
    }
    finally {
      activeAction.value = ''
    }
  }

  const auth = {
    session,
    user,
    status,
    error,
    displayName,
    userImage,
    isSessionPending,
    isSignedIn,
    isSigningIn,
    isSigningOut,
    isRefreshing,
    isAccountUnavailable,
    signInWithDiscord,
    signOut,
    refreshSession,
  }

  provide(authContextKey, auth)
  return auth
}

export function useAuth() {
  const auth = inject(authContextKey)

  if (!auth) {
    throw new Error('Auth context is missing.')
  }

  return auth
}

export const useAuthContext = useAuth
