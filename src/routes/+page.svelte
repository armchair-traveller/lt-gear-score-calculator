<script>
import { onMount } from 'svelte'
import { CalculatorState } from './index.svelte.js'
import GearDataInput from '$lib/components/GearDataInput.svelte'

const state = new CalculatorState()
let shareUrl = ''

onMount(() => {
  state.init()

  // Check for URL parameter on load
  const params = new URLSearchParams(window.location.search)
  const encodedData = params.get('data')

  if (encodedData) {
    try {
      const jsonString = atob(encodedData)
      const parsedData = JSON.parse(jsonString)
      console.log('Loaded from URL:', parsedData)
      applyGearSelections(parsedData)
    } catch (error) {
      console.error('Failed to load data from URL:', error)
    }
  }
})

function handleGearDataSubmit(event) {
  const parsedData = event.detail

  try {
    console.log('Received JSON data:', parsedData)

    // Apply the data directly to the calculator state
    // The AI should return exact matches from the gear reference
    applyGearSelections(parsedData)

    // Generate shareable URL
    generateShareUrl(parsedData)
  } catch (error) {
    console.error('Error processing gear data:', error)
  }
}

function applyGearSelections(data) {
  // Set the piece and type from the AI response
  // Note: In the gear structure, "piece" is the top-level key (e.g., '[9999] Badge 6')
  // and "type" is the sub-key (e.g., 'Badge')
  state.selectedType = data.piece // e.g., '[9999] Badge 6'
  state.selectedPiece = data.type // e.g., 'Badge'

  // Update stats
  data.stats.forEach((stat, index) => {
    if (index < 5) {
      // Only 5 stat slots available
      state.updateStat(index, stat.name)
      state.updateStatValue(index, stat.value)
    }
  })
}

function generateShareUrl(data) {
  const jsonString = JSON.stringify(data)
  const encoded = btoa(jsonString)
  const baseUrl = window.location.origin
  shareUrl = `${baseUrl}${window.location.pathname}?data=${encoded}`
}

function copyShareUrl() {
  if (shareUrl) {
    navigator.clipboard.writeText(shareUrl)
    // Could add visual feedback here
  }
}
</script>

<h1 style="text-align: center;">LaTale Gear Score Calculator</h1>

<GearDataInput on:submit={handleGearDataSubmit} />

