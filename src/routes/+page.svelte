<script>
import { onMount } from 'svelte'
import { CalculatorState } from './index.svelte.js'
import { generateAIPrompt } from '$lib/utils/aiPrompt.js'

const calculatorState = new CalculatorState()
let hasData = $state(false)
let showPrompt = $state(false)
let currentUrl = $state('')

let AI_PROMPT = $derived(generateAIPrompt(currentUrl))

onMount(() => {
  currentUrl = window.location.origin + window.location.pathname
  calculatorState.init()

  // Check for URL parameter on load
  const params = new URLSearchParams(window.location.search)
  const encodedData = params.get('data')

  if (encodedData) {
    try {
      const jsonString = atob(encodedData)
      const parsedData = JSON.parse(jsonString)
      console.log('Loaded from URL:', parsedData)
      applyGearSelections(parsedData)
      hasData = true
    } catch (error) {
      console.error('Failed to load data from URL:', error)
      hasData = false
    }
  }
})

function applyGearSelections(data) {
  // Set the piece and type from the AI response
  // Note: In the gear structure, "piece" is the top-level key (e.g., '[9999] Badge 6')
  // and "type" is the sub-key (e.g., 'Badge')
  calculatorState.selectedType = data.piece // e.g., '[9999] Badge 6'
  calculatorState.selectedPiece = data.type // e.g., 'Badge'

  // Update stats
  data.stats.forEach((stat, index) => {
    if (index < 5) {
      // Only 5 stat slots available
      calculatorState.updateStat(index, stat.name)
      calculatorState.updateStatValue(index, stat.value)
    }
  })
}

function copyPrompt() {
  navigator.clipboard.writeText(AI_PROMPT)
}
</script>

