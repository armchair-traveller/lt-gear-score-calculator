<script setup>
import {
  ArrowLeftIcon,
  LoaderCircleIcon,
  LogInIcon,
  ShieldAlertIcon,
} from '@lucide/vue'
import {
  getAuthErrorMessage,
  sanitizeAuthReturnTo,
} from '@/utils/auth-navigation.js'

useHead({
  title: 'Account access · LaTale Tools',
})

const route = useRoute()
const {
  isSigningIn,
  signInWithDiscord,
} = useAuth()

const returnTo = computed(() => sanitizeAuthReturnTo(route.query.returnTo))
const errorMessage = computed(() => getAuthErrorMessage(route.query.error))

function retrySignIn() {
  void signInWithDiscord(returnTo.value)
}
</script>

<template>
  <div class="parade-route">
    <main
      id="main-content"
      data-route-main="/auth/error"
      tabindex="-1"
      class="parade-workspace flex min-h-[calc(100vh-186px)] items-center justify-center"
    >
      <Card class="parade-card w-full max-w-xl border">
        <CardHeader>
          <Badge variant="secondary">
            <ShieldAlertIcon data-icon="inline-start" />
            Account access
          </Badge>
          <CardTitle class="mt-2 text-xl sm:text-2xl">
            {{ errorMessage.title }}
          </CardTitle>
          <CardDescription class="leading-relaxed">
            {{ errorMessage.description }}
          </CardDescription>
        </CardHeader>

        <CardContent>
          <p class="leading-relaxed text-muted-foreground">
            You can keep using the calculator, upgrade workbench, and local planner without an account.
          </p>
        </CardContent>

        <CardFooter class="flex-col items-stretch gap-2 border-t sm:flex-row sm:items-center">
          <Button :disabled="isSigningIn" @click="retrySignIn">
            <LoaderCircleIcon v-if="isSigningIn" class="animate-spin" data-icon="inline-start" />
            <LogInIcon v-else data-icon="inline-start" />
            {{ isSigningIn ? 'Opening Discord…' : 'Try Discord again' }}
          </Button>
          <Button variant="outline" as-child>
            <NuxtLink :to="returnTo">
              <ArrowLeftIcon data-icon="inline-start" />
              Back to the toolkit
            </NuxtLink>
          </Button>
        </CardFooter>
      </Card>
    </main>
  </div>
</template>
