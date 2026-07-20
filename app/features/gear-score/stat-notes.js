export function assignTraitNotesToLines({
  traits = [],
  statTypes = [],
  lineIndexes = [],
} = {}) {
  const notesByLineIndex = new Map()

  for (const trait of traits) {
    const targetIndex = lineIndexes.find((index) =>
      trait.appliesTo?.includes(statTypes[index]),
    )

    if (targetIndex === undefined) {
      continue
    }

    const currentNotes = notesByLineIndex.get(targetIndex) ?? []
    notesByLineIndex.set(targetIndex, [...currentNotes, trait])
  }

  return notesByLineIndex
}