{#if !hasData}
  <!-- Welcome View -->
  <div class="max-w-3xl mx-auto my-8 px-8 text-center">
    <h1>LaTale Gear Score Calculator</h1>

    <div class="bg-gray-100 rounded-lg p-8 my-8 text-left">
      <h2>How to Use</h2>
      <ol class="leading-relaxed" style="line-height: 2;">
        <li>
          <button
            type="button"
            onclick={() => (showPrompt = !showPrompt)}
            class="text-blue-600 hover:text-blue-800 underline bg-transparent border-0 cursor-pointer font-normal p-0"
          >
            {showPrompt ? 'Hide' : 'Show'} AI Prompt
          </button>
          {#if showPrompt}
            <div class="mt-2 bg-white rounded p-4 border border-gray-300">
              <button
                type="button"
                onclick={copyPrompt}
                class="mb-2 px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 border-0 cursor-pointer"
              >
                📋 Copy Prompt
              </button>
              <pre
                class="text-xs overflow-auto bg-gray-50 p-3 rounded border border-gray-200 max-h-96">{AI_PROMPT}</pre>
              <p class="mt-2 p-2 bg-green-50 rounded text-xs">This prompt generates both JSON and clickable URLs</p>
            </div>
          {/if}
        </li>
        <li>Use ChatGPT, Claude, or any AI chat with vision capabilities</li>
        <li>Upload your equipment screenshot and paste the prompt above</li>
        <li>Click the generated URL from the AI response to view your gear score</li>
      </ol>

      <h3 class="mt-8">Need the Full Calculator?</h3>
      <p>For manual input, detailed stats, tier evaluations, and enchant recommendations, visit:</p>
      <a
        href="https://kedanao.github.io/lt-gear-score-calculator/"
        class="inline-block mt-4 px-6 py-3 bg-black hover:bg-gray-800 text-white no-underline rounded font-medium transition-colors"
      >
        Go to Full Calculator
      </a>
    </div>
  </div>
{:else}
  <!-- Results View -->
  <h1 class="text-center">LaTale Gear Score</h1>

  <small>
    <strong class="text-red-600">
      ⚠️ Note that this is hypothetical damage, and it may not represent actual damage versus actual content ⚠️<br />
      Please also note this calculator only calculates for a single item, your other stats and items may change how well
      it performs
    </strong>
  </small>

  <p class="text-center my-4">
    Numbers are currently based on 1 Attack/Intensity = 110 Strength/Magic. For more detailed tests with more stats and
    items, visit the
    <a href="https://kedanao.github.io/lt-gear-score-calculator/">Full Calculator</a>
  </p>

  <div class="container" id="calculator-container">
    <div id="calculator-results" class="my-8 mx-auto max-w-xl">
      <div class="bg-gray-100 rounded-lg p-8 text-center">
        <div class="mb-4">
          <strong>Equipment:</strong>
          {calculatorState.selectedType} - {calculatorState.selectedPiece}
        </div>
        <div id="calculator-di" class="text-4xl font-bold text-blue-500 my-4">
          Rating: {calculatorState.totalDI.toFixed(2)}%
        </div>
        <div id="calculator-percent" class="text-2xl my-2">
          Score: {calculatorState.itemDI}%
        </div>
        <div id="calculator-tier" class="text-2xl font-bold text-green-500 my-2">
          {calculatorState.finalTier} tier
        </div>
        <div id="calculator-potential" class="mt-4 text-sm text-gray-600">
          {#if calculatorState.potentialGains.max > 0}
            Potential Lucent Score: {calculatorState.potentialScores.min}%
            {#if calculatorState.potentialScores.min !== calculatorState.potentialScores.max}
              ~ {calculatorState.potentialScores.max}%
            {/if}
            <br />
            Potential Lucent Tier: {calculatorState.potentialScores.tierMin}
            {#if calculatorState.potentialScores.tierMin !== calculatorState.potentialScores.tierMax}
              ~ {calculatorState.potentialScores.tierMax}
            {/if}
          {/if}
        </div>
        {#if calculatorState.typeLink}
          <div class="mt-6">
            <a
              href={calculatorState.typeLink}
              class="text-black hover:text-gray-700 font-medium underline decoration-2 underline-offset-4 transition-colors"
            >
              Click here for detailed information on this piece of gear
            </a>
          </div>
        {/if}
      </div>
    </div>

    <div id="calculator-values" class="max-w-4xl my-8 mx-auto">
      <table>
        <thead>
          <tr>
            <th>Stat</th>
            <th>Max Value</th>
            <th>Your %</th>
            <th>Tier</th>
            <th>Your Rating</th>
            <th>Max Rating</th>
          </tr>
        </thead>
        <tbody>
          {#each calculatorState.statDetails.details as detail}
            <tr>
              <td>{detail.stat}</td>
              <td>{detail.maxValue}</td>
              <td>{detail.percentage}%</td>
              <td>{detail.tier}</td>
              <td>{detail.currentDI.toFixed(2)}%</td>
              <td>{detail.maxDI.toFixed(2)}%</td>
            </tr>
          {/each}
          <tr>
            <td><strong>Max Score (Chosen Stats)</strong></td>
            <td><strong>{calculatorState.statDetails.limitScore.toFixed(0)}%</strong></td>
            <td><strong>Max Tier</strong></td>
            <td><strong>{calculatorState.statDetails.limitTier}</strong></td>
            <td><strong>Total</strong></td>
            <td><strong>{calculatorState.statDetails.limitDI.toFixed(2)}%</strong></td>
          </tr>
        </tbody>
      </table>
      {#if calculatorState.selectedPiece === 'Earrings'}
        <br />
        <span class="text-note">
          <span class="text-red-600"><strong>Note:</strong></span>
          Defense Penetration is no longer a recommended stat as damage gain from going from 98 to 99 is lower than the damage
          gained from other stats
        </span>
      {/if}
    </div>
  </div>

  <div class="text-center my-8">
    <a
      href="https://kedanao.github.io/lt-gear-score-calculator/"
      class="inline-block px-6 py-3 bg-black hover:bg-gray-800 text-white no-underline rounded font-medium transition-colors"
    >
      View Full Calculator with Tier Info & Enchant Recommendations
    </a>
  </div>
{/if}
