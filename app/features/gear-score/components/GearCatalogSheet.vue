<script setup>
const {
  gearType,
  pieceType,
  highlightedPiece,
  gearSheetOpen,
  gearCategories,
  highlightedStats,
  highlightedItem,
  highlightedTierRows,
  highlightedTraitRows,
  getPieceNames,
  getItemImage,
  getAsset,
  setGear,
  getFinalUpgrade,
  getTierClass,
} = useGearScoreCalculatorContext()
</script>

<template>
  <Sheet v-model:open="gearSheetOpen">
    <SheetContent
      side="right"
      class="gap-0 p-0 data-[side=right]:!w-full sm:data-[side=right]:!max-w-none md:data-[side=right]:!w-[92vw] lg:data-[side=right]:!w-[86vw] xl:data-[side=right]:!w-[1120px]"
    >
      <SheetHeader class="px-5 py-4 pr-12">
        <SheetTitle>Select Gear</SheetTitle>
        <SheetDescription>{{ highlightedPiece[1] }} {{ highlightedPiece[0] }}</SheetDescription>
      </SheetHeader>

      <div class="min-h-0 min-w-0 flex-1 overflow-y-auto p-4">
        <div class="grid min-h-full min-w-0 gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
          <section class="min-h-0 min-w-0 rounded-lg border bg-surface-inset">
            <div class="px-3 py-2">
              <div class="text-sm font-medium">Gear catalog</div>
              <div class="text-xs text-muted-foreground">Focus or hover to inspect, activate to select</div>
            </div>
            <ScrollArea class="h-[42vh] p-3 xl:h-[calc(100vh-10rem)]">
              <div class="grid gap-4">
                <div v-for="category in gearCategories" :key="category" class="grid gap-2">
                  <div class="text-xs font-medium uppercase text-muted-foreground">{{ category }}</div>
                  <div class="grid grid-cols-4 gap-2 sm:grid-cols-5 xl:grid-cols-5">
                    <Button
                      v-for="piece in getPieceNames(category)"
                      :key="`${category}-${piece}`"
                      :variant="gearType === category && pieceType === piece ? 'default' : 'outline'"
                      class="h-14 w-full rounded-lg"
                      size="icon"
                      @click="setGear(category, piece)"
                      @focus="highlightedPiece = [category, piece]"
                      @mouseenter="highlightedPiece = [category, piece]"
                    >
                      <img class="size-8" :src="getItemImage(piece, category)" :alt="piece">
                    </Button>
                  </div>
                </div>
              </div>
            </ScrollArea>
          </section>

          <section class="grid min-h-0 min-w-0 content-start gap-4">
            <div class="flex items-center gap-3 rounded-lg border bg-surface-raised p-3">
              <span class="parade-item-well flex size-12 shrink-0 items-center justify-center rounded-lg">
                <img class="size-10" :src="getItemImage(highlightedPiece[1], highlightedPiece[0])" alt="">
              </span>
              <div class="min-w-0">
                <div class="truncate font-semibold">{{ highlightedPiece[1] }} {{ highlightedPiece[0] }}</div>
                <div class="truncate text-sm text-muted-foreground">
                  Max rating {{ highlightedItem?.DI.toFixed(2) }}% / {{ getFinalUpgrade(highlightedPiece[0]) || 'No final upgrade' }}
                </div>
              </div>
            </div>

            <Tabs default-value="enchants" class="grid min-h-0 min-w-0 gap-3">
              <TabsList class="w-full justify-start overflow-x-auto overflow-y-hidden sm:w-fit">
                <TabsTrigger value="enchants">Enchants</TabsTrigger>
                <TabsTrigger value="tiers">Tiers</TabsTrigger>
                <TabsTrigger value="traits">Traits</TabsTrigger>
              </TabsList>

              <TabsContent value="enchants" class="motion-tab-panel m-0 min-h-0 min-w-0">
                <Table
                  container-class="max-h-[52vh] min-w-0 rounded-lg border bg-surface-raised xl:max-h-[calc(100vh-16rem)]"
                  class="min-w-[560px]"
                >
                  <TableHeader>
                    <TableRow>
                      <TableHead>Stat</TableHead>
                      <TableHead>Max value</TableHead>
                      <TableHead>Rating</TableHead>
                      <TableHead v-if="getFinalUpgrade(highlightedPiece[0]) !== ''">Potential</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow v-for="stat in highlightedStats" :key="stat">
                      <TableCell class="font-medium">{{ stat }}</TableCell>
                      <TableCell>{{ highlightedItem.Stats[stat].Value }}</TableCell>
                      <TableCell>{{ highlightedItem.Stats[stat].DI }}%</TableCell>
                      <TableCell v-if="getFinalUpgrade(highlightedPiece[0]) !== ''">
                        {{ highlightedItem.Stats[stat].Potential[0] }}
                        <span v-if="highlightedItem.Stats[stat].Potential[0] !== highlightedItem.Stats[stat].Potential[1]">
                          ~ {{ highlightedItem.Stats[stat].Potential[1] }}
                        </span>
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </TabsContent>

              <TabsContent value="tiers" class="motion-tab-panel m-0 min-h-0 min-w-0">
                <Table
                  container-class="max-h-[52vh] min-w-0 rounded-lg border bg-surface-raised xl:max-h-[calc(100vh-16rem)]"
                  class="min-w-[720px]"
                >
                  <TableHeader>
                    <TableRow>
                      <TableHead>Score</TableHead>
                      <TableHead>Tier</TableHead>
                      <TableHead>Single</TableHead>
                      <TableHead>Duo</TableHead>
                      <TableHead>Trio</TableHead>
                      <TableHead>Quad</TableHead>
                      <TableHead>Penta</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow v-for="row in highlightedTierRows" :key="row.tier">
                      <TableCell>{{ row.Score }}</TableCell>
                      <TableCell>
                        <Badge variant="outline" :class="getTierClass(row.tier)">{{ row.tier }}</Badge>
                      </TableCell>
                      <TableCell>{{ row.Single }}</TableCell>
                      <TableCell>{{ row.Duo }}</TableCell>
                      <TableCell>{{ row.Trio }}</TableCell>
                      <TableCell>{{ row.Quad }}</TableCell>
                      <TableCell>{{ row.Penta }}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </TabsContent>

              <TabsContent value="traits" class="motion-tab-panel m-0">
                <div v-if="highlightedTraitRows.length" class="grid gap-2">
                  <div
                    v-for="trait in highlightedTraitRows"
                    :key="trait.id"
                    class="flex gap-3 rounded-lg border bg-surface-inset p-3"
                  >
                    <img class="size-8 shrink-0" :src="getAsset(trait.image)" alt="">
                    <div>
                      <div class="text-sm font-medium">{{ trait.label }}</div>
                      <div class="text-sm text-muted-foreground">{{ trait.text }}</div>
                    </div>
                  </div>
                </div>
                <div v-else class="rounded-lg border border-dashed bg-surface-inset p-4 text-sm text-muted-foreground">
                  No special traits listed for this piece.
                </div>
              </TabsContent>
            </Tabs>
          </section>
        </div>
      </div>
    </SheetContent>
  </Sheet>
</template>
