<script>
import { createEventDispatcher } from 'svelte'
import { gearReference } from '$lib/data/gearReference.js'

const dispatch = createEventDispatcher()

let jsonInput = ''
let error = null
let showPrompt = false
let showUrlPrompt = false
let currentUrl = ''

$: if (typeof window !== 'undefined') {
  currentUrl = window.location.origin + window.location.pathname
}

const BASE_PROMPT = `Extract equipment data from the image(s) and return ONLY valid JSON with this structure:

For a SINGLE equipment image:
\`\`\`json
{
  "type": "equipment type - MUST match exactly from reference below",
  "piece": "equipment piece category - MUST match exactly from reference below",
  "stats": [
    {"name": "stat name - MUST match exactly from reference below", "value": number, "isPercentage": boolean}
  ]
}
\`\`\`

For MULTIPLE equipment images (provide each in separate code blocks):
\`\`\`json
{
  "type": "Crystal",
  "piece": "[9000] Accessories",
  "stats": [...]
}
\`\`\`

\`\`\`json
{
  "type": "Stone",
  "piece": "[8000] Weapons",
  "stats": [...]
}
\`\`\`

CRITICAL INSTRUCTIONS:
1. If there are MULTIPLE equipment items in the image(s), extract EACH ONE separately
   - Output each equipment as its own JSON code block
   - Do NOT combine multiple items into one JSON object
   
2. "piece" is NOT the item's actual name (e.g., NOT "Dark Elf Crystal")
   - "piece" is the equipment CATEGORY from the reference (e.g., "[9000] Accessories", "[8000] Weapons")
   - Look at the equipment reference below and find which category contains this type of item
   - Example: A crystal item belongs to "[9000] Accessories" or "[5000] Accessories"
   
3. "type" is the equipment slot within that category
   - For accessories: Crystal, Glasses, Stockings, Cloak, Earrings, Ring
   - For weapons: Main, Stone
   - For armor: Helmet, Chestplate, Fauld, Gloves, Boots
   - For badges: Badge
   
4. ONLY extract stats that have "Lv. #" prefix (these are enchants)
   - IGNORE any stats without "Lv. #" prefix (these are base item stats, not enchants)
   - Only enchanted stats should be in the stats array
   
5. All values MUST exactly match the keys in the Equipment Reference below

How to determine the "piece" category:
- Look at the item level/tier indicators in the image
- 9999 level items → "[9999] Badge 6"
- 9000 level items → "[9000] Accessories"
- 8000 level items → "[8000] Weapons"
- 7000 level items → "[7000] Accessories"
- 6000 level items → "[6000] Armor"
- 5000 level items → "[5000] Accessories"
- 4000 level items → "[4000] Weapon"
- 3500 level items → "[3500] Badge 6"

Examples:
- Dark Elf Crystal (9000 level) → "piece": "[9000] Accessories", "type": "Crystal"
- Lucent Stone (8000 level) → "piece": "[8000] Weapons", "type": "Stone"
- Eminent Breastplate (6000 level) → "piece": "[6000] Armor", "type": "Chestplate"

For stats (ONLY those with "Lv. #" prefix):
- "Lv. 2 Attack/Intensity +14%" → {"name": "Attack/Intensity %", "value": 14, "isPercentage": true}
- "Lv. 2 Strength/Magic +18419" → {"name": "Strength/Magic", "value": 18419, "isPercentage": false}
- "Critical Damage +80" (NO Lv. prefix) → SKIP THIS, it's a base stat
- "Attack/Intensity +150" (NO Lv. prefix) → SKIP THIS, it's a base stat
- Stat names with "%" in the image → add " %" at end of name and set isPercentage: true
- Stat names without "%" → no " %" in name and set isPercentage: false

Equipment Reference (use EXACT keys for "piece" and "type"):
${JSON.stringify(gearReference, null, 2)}

Return each equipment's JSON in its own code block with json syntax highlighting.`

