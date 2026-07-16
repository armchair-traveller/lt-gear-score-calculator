# Enchanting mechanics

The calculator scores enchanted stat lines, not total item or character power.
Enchant success rates and costs affect probability and planning features, not
the score of a completed item.

## Enchant flow

- All supported gear uses Platinum Hammers for enchanting.
  - Worth 150 million Ely.
- Every enchant attempt targets one stat line; lines are never enchanted in a
  batch.
- A failed enchant destroys the item.
- Most non-Badge gear starts with four preallocated stat lines. Only gear level
  7000 or lower may start with three; newer gear starts with four.
- Preallocated lines are Lv.1 with a value of 1.
- Most gear allows one additional player-selected stat line. Adding it is one
  enchant attempt, and a successful first enchant creates the line at Lv.2.
- Badge 6 starts with no preallocated lines. The player selects and enchants
  every line individually.

Adding a line, raising an existing line's enchant level, and item
enhancement/strengthening are separate mechanics. The rules below cover adding
lines only.

## Main gear rates and costs

Costs are per attempted line.

| Method | Success rate |         Ely | Platinum Hammers |
| ------ | -----------: | ----------: | ---------------: |
| Normal |          50% |  50,000,000 |                1 |
| Super  |          60% | 100,000,000 |                2 |

Super doubles both costs of Normal.

## sLv Special enchant

Special enchant has 100% success and is available only on eligible sLv gear.
The only eligible family currently represented is Rikimo gear,
`[sLv5] Accessories`.

| Variant     | Success rate | Ely | Platinum Hammers |
| ----------- | -----------: | --: | ---------------: |
| Untradeable |         100% |   0 |               10 |
| Tradable    |         100% |   0 |               30 |

## Badge 6 rates and costs

Badge 6 uses its own profile instead of the main-gear profile.

| Method     | Success rate |         Ely | Platinum Hammers |
| ---------- | -----------: | ----------: | ---------------: |
| 40% option |          40% |  50,000,000 |                1 |
| 50% option |          50% | 100,000,000 |                2 |

The 50% option doubles both costs of the 40% option.

## Planning implications

- For multiple new lines on one item, attempts are sequential. The chance that
  the item survives all of them is the product of their success rates.
- A completion-budget feature must include the cost of replacing destroyed
  items; the per-attempt costs above are not a complete expected budget.

## Sources

Maintainer rules above take precedence across regional differences. Korean
cross-checks: [equipment guide](https://www.latale.com/Guide/System/19),
[50%/60%](https://www.latale.com/news/notice/view/3013),
[Rikimo](https://www.latale.com/news/notice/view/3600), and
[Badge 6](https://www.latale.com/news/notice/view/2718).
