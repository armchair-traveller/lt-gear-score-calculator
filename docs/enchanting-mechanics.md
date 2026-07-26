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
- One copy means another piece with the same entered lines before the remaining
  blank lines are attempted. It is not necessarily untouched.
- The odds plan stops attempting lines once the target is reached or the
  maximum remaining rolls can no longer reach it.
- A full completion budget must include acquiring replacement items and
  recreating their entered lines. The panel reports those copy counts
  separately and labels only the calculated attempt costs as the enchanting
  budget.

## Planner target guidance

- SSS remains the default benchmark. It is a difficult but reasonable target
  for a player willing to settle for a decent piece rather than an exceptional
  one.
- For `[sLv5] Accessories`, the practical quick targets are 75%, 80%, and
  85%. Reaching 90% is exceptional and generally not pursued with
  conventional methods; 100% is not a practical target.
- For `[9999] Armor`, 75% is a finished/endgame target and 77.5% is an
  exceptional upper quick target.
- Quick targets are recommendations only. The exact target input remains
  available for unusual plans. Gear families without documented practical
  targets do not show speculative quick-target percentages.

## Sources

Maintainer rules above take precedence across regional differences. Korean
cross-checks: [equipment guide](https://www.latale.com/Guide/System/19),
[50%/60%](https://www.latale.com/news/notice/view/3013),
[Rikimo](https://www.latale.com/news/notice/view/3600), and
[Badge 6](https://www.latale.com/news/notice/view/2718).