$: URL_GENERATION_ADDON = `

ADDITIONAL TASK: Generate shareable URL(s)
After providing the JSON, also generate direct link(s) that load the gear configuration:

For SINGLE equipment:
1. Take the JSON you created
2. Encode it to base64
3. Create URL: ${currentUrl || 'CURRENT_PAGE_URL'}?data=BASE64_ENCODED_JSON

For MULTIPLE equipment items:
1. For EACH JSON code block you provided
2. Encode that specific JSON to base64
3. Create a separate URL for each equipment
4. Label each URL clearly (e.g., "URL for Crystal:", "URL for Stone:")

Example single item:
\`\`\`json
{"type":"Crystal","piece":"[9000] Accessories","stats":[...]}
\`\`\`
URL: ${currentUrl || 'CURRENT_PAGE_URL'}?data=eyJ0eXBlIjoiQ3J5c3RhbCI...

Example multiple items:
\`\`\`json
{"type":"Crystal","piece":"[9000] Accessories","stats":[...]}
\`\`\`
URL for Crystal: ${currentUrl || 'CURRENT_PAGE_URL'}?data=eyJ0eXBlIjoiQ3J5c3RhbCI...

\`\`\`json
{"type":"Stone","piece":"[8000] Weapons","stats":[...]}
\`\`\`
URL for Stone: ${currentUrl || 'CURRENT_PAGE_URL'}?data=eyJ0eXBlIjoiU3RvbmUi...

Provide JSON code blocks AND their corresponding shareable URLs so users can either:
- Paste the JSON manually, OR
- Click the URL to load it automatically`

const PROMPT_TEMPLATE = BASE_PROMPT
$: PROMPT_WITH_URL = BASE_PROMPT + URL_GENERATION_ADDON

function handleSubmit() {
  error = null

  if (!jsonInput.trim()) {
    error = 'Please paste the JSON data'
    return
  }

  try {
    const parsedData = JSON.parse(jsonInput)

    // Validate structure
    if (!parsedData.type || !parsedData.piece || !Array.isArray(parsedData.stats)) {
      error = 'Invalid JSON structure. Must have type, piece, and stats array.'
      return
    }

    // Validate that piece exists in reference
    if (!gearReference[parsedData.piece]) {
      error = `Invalid piece "${parsedData.piece}". Must be one of: ${Object.keys(gearReference).join(', ')}`
      return
    }

    // Validate that type exists under this piece
    if (!gearReference[parsedData.piece][parsedData.type]) {
      error = `Invalid type "${parsedData.type}" for piece "${parsedData.piece}". Must be one of: ${Object.keys(gearReference[parsedData.piece]).join(', ')}`
      return
    }

    // Validate stat names
    const validStats = gearReference[parsedData.piece][parsedData.type]
    const invalidStats = parsedData.stats.map((s) => s.name).filter((name) => !validStats.includes(name))

    if (invalidStats.length > 0) {
      error = `Invalid stat names: ${invalidStats.join(', ')}. Valid stats for ${parsedData.piece} > ${parsedData.type} are: ${validStats.join(', ')}`
      return
    }

    dispatch('submit', parsedData)
    jsonInput = '' // Clear after successful submit
  } catch (e) {
    error = `Invalid JSON: ${e.message}`
  }
}

function copyPrompt() {
  navigator.clipboard.writeText(PROMPT_TEMPLATE)
  // Could add a visual confirmation here
}

function copyUrlPrompt() {
  navigator.clipboard.writeText(PROMPT_WITH_URL)
  // Could add a visual confirmation here
}
</script>

