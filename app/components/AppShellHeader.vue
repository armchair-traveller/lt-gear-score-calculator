<script setup>
import {
  CalculatorIcon,
  DiamondIcon,
  HelpCircleIcon,
  MoreHorizontalIcon,
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

const navItems = [
  { value: 'calculator', label: 'Calculator', to: '/', icon: CalculatorIcon },
  { value: 'upgrade', label: 'Upgrade', to: '/upgrade', icon: DiamondIcon },
  { value: 'planner', label: 'Planner', to: '/plan', icon: Rows3Icon },
]
</script>

<template>
  <header class="parade-app-header">
    <div class="parade-appbar">
      <NuxtLink to="/" class="parade-brand" aria-label="LaTale Gear Toolkit home">
        <span class="parade-brand-mark">
          <img src="/favicon.ico" alt="">
        </span>
        <span class="min-w-0">
          <strong>LaTale Gear Toolkit</strong>
          <small>Community calculator suite</small>
        </span>
      </NuxtLink>

      <nav class="parade-primary-nav" aria-label="Primary navigation">
        <Button
          v-for="item in navItems"
          :key="item.value"
          :variant="props.active === item.value ? 'default' : 'ghost'"
          size="sm"
          class="rounded-full"
          as-child
        >
          <NuxtLink :to="item.to" :aria-current="props.active === item.value ? 'page' : undefined">
            <component :is="item.icon" data-icon="inline-start" />
            {{ item.label }}
          </NuxtLink>
        </Button>
      </nav>

      <div class="parade-utilities">
        <Button v-if="props.showHelp" variant="ghost" size="sm" @click="emit('help')">
          <HelpCircleIcon data-icon="inline-start" />
          Help
        </Button>
        <slot name="utilities" />
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
