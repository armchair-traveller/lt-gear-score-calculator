# LaTale Enchant Calculator

## About

The LaTale Enchant Calculator is a simple tool to evaluate the enchanted stats of your main equipment and rank them based on the % of potential damage increase (DI) they have with their current enchants vs the maximum possible DI for that item piece. Items are evaluated on a percentage basis and then given a tier ranking from F to SSS.

## Usage

Select your desired type of equipment and respective armor piece, then the stats in your gear (when applicable if the type of equipment can have multiple different stats, otherwise it will default to the only existing stats) and insert your enchanted values on the input boxes besides the stats, or press the buttons below to quickly switch to preset configurations based on 90% score. To the right the calculator will display your item's DI, its percentage score and the respective tier. Detailed information on the quality of each enchant can be seen on the right while descriptors for each tier and stat enchanting priority will be displayed below.

## Discord sign-in

Optional Discord sign-in is backed by Better Auth and one Turso database. Signed-in users get one gear planner saved across devices, while every planner edit is still written to the current device first. The calculator, upgrade workbench, image importer, share links, and Discord command remain publicly usable; calculator inputs, quality targets, and recent upgrade items remain browser-local.

See [docs/discord-auth.md](docs/discord-auth.md) for Discord OAuth, planner save behavior, conflict handling, Turso, migrations, local setup, and Vercel deployment. Production must use the Nuxt server build (`npm run build`), not static generation (`npm run generate`).

## Discord companion

The same screenshot importer, scoring rules, and snapshot renderer are available through the user-installed `/gear-score` Discord command. See [docs/discord-bot.md](docs/discord-bot.md) for setup, deployment, and command registration.