{#if shareUrl}
  <div
    style="background-color: #e3f2fd; border: 1px solid #2196f3; border-radius: 8px; padding: 1rem; margin: 1rem auto; max-width: 800px;"
  >
    <p style="margin: 0 0 0.5rem 0; font-weight: 500;">Shareable URL:</p>
    <div style="display: flex; gap: 0.5rem; align-items: center;">
      <input
        type="text"
        readonly
        value={shareUrl}
        style="flex: 1; padding: 0.5rem; border: 1px solid #ccc; border-radius: 4px; font-family: monospace; font-size: 0.875rem;"
        onclick={(e) => e.target.select()}
      />
      <button
        type="button"
        onclick={copyShareUrl}
        style="padding: 0.5rem 1rem; background-color: #2196f3; color: white; border: none; border-radius: 4px; cursor: pointer; white-space: nowrap;"
      >
        📋 Copy
      </button>
    </div>
    <p style="margin: 0.5rem 0 0 0; font-size: 0.875rem; color: #666;">
      Share this URL to load the same gear configuration
    </p>
  </div>
{/if}

<h2 style="color: red;">
  <strong
    >⚠️ Note that this is hypothetical damage, and it may not represent actual damage versus actual content ⚠️<br />
    Please also note this calculator only calculates for a single item, your other stats and items may change how well it
    performs</strong
  >
</h2>
<span
  >Numbers are currently based on 1 Attack/Intensity = 110 Strength/Magic. If you want more detailed tests with more
  stats and items, please use the <a href="https://kedanao.github.io/lt-damage-calculator/">Damage Calculator</a></span
>
and detailed sheets linked below<br />
<span
  >Ratings are based on <strong style="color: blue;">+0 unupgraded enchant values</strong>, note that
  <strong style="color: blue;"
    >extra stats from level 3/4 enchants will increase the score and cannot be considered the same as +0 enchants</strong
  ></span
><br />
<br />
<!-- Mode:
  <select id="calculator-mode" onchange="refreshType()">
    <option value="Maximum">Maximum</option>
    <option value="Minimum">Minimum</option>
  </select>
  <span>Maximum mode is specifically for equipment before LL6 minimum damage change. <strong>Your scores may change once switching to Minimum mode</strong></span> -->
<div class="container" id="calculator-container">
  <div id="calculator-input">
    <div>
      Type:
      <select bind:value={state.selectedType} onchange={() => state.updateType(state.selectedType)}>
        {#each state.typeAvailable as type}
          <option value={type}>{type}</option>
        {/each}
      </select>
      Piece:
      <select bind:value={state.selectedPiece} onchange={() => state.updatePiece(state.selectedPiece)}>
        {#each state.piecesAvailable as piece}
          <option value={piece}>{piece}</option>
        {/each}
      </select>
      Max Rating:
      <span>{state.maxDI}%</span>
    </div>
    {#each [0, 1, 2, 3, 4] as i}
      <div>
        {i + 1}:
        <select bind:value={state.selectedStats[i]} onchange={() => state.updateStat(i, state.selectedStats[i])}>
          {#each state.statAvailable as stat}
            <option value={stat}>{stat}</option>
          {/each}
        </select>
        <input
          type="number"
          bind:value={state.statValues[i]}
          oninput={(e) => state.updateStatValue(i, e.target.value)}
        />
      </div>
    {/each}
    <div id="calculator-buttons">
      <button type="button" onclick={() => state.updateValues(0, 0)}>Clear</button>
      <button type="button" onclick={() => state.updateValues(2, 90)}>Duo</button>
      <button type="button" onclick={() => state.updateValues(3, 90)}>Trio</button>
      <button type="button" onclick={() => state.updateValues(4, 90)}>Quad</button>
      <button type="button" onclick={() => state.updateValues(5, 90)}>Penta</button>
    </div>
    <div id="calculator-link">
      {#if state.typeLink}
        <a href={state.typeLink}>Click here for detailed information on this piece of gear</a>
      {/if}
    </div>
  </div>
  <div id="calculator-results">
    <div id="calculator-di">Rating: {state.totalDI.toFixed(2)}%</div>
    <div id="calculator-percent">Score: {state.itemDI}%</div>
    <div id="calculator-tier">{state.finalTier} tier</div>
    <div id="calculator-potential">
      {#if state.potentialGains.max > 0}
        Potential Lucent Score: {state.potentialScores.min}%
        {#if state.potentialScores.min !== state.potentialScores.max}
          ~ {state.potentialScores.max}%
        {/if}
        <br />
        Potential Lucent Tier: {state.potentialScores.tierMin}
        {#if state.potentialScores.tierMin !== state.potentialScores.tierMax}
          ~ {state.potentialScores.tierMax}
        {/if}
      {/if}
    </div>
  </div>
  <div id="calculator-values">
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
        {#each state.statDetails.details as detail}
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
          <td><strong>{state.statDetails.limitScore.toFixed(0)}%</strong></td>
          <td><strong>Max Tier</strong></td>
          <td><strong>{state.statDetails.limitTier}</strong></td>
          <td><strong>Total</strong></td>
          <td><strong>{state.statDetails.limitDI.toFixed(2)}%</strong></td>
        </tr>
      </tbody>
    </table>
    {#if state.selectedPiece === 'Earrings'}
      <br />
      <span class="text-note">
        <span style="color: red;"><strong>Note:</strong></span>
        Defense Penetration is no longer a recommended stat as damage gain from going from 98 to 99 is lower than the damage
        gained from other stats
      </span>
    {/if}
  </div>
</div>
<div>
  <h3>Important notes</h3>
  <ul>
    <li>
      <strong>Minimum Damage</strong>: Value only applies as long as your Minimum is lower than your Maximum. Any amount
      above is wasted
    </li>
    <li>
      <strong>Attack/Intensity vs Strength/Magic</strong>: Older items (8k and below) utilize 1:100 ratio, while newer
      items (9k and above) use 1:110
      <br />Note that the calculator also considers higher strength/magic % than attack/intensity %, and a value of 12%
      strength/magic ratio
      <br />Generally this means flat strength/magic is superior to flat attack/intensity, however attack/intensity % is
      superior to strength/magic %
      <br />If you want to consider different numbers, please use the
      <a href="https://kedanao.github.io/lt-damage-calculator/">Damage Calculator</a> with your own stats and settings
    </li>
    <li><strong>Defense Penetration</strong>: Does not apply to summons, avoid in summon-heavy classes</li>
    <li>
      <strong>Back Attack Damage</strong>: Ignored within ratings due to class dependence. Can be worthwhile depending
      on class (functionally same as Critical when applicable)
    </li>
  </ul>
</div>
<div class="container" id="tier-container">
  <div id="tiers">
    <h2>Tier Evaluation</h2>
    <table>
      <thead>
        <tr>
          <th>Tier</th>
          <th>Comment</th>
          <th>Upgrade?</th>
          <th>Enchants</th>
          <th>Cost (per piece)</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>F - E</td>
          <td>Bad, replaces unfinished previous tier</td>
          <td>N</td>
          <td>Any</td>
          <td>0b - 5b</td>
        </tr>
        <tr>
          <td>D - C</td>
          <td>Minimum to replace previous tier</td>
          <td>N</td>
          <td>Duo</td>
          <td>5b - 30b</td>
        </tr>
        <tr>
          <td>B</td>
          <td>Good growth over previous tier, worth upgrading</td>
          <td>Y</td>
          <td>Trio</td>
          <td>60b - 120b</td>
        </tr>
        <tr>
          <td>A</td>
          <td>Great growth, only recommended for late endgame</td>
          <td>Y</td>
          <td>Quad</td>
          <td>200b+</td>
        </tr>
        <tr>
          <td>S - SSS</td>
          <td
            >Perfectionism, typically will only come with upgraded enchants<br />Pentas will cost several hundreds of
            billions of ely to make a single piece</td
          >
          <td>Y</td>
          <td>Penta</td>
          <td>1000b+</td>
        </tr>
      </tbody>
    </table>
  </div>
  <div id="equivalence">
    <h2>Equivalence</h2>
    <div id="equivalence-table">
      <table>
        <thead>
          <tr>
            <th>Score</th>
            <th>Tier</th>
            <th>Single</th>
            <th>Duo</th>
            <th>Trio</th>
            <th>Quad</th>
            <th>Penta</th>
          </tr>
        </thead>
        <tbody>
          {#each state.tierAvailable as tier}
            <tr>
              <td>{state.tierEquivalence[tier]['Score']}</td>
              <td>{tier}</td>
              <td>{state.tierEquivalence[tier]['Single']}</td>
              <td>{state.tierEquivalence[tier]['Duo']}</td>
              <td>{state.tierEquivalence[tier]['Trio']}</td>
              <td>{state.tierEquivalence[tier]['Quad']}</td>
              <td>{state.tierEquivalence[tier]['Penta']}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  </div>
</div>
<div class="container" id="priority-container">
  <div>
    <h2>Enchant Priority</h2>
    <div id="priority-enchant">
      <table>
        <thead>
          <tr>
            <th>Stat</th>
            <th>Max Value</th>
            <th>Max Rating</th>
          </tr>
        </thead>
        <tbody>
          {#each state.priorityStats as stat}
            <tr>
              <td>{stat.Stat}</td>
              <td>{stat.Value}</td>
              <td>{stat.DI.toFixed(2)}%</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  </div>
  <div>
    <h2>Recommended Enchants per Piece</h2>
    <div id="priority-best">
      <table>
        <thead>
          <tr>
            {#each state.recommendedStats as item}
              <th>{item.piece}</th>
            {/each}
          </tr>
        </thead>
        <tbody>
          {#each [0, 1, 2, 3, 4] as i}
            <tr>
              {#each state.recommendedStats as item}
                <td>{item.stats[i] || ''}</td>
              {/each}
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  </div>
</div>
