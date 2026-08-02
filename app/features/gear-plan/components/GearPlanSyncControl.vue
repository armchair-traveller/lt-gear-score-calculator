<script setup>
import { useMediaQuery } from '@vueuse/core'
import {
  CloudAlertIcon,
  CloudCheckIcon,
  CloudOffIcon,
  CloudUploadIcon,
  LoaderCircleIcon,
  RefreshCwIcon,
} from '@lucide/vue'
import { cn } from '@/lib/utils'

const props = defineProps({
  status: {
    type: String,
    default: 'local',
  },
  placement: {
    type: String,
    default: 'header',
  },
  pauseReason: {
    type: String,
    default: '',
  },
})

const emit = defineEmits(['open-conflict', 'retry', 'sign-in'])

const isCompactHeaderControl = useMediaQuery(
  '(min-width: 768px) and (max-width: 1199px)',
)

const statusDetails = computed(() => {
  const statuses = {
    local: {
      label: 'Save across devices',
      tooltip: 'Sign in to save this planner across devices',
      announcement: 'Planner changes are saved on this device.',
      icon: CloudUploadIcon,
      variant: 'outline',
      spinning: false,
    },
    checking: {
      label: 'Checking saves…',
      tooltip: 'Checking cloud saves',
      announcement: 'Checking cloud saves.',
      icon: LoaderCircleIcon,
      variant: 'secondary',
      spinning: true,
    },
    saving: {
      label: 'Saving…',
      tooltip: 'Saving planner to cloud',
      announcement: 'Saving planner to cloud.',
      icon: LoaderCircleIcon,
      variant: 'secondary',
      spinning: true,
    },
    saved: {
      label: 'Saved across devices',
      tooltip: 'Planner saved across devices',
      announcement: 'Planner saved across devices.',
      icon: CloudCheckIcon,
      variant: 'outline',
      spinning: false,
    },
    paused: {
      label: 'Save paused',
      tooltip: props.pauseReason === 'device'
        ? 'Planner could not be saved on this device'
        : 'Save across devices is paused',
      announcement: props.pauseReason === 'device'
        ? 'Planner could not be saved on this device. Retry after making storage available.'
        : 'Save across devices is paused. Planner changes remain saved on this device.',
      icon: CloudOffIcon,
      variant: 'outline',
      spinning: false,
    },
    conflict: {
      label: 'Choose version',
      tooltip: 'Choose which planner version to keep',
      announcement: 'Cloud planner conflict. Choose which version to keep.',
      icon: CloudAlertIcon,
      variant: 'outline',
      spinning: false,
    },
  }

  return statuses[props.status] ?? statuses.local
})

const compactTooltipEnabled = computed(() =>
  props.placement === 'header' && isCompactHeaderControl.value,
)

const surfaceClass = computed(() => cn(
  'gear-plan-sync-surface h-8 min-w-36 justify-start',
  props.placement === 'mobile' && 'w-full max-w-full',
))
</script>

<template>
  <div
    class="gear-plan-sync-control shrink-0"
    :data-placement="props.placement"
  >
    <Tooltip :disabled="!compactTooltipEnabled">
      <DropdownMenu v-if="props.status === 'paused'">
        <TooltipTrigger as-child>
          <DropdownMenuTrigger as-child>
            <Button
              variant="outline"
              size="sm"
              :class="surfaceClass"
              data-sync-control
              :aria-label="statusDetails.tooltip"
            >
              <component :is="statusDetails.icon" data-icon="inline-start" />
              <span class="gear-plan-sync-label">{{ statusDetails.label }}</span>
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <DropdownMenuContent align="end" class="w-72">
          <DropdownMenuLabel>
            <span class="block font-medium text-foreground">
              {{ props.pauseReason === 'device' ? 'Not saved on this device' : 'Saved on this device' }}
            </span>
            <span class="mt-0.5 block font-normal leading-relaxed">
              {{ props.pauseReason === 'device'
                ? 'Browser storage is unavailable or full. Cloud save was not attempted.'
                : 'The cloud copy could not be checked or updated. Your local planner is still available.' }}
            </span>
          </DropdownMenuLabel>
          <DropdownMenuGroup>
            <DropdownMenuItem @select="emit('retry')">
              <RefreshCwIcon />
              {{ props.pauseReason === 'device' ? 'Retry device save' : 'Retry cloud save' }}
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      <TooltipTrigger v-else-if="props.status === 'conflict'" as-child>
        <Button
          variant="outline"
          size="sm"
          :class="surfaceClass"
          data-sync-control
          :aria-label="statusDetails.tooltip"
          @click="emit('open-conflict')"
        >
          <component :is="statusDetails.icon" data-icon="inline-start" />
          <span class="gear-plan-sync-label">{{ statusDetails.label }}</span>
        </Button>
      </TooltipTrigger>

      <TooltipTrigger v-else-if="props.status === 'local'" as-child>
        <Button
          variant="outline"
          size="sm"
          :class="surfaceClass"
          data-sync-control
          :aria-label="statusDetails.tooltip"
          @click="emit('sign-in')"
        >
          <component :is="statusDetails.icon" data-icon="inline-start" />
          <span class="gear-plan-sync-label">{{ statusDetails.label }}</span>
        </Button>
      </TooltipTrigger>

      <TooltipTrigger v-else as-child>
        <Badge
          as="span"
          :variant="statusDetails.variant"
          :class="surfaceClass"
          data-sync-control
          :tabindex="compactTooltipEnabled ? 0 : undefined"
          :aria-label="statusDetails.tooltip"
        >
          <component
            :is="statusDetails.icon"
            :class="cn(statusDetails.spinning && 'animate-spin')"
            data-icon="inline-start"
          />
          <span class="gear-plan-sync-label">{{ statusDetails.label }}</span>
        </Badge>
      </TooltipTrigger>

      <TooltipContent side="bottom">
        {{ statusDetails.tooltip }}
      </TooltipContent>
    </Tooltip>

    <span class="sr-only" role="status" aria-live="polite" aria-atomic="true">
      {{ statusDetails.announcement }}
    </span>
  </div>
</template>
