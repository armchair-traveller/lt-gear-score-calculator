# AI-Assisted Gear Data Entry

This calculator now uses a cost-effective approach where users extract gear data using their own AI chat service (ChatGPT, Claude, etc.) and paste the JSON into the calculator.

## How It Works

1. **Get the Prompt**: Click "Show AI Prompt" in the calculator to view the extraction prompt
2. **Use Your AI**: Copy the prompt and paste it into ChatGPT, Claude, or any AI with vision capabilities
3. **Upload Your Screenshot**: Provide your equipment screenshot to the AI along with the prompt
4. **Get JSON**: The AI will return structured JSON data
5. **Paste & Apply**: Copy the JSON and paste it into the calculator's text area, then click "Apply to Calculator"
6. **Share (Optional)**: After applying, you'll get a shareable URL to save or share your gear configuration

## Benefits

- **No API costs**: Users provide their own AI service
- **Privacy**: No image upload to our servers
- **Flexibility**: Works with any AI chat service (ChatGPT, Claude, Gemini, etc.)
- **Accuracy**: Users can verify and edit the JSON before applying
- **Shareable**: Generate URLs to save and share gear configurations

## Shareable URLs

After applying gear data, the calculator generates a shareable URL with the gear configuration encoded in base64:

```
http://localhost:5173/?data=BASE64_ENCODED_JSON
```

### Creating Manual URLs

You can also ask your AI to generate the URL directly by:

1. Getting the JSON from the AI
2. Encoding it to base64
3. Appending as a URL parameter: `?data=ENCODED_JSON`

### Benefits of URLs

- **No copy/paste needed**: Just share the link
- **Persistent**: Bookmark to save gear configurations
- **Shareable**: Send to friends or team members
- **Quick loading**: Automatically populates the calculator

## JSON Format

The AI will return data in this format:

```json
{
  "type": "Stone",
  "piece": "[8000] Weapons",
  "stats": [
    { "name": "Maximum Damage", "value": 121, "isPercentage": false },
    { "name": "Strength/Magic %", "value": 10, "isPercentage": true },
    { "name": "Attack/Intensity", "value": 185, "isPercentage": false }
  ]
}
```

### Important Notes

- **Percentage stats**: Must have `" %"` at the end of the name (e.g., `"Attack/Intensity %"`)
- **Fixed stats**: Should NOT have `" %"` (e.g., `"Attack/Intensity"`)
- **Equipment piece**: Use the category like `"[8000] Weapons"`, NOT the item name like "Dark Elf Crystal"
- **Equipment type**: For weapons, use "Stone" for Elemental Stones, "Main" for actual weapons (Sword, Spear, etc.)
- **Only enchants**: Only include stats with "Lv. #" prefix, ignore base item stats

## Gear Reference

The prompt includes a complete reference of all available equipment pieces, types, and stat names to help the AI match correctly.
