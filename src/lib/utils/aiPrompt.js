import { gearReference } from '$lib/data/gearReference.js'

export function generateAIPrompt(currentUrl) {
  return `Extract equipment data from the image(s) and return ONLY valid JSON with this structure:

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

Return each equipment's JSON in its own code block with json syntax highlighting, followed by the clickable URL(s).`
}