<div class="gear-data-input">
  <div class="instructions">
    <h3>How to use:</h3>
    <ol>
      <li>
        <button type="button" class="link-button" on:click={() => (showPrompt = !showPrompt)}>
          {showPrompt ? 'Hide' : 'Show'} AI Prompt (JSON Only)
        </button>
        {#if showPrompt}
          <div class="prompt-container">
            <button type="button" class="copy-button" on:click={copyPrompt}>📋 Copy Prompt</button>
            <pre class="prompt-text">{PROMPT_TEMPLATE}</pre>
          </div>
        {/if}
      </li>
      <li>
        <button type="button" class="link-button" on:click={() => (showUrlPrompt = !showUrlPrompt)}>
          {showUrlPrompt ? 'Hide' : 'Show'} AI Prompt (with URL Generation)
        </button>
        {#if showUrlPrompt}
          <div class="prompt-container">
            <button type="button" class="copy-button" on:click={copyUrlPrompt}>📋 Copy Prompt</button>
            <pre class="prompt-text">{PROMPT_WITH_URL}</pre>
            <p
              style="margin-top: 0.5rem; padding: 0.5rem; background-color: #e8f5e9; border-radius: 4px; font-size: 0.75rem;"
            >
              This prompt asks the AI to also generate a shareable URL with base64-encoded JSON
            </p>
          </div>
        {/if}
      </li>
      <li>Use ChatGPT, Claude, or any AI chat with vision capabilities</li>
      <li>Upload your equipment screenshot and paste one of the prompts above</li>
      <li>Either paste the JSON below OR click the generated URL (if you used the URL prompt)</li>
    </ol>
    <p
      style="margin-top: 1rem; padding: 0.75rem; background-color: #e3f2fd; border: 1px solid #2196f3; border-radius: 4px; font-size: 0.875rem;"
    >
      <strong>💡 Two options:</strong><br />
      <strong>Option 1 (Simple):</strong> Use "JSON Only" prompt → Paste JSON below → Get shareable URL<br />
      <strong>Option 2 (Advanced):</strong> Use "with URL Generation" prompt → Click the URL directly (no pasting needed)
    </p>
  </div>

  <div class="input-area">
    <label for="json-input">Paste JSON from AI:</label>
    <textarea
      id="json-input"
      bind:value={jsonInput}
      placeholder={`{
  "type": "Stone",
  "piece": "[8000] Weapons",
  "stats": [
    {"name": "Maximum Damage", "value": 121, "isPercentage": false},
    {"name": "Strength/Magic %", "value": 10, "isPercentage": true}
  ]
}`}
      rows="10"
    ></textarea>

    {#if error}
      <p class="error-message">{error}</p>
    {/if}

    <button type="button" class="submit-button" on:click={handleSubmit}> Apply to Calculator </button>
  </div>
</div>

<style>
.gear-data-input {
  background-color: #f9f9f9;
  border: 1px solid #ddd;
  border-radius: 8px;
  padding: 1.5rem;
  margin-bottom: 2rem;
}

.instructions {
  margin-bottom: 1.5rem;
}

.instructions h3 {
  margin-top: 0;
  color: #333;
}

.instructions ol {
  margin: 0.5rem 0;
  padding-left: 1.5rem;
}

.instructions li {
  margin-bottom: 0.5rem;
}

.link-button {
  background: none;
  border: none;
  color: #2196f3;
  text-decoration: underline;
  cursor: pointer;
  padding: 0;
  font-size: 1rem;
}

.link-button:hover {
  color: #1976d2;
}

.prompt-container {
  margin-top: 0.5rem;
  position: relative;
}

.copy-button {
  position: absolute;
  top: 0.5rem;
  right: 0.5rem;
  background-color: #fff;
  border: 1px solid #ccc;
  border-radius: 4px;
  padding: 0.25rem 0.5rem;
  cursor: pointer;
  font-size: 0.875rem;
}

.copy-button:hover {
  background-color: #f0f0f0;
}

.prompt-text {
  background-color: #fff;
  border: 1px solid #ccc;
  border-radius: 4px;
  padding: 1rem;
  font-size: 0.875rem;
  overflow-x: auto;
  white-space: pre-wrap;
  word-wrap: break-word;
}

.input-area {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

label {
  font-weight: 500;
  color: #333;
}

textarea {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid #ccc;
  border-radius: 4px;
  font-family: 'Courier New', monospace;
  font-size: 0.875rem;
  resize: vertical;
}

textarea:focus {
  outline: none;
  border-color: #2196f3;
}

.error-message {
  color: #d32f2f;
  margin: 0;
  font-size: 0.875rem;
}

.submit-button {
  background-color: #2196f3;
  color: white;
  border: none;
  border-radius: 4px;
  padding: 0.75rem 1.5rem;
  font-size: 1rem;
  cursor: pointer;
  transition: background-color 0.2s;
}

.submit-button:hover {
  background-color: #1976d2;
}

.submit-button:active {
  background-color: #1565c0;
}
</style>
