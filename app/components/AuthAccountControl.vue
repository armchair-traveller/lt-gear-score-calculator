<script setup>
import { useMediaQuery } from '@vueuse/core'
import {
  AlertCircleIcon,
  ChevronDownIcon,
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

const isCompactHeaderControl = useMediaQuery(
  '(min-width: 768px) and (max-width: 1199px)',
)

const compactAccountLabel = computed(() => {
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

function startSignIn() {
  void signInWithDiscord(route.fullPath)
}

function startSignOut() {
  void signOut()
}

function retrySession() {
  void refreshSession()
}
</script>

<template>
  <div class="auth-account-control w-48 shrink-0">
    <Tooltip :disabled="!isCompactHeaderControl">
      <TooltipTrigger v-if="isSessionPending || isSigningIn" as-child>
        <Button
          variant="outline"
          size="sm"
          class="w-full justify-start"
          disabled
          aria-label="Checking account status"
        >
          <LoaderCircleIcon class="animate-spin" data-icon="inline-start" />
          <span class="auth-account-label min-w-0 flex-1 truncate text-left">
            {{ isSigningIn ? 'Opening Discord' : 'Checking account' }}
          </span>
        </Button>
      </TooltipTrigger>

      <DropdownMenu v-else-if="isAccountUnavailable">
        <TooltipTrigger as-child>
          <DropdownMenuTrigger as-child>
            <Button
              variant="outline"
              size="sm"
              class="w-full justify-start"
              aria-label="Account unavailable"
            >
              <AlertCircleIcon data-icon="inline-start" />
              <span class="auth-account-label min-w-0 flex-1 truncate text-left">
                Account unavailable
              </span>
              <ChevronDownIcon class="auth-account-chevron" data-icon="inline-end" />
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
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

      <DropdownMenu v-else-if="isSignedIn">
        <TooltipTrigger as-child>
          <DropdownMenuTrigger as-child>
            <Button
              variant="outline"
              size="sm"
              class="w-full justify-start"
              :aria-label="`Account menu for ${displayName}`"
            >
              <img
                v-if="userImage"
                :src="userImage"
                alt=""
                class="size-4 rounded-full object-cover"
                referrerpolicy="no-referrer"
              >
              <UserRoundIcon v-else data-icon="inline-start" />
              <span class="auth-account-label min-w-0 flex-1 truncate text-left">{{ displayName }}</span>
              <ChevronDownIcon class="auth-account-chevron" data-icon="inline-end" />
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
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

      <TooltipTrigger v-else as-child>
        <Button
          variant="outline"
          size="sm"
          class="w-full justify-start"
          aria-label="Sign in with Discord"
          @click="startSignIn"
        >
          <LogInIcon data-icon="inline-start" />
          <span class="auth-account-label">Sign in with Discord</span>
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom">
        {{ compactAccountLabel }}
      </TooltipContent>
    </Tooltip>
  </div>
</template>
