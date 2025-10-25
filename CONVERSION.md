# LaTale Gear Score Calculator - Svelte 5 Conversion

This project has been converted from vanilla JavaScript to a modern Svelte 5 application using reactive programming patterns.

## Project Structure

```
src/
├── lib/
│   ├── components/         # Modular Svelte components
│   │   ├── GearCalculator.svelte       # Main calculator component
│   │   ├── CalculatorResults.svelte    # Results display
│   │   ├── StatInput.svelte            # Individual stat input
│   │   ├── StatValuesTable.svelte      # Table showing stat values
│   │   ├── TierTables.svelte           # Tier evaluation tables
│   │   └── PriorityTables.svelte       # Enchant priority tables
│   ├── data/               # Data modules
│   │   ├── gear.js         # Gear data (ES module export)
│   │   └── tiers.js        # Tier data (ES module export)
│   ├── utils/              # Utility functions
│   │   └── calculator.js   # Pure calculation functions
│   └── index.js            # Library exports
└── routes/
    └── +page.svelte        # Main page

reference/                  # Original vanilla JS files
```

## Key Improvements

### 1. **Modular Architecture**
- Split monolithic code into focused, reusable components
- Separated data, logic, and presentation layers
- Each component has a single responsibility

### 2. **Reactive Programming (Svelte 5 Runes)**
- **`$state`**: Reactive state management for user inputs
  ```javascript
  let selectedType = $state(Object.keys(gearNormal)[0]);
  let statValues = $state(Array(5).fill(''));
  ```

- **`$derived`**: Auto-computed values that update when dependencies change
  ```javascript
  let totalDI = $derived.by(() => {
    // Automatically recalculates when statValues change
  });
  ```

- **`$effect`**: Side effects that run when dependencies change
  ```javascript
  $effect(() => {
    // Reset piece when type changes
    if (availablePieces.length > 0) {
      selectedPiece = availablePieces[0];
    }
  });
  ```

- **`$bindable`**: Two-way binding for component props
  ```javascript
  let { value = $bindable() } = $props();
  ```

### 3. **Pure Functions**
All calculation logic extracted into pure functions in `calculator.js`:
- `calculateStatDI()` - Calculate damage index for a stat
- `calculateScore()` - Calculate percentage score
- `determineTier()` - Determine tier from score
- `calculatePotentialGain()` - Calculate lucent potential
- And more...

### 4. **Type Safety & Clarity**
- Explicit prop declarations using `$props()`
- Clear function signatures with JSDoc comments
- Predictable data flow

### 5. **Performance**
- Automatic dependency tracking (no manual DOM manipulation)
- Only re-renders components when their data changes
- Efficient updates through Svelte's compiler

## Migration from Reference Files

### Before (Vanilla JS)
```javascript
// Imperative DOM manipulation
function refreshScore() {
  let totalDI = 0;
  for (let i = 1; i < 6; i++) {
    let statValue = document.getElementById('calculator-stat-' + i + '-input').value;
    // ... calculations
  }
  document.getElementById('calculator-percent').innerHTML = 'Score: ' + itemDI + '%';
}
```

### After (Svelte 5)
```javascript
// Reactive declarations
let totalDI = $derived.by(() => {
  let total = 0;
  for (let i = 0; i < 5; i++) {
    const statValue = parseFloat(statValues[i]);
    total += calculateStatDI(statValue, statData.Value, statData.DI);
  }
  return total;
});

// Automatic UI updates via binding
<div class="result-item">{totalDI.toFixed(2)}%</div>
```

## Development

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## Features Preserved

All original functionality has been preserved:
- ✅ Gear type and piece selection
- ✅ 5 stat inputs with dynamic stat options
- ✅ Quick presets (Duo, Trio, Quad, Penta)
- ✅ DI calculations and score percentages
- ✅ Tier determination
- ✅ Potential lucent gain calculations
- ✅ Tier evaluation tables
- ✅ Equivalence tables
- ✅ Enchant priority display
- ✅ Recommended enchants per piece
- ✅ Special notes for earrings

## Benefits of Svelte 5

1. **No More Manual DOM Updates**: Svelte's reactivity handles all UI updates
2. **Better Code Organization**: Components and utilities are cleanly separated
3. **Easier Testing**: Pure functions can be tested independently
4. **Better Performance**: Svelte compiles to optimized vanilla JS
5. **Type-Safe Props**: Clear component interfaces
6. **Simpler State Management**: No need for external state libraries
7. **Automatic Cleanup**: Effects are automatically cleaned up when components unmount

## Notes

- The original reference files are preserved in the `reference/` directory
- All styling has been converted to scoped component styles
- The calculator maintains the same UX as the original
- Data files (`gear.js`, `tiers.js`) were converted to ES modules with minimal changes
