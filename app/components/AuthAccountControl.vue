<script setup>
import {
  AlertCircleIcon,
  LoaderCircleIcon,
  LogInIcon,
  LogOutIcon,
  RefreshCwIcon,
  UserRoundIcon,
} from '@lucide/vue'

const route = useRoute()
const {
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
} = useAuth()
const avatarFailed = ref(false)
const isAccountTooltipOpen = ref(false)

watch(userImage, () => {
  avatarFailed.value = false
})

const accountLabel = computed(() => {
  if (isSigningIn.value) {
    return 'Opening Discord'
  }

  if (isSessionPending.value) {
    return 'Checking account'
  }

  if (isAccountUnavailable.value) {
    return 'Account unavailable'
  }

  if (isSignedIn.value) {
    return displayName.value
  }

  return 'Sign in with Discord'
})

watch(accountLabel, () => {
  isAccountTooltipOpen.value = false
})

function startSignIn() {
  void signInWithDiscord(route.fullPath)
}

function startSignOut() {
  void signOut()
}

function retrySession() {
  void refreshSession()
}

function openAccountTooltipOnKeyboardFocus(event) {
  if (event.target?.matches?.(':focus-visible')) {
    isAccountTooltipOpen.value = true
  }
}
</script>

<template>
  <div class="shrink-0">
    <Tooltip v-if="isSessionPending || isSigningIn" :delay-duration="200">
      <TooltipTrigger as-child>
        <Button
          variant="outline"
          size="icon"
          disabled
          :aria-label="accountLabel"
          aria-busy="true"
        >
          <LoaderCircleIcon class="animate-spin" data-icon="inline-start" />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom">
        {{ accountLabel }}
      </TooltipContent>
    </Tooltip>

    <Tooltip
      v-else-if="isAccountUnavailable"
      v-model:open="isAccountTooltipOpen"
      :delay-duration="200"
    >
      <TooltipTrigger as-child>
        <span
          class="inline-flex"
          data-account-tooltip-anchor
          @focusin="openAccountTooltipOnKeyboardFocus"
          @focusout="isAccountTooltipOpen = false"
        >
          <DropdownMenu>
            <DropdownMenuTrigger as-child>
              <Button
                variant="outline"
                size="icon"
                aria-label="Account unavailable"
              >
                <AlertCircleIcon data-icon="inline-start" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" class="w-64">
              <DropdownMenuLabel>
                <span class="block font-medium text-foreground">Account unavailable</span>
                <span class="mt-0.5 block font-normal leading-relaxed">
                  We could not check your account. The toolkit still works without signing in.
                </span>
              </DropdownMenuLabel>
              <DropdownMenuGroup>
                <DropdownMenuItem :disabled="isRefreshing" @select="retrySession">
                  <LoaderCircleIcon v-if="isRefreshing" class="animate-spin" />
                  <RefreshCwIcon v-else />
                  {{ isRefreshing ? 'Checking again…' : 'Check again' }}
                </DropdownMenuItem>
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </span>
      </TooltipTrigger>
      <TooltipContent side="bottom" align="end" :side-offset="6">
        Account unavailable
      </TooltipContent>
    </Tooltip>

    <Tooltip
      v-else-if="isSignedIn"
      v-model:open="isAccountTooltipOpen"
      :delay-duration="200"
    >
      <TooltipTrigger as-child>
        <span
          class="inline-flex"
          data-account-tooltip-anchor
          @focusin="openAccountTooltipOnKeyboardFocus"
          @focusout="isAccountTooltipOpen = false"
        >
          <DropdownMenu>
            <DropdownMenuTrigger as-child>
              <Button
                variant="outline"
                size="icon"
                :aria-label="`Account menu for ${displayName}`"
              >
                <img
                  v-if="userImage && !avatarFailed"
                  :src="userImage"
                  alt=""
                  class="size-5 rounded-full object-cover"
                  referrerpolicy="no-referrer"
                  @error="avatarFailed = true"
                >
                <UserRoundIcon v-else data-icon="inline-start" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" class="w-64">
              <DropdownMenuLabel>
                <span class="block text-[10px] font-semibold uppercase tracking-[0.08em]">
                  Signed in with Discord
                </span>
                <span class="mt-1 block truncate text-sm font-medium text-foreground">
                  {{ displayName }}
                </span>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuItem :disabled="isSigningOut" @select="startSignOut">
                  <LoaderCircleIcon v-if="isSigningOut" class="animate-spin" />
                  <LogOutIcon v-else />
                  {{ isSigningOut ? 'Signing out…' : 'Sign out' }}
                </DropdownMenuItem>
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </span>
      </TooltipTrigger>
      <TooltipContent side="bottom" align="end" :side-offset="6">
        {{ displayName }}
      </TooltipContent>
    </Tooltip>

    <Tooltip v-else :delay-duration="200">
      <TooltipTrigger as-child>
        <Button
          variant="outline"
          size="icon"
          aria-label="Sign in with Discord"
          @click="startSignIn"
        >
          <LogInIcon data-icon="inline-start" />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom">
        {{ accountLabel }}
      </TooltipContent>
    </Tooltip>
  </div>
</template>
