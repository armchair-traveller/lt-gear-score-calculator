<script setup>
import {
  CalculatorIcon,
  DiamondIcon,
  HelpCircleIcon,
  LoaderCircleIcon,
  LogInIcon,
  LogOutIcon,
  MoreHorizontalIcon,
  RefreshCwIcon,
  Rows3Icon,
} from '@lucide/vue'

const props = defineProps({
  active: {
    type: String,
    required: true,
  },
  eyebrow: {
    type: String,
    required: true,
  },
  title: {
    type: String,
    required: true,
  },
  description: {
    type: String,
    default: '',
  },
  showHelp: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['help'])
const route = useRoute()
const {
  displayName,
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

const navItems = [
  { value: 'calculator', label: 'Calculator', to: '/', icon: CalculatorIcon },
  { value: 'upgrade', label: 'Upgrade', to: '/upgrade', icon: DiamondIcon },
  { value: 'planner', label: 'Planner', to: '/plan', icon: Rows3Icon },
]

const primaryNavSegments = [
  { offset: 0, width: 6.75 },
  { offset: 6.75, width: 5.9375 },
  { offset: 12.6875, width: 5.6875 },
]

const activeNavIndex = computed(() => {
  return navItems.findIndex(item => item.value === props.active)
})

const primaryNavStyle = computed(() => {
  const segment = primaryNavSegments[activeNavIndex.value]

  if (!segment) {
    return {
      '--parade-primary-nav-pill-offset': '0rem',
      '--parade-primary-nav-pill-width': '0rem',
    }
  }

  return {
    '--parade-primary-nav-pill-offset': `${segment.offset}rem`,
    '--parade-primary-nav-pill-width': `${segment.width}rem`,
  }
})

function startMobileSignIn() {
  void signInWithDiscord(route.fullPath)
}

function startMobileSignOut() {
  void signOut()
}

function retryMobileSession() {
  void refreshSession()
}
</script>

<template>
  <header class="parade-app-header" :data-active="props.active">
    <a class="parade-skip-link" href="#main-content">Skip to main content</a>

    <div class="parade-appbar">
      <NuxtLink
        to="/"
        class="parade-brand"
        aria-label="LaTale Gear Toolkit home"
        aria-current-value="false"
      >
        <span class="parade-brand-mark">
          <img src="/favicon.ico" alt="">
        </span>
        <span class="min-w-0">
          <strong>LaTale Gear Toolkit</strong>
          <small>Community calculator suite</small>
        </span>
      </NuxtLink>

      <nav
        class="parade-primary-nav"
        aria-label="Primary navigation"
        :style="primaryNavStyle"
      >
        <span class="parade-primary-nav-pill" aria-hidden="true" />

        <Button
          v-for="item in navItems"
          :key="item.value"
          variant="ghost"
          size="sm"
          class="parade-primary-nav-item rounded-full"
          as-child
        >
          <NuxtLink :to="item.to" :aria-current="props.active === item.value ? 'page' : undefined">
            <component :is="item.icon" data-icon="inline-start" />
            <span>{{ item.label }}</span>
          </NuxtLink>
        </Button>

        <span class="parade-primary-nav-active-labels" aria-hidden="true">
          <span
            v-for="item in navItems"
            :key="`active-${item.value}`"
            class="parade-primary-nav-active-label"
          >
            <component :is="item.icon" />
            <span>{{ item.label }}</span>
          </span>
        </span>
      </nav>

      <div class="parade-utilities">
        <Button
          v-if="props.showHelp"
          variant="ghost"
          size="sm"
          class="parade-desktop-help"
          @click="emit('help')"
        >
          <HelpCircleIcon data-icon="inline-start" />
          Help
        </Button>
        <slot name="utilities" />
        <AuthAccountControl />
        <ModeToggle />
        <DropdownMenu>
          <DropdownMenuTrigger as-child>
            <Button variant="outline" size="icon" aria-label="More options">
              <MoreHorizontalIcon />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuGroup>
              <DropdownMenuItem v-if="props.showHelp" @click="emit('help')">
                <HelpCircleIcon />
                Help
              </DropdownMenuItem>
              <DropdownMenuItem as-child>
                <a href="https://www.latale.com/Main/" target="_blank" rel="noreferrer">
                  Official LaTale site
                </a>
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div class="parade-mobile-actions">
        <ModeToggle />
        <DropdownMenu>
          <DropdownMenuTrigger as-child>
            <Button variant="outline" size="icon" aria-label="More options">
              <MoreHorizontalIcon />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" class="w-64">
            <DropdownMenuLabel v-if="isAccountUnavailable">
              <span class="block font-medium text-foreground">Account unavailable</span>
              <span class="mt-0.5 block font-normal leading-relaxed">
                The toolkit still works without signing in.
              </span>
            </DropdownMenuLabel>
            <DropdownMenuLabel v-else-if="isSignedIn">
              <span class="block text-[10px] font-semibold uppercase tracking-[0.08em]">
                Signed in with Discord
              </span>
              <span class="mt-1 block truncate text-sm font-medium text-foreground">
                {{ displayName }}
              </span>
            </DropdownMenuLabel>
            <DropdownMenuGroup>
              <DropdownMenuItem v-if="isSessionPending" disabled>
                <LoaderCircleIcon class="animate-spin" />
                Checking account…
              </DropdownMenuItem>
              <DropdownMenuItem
                v-else-if="isAccountUnavailable"
                :disabled="isRefreshing"
                @select="retryMobileSession"
              >
                <LoaderCircleIcon v-if="isRefreshing" class="animate-spin" />
                <RefreshCwIcon v-else />
                {{ isRefreshing ? 'Checking again…' : 'Check account again' }}
              </DropdownMenuItem>
              <DropdownMenuItem
                v-else-if="isSignedIn"
                :disabled="isSigningOut"
                @select="startMobileSignOut"
              >
                <LoaderCircleIcon v-if="isSigningOut" class="animate-spin" />
                <LogOutIcon v-else />
                {{ isSigningOut ? 'Signing out…' : 'Sign out' }}
              </DropdownMenuItem>
              <DropdownMenuItem
                v-else
                :disabled="isSigningIn"
                @select="startMobileSignIn"
              >
                <LoaderCircleIcon v-if="isSigningIn" class="animate-spin" />
                <LogInIcon v-else />
                {{ isSigningIn ? 'Opening Discord…' : 'Sign in with Discord' }}
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem v-if="props.showHelp" @click="emit('help')">
                <HelpCircleIcon />
                Help
              </DropdownMenuItem>
              <DropdownMenuItem as-child>
                <a href="https://www.latale.com/Main/" target="_blank" rel="noreferrer">
                  Official LaTale site
                </a>
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>

    <section class="parade-artband">
      <div class="parade-artband-inner">
        <div class="parade-art-copy">
          <p class="parade-eyebrow">{{ props.eyebrow }}</p>
          <h1>{{ props.title }}</h1>
          <p v-if="props.description" class="parade-art-description">
            {{ props.description }}
          </p>
        </div>
      </div>
    </section>

    <nav class="parade-bottom-nav" aria-label="Mobile navigation">
      <NuxtLink
        v-for="item in navItems"
        :key="`mobile-${item.value}`"
        :to="item.to"
        :class="{ 'is-active': props.active === item.value }"
        :aria-current="props.active === item.value ? 'page' : undefined"
      >
        <component :is="item.icon" />
        <span>{{ item.label }}</span>
      </NuxtLink>
    </nav>
  </header>
</template>
