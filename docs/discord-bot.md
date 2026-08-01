# Discord gear-score companion

The Discord companion exposes one global, user-installed `/gear-score` command. A user attaches a LaTale equipment screenshot, the existing image importer reads the enchant lines, the shared calculator evaluates them, and Discord receives the same snapshot design as the web app.

The integration is an outgoing Discord interaction webhook. It does not run a Gateway process, persistent worker, or queue. The webhook defers immediately, continues inside the Vercel request lifecycle, and edits that same Discord message when the snapshot is ready.

## Command

`/gear-score` has three options:

- `image` — required PNG, JPEG, or WebP attachment, up to 8 MB.
- `equipment` — optional hint for a cropped or unclear equipment identity.
- `private` — optional boolean; results are public by default and ephemeral when true.

The app is registered as a global user-install command in guild, app-DM, and private-channel contexts. A user who installs it can invoke it in supported Discord contexts without installing a guild bot.

If equipment identity or any active enchant line cannot be verified, the command gives retry guidance instead of returning a partial or guessed score.

## Discord application setup

1. Create an application in the [Discord Developer Portal](https://discord.com/developers/applications).
2. On **General Information**, copy the Application ID and Public Key.
3. On **Installation**, enable **User Install** with the `applications.commands` scope. Guild installation is not required for this companion.
4. Create or reset the bot token long enough to register the command. Treat it as a secret.
5. Configure the deployed environment variables below and deploy the Nuxt app.
6. On **General Information**, set the Interactions Endpoint URL to:

   ```text
   https://YOUR_DEPLOYMENT/api/discord/interactions
   ```

   Discord verifies this endpoint with a signed PING.

7. Register the global command from a trusted local shell:

   ```bash
   node --env-file=.env.local scripts/register-discord-command.mjs
   ```

   The script prints a user-install URL after registration. Share that URL only with beta testers. The app does not need to be listed publicly.

Discord's global command update can take time to propagate. Re-running the registration script updates the existing command with the same name.

## Environment variables

Deploy these values:

```dotenv
OPENAI_API_KEY=
DISCORD_APPLICATION_ID=
DISCORD_PUBLIC_KEY=
NUXT_PUBLIC_SITE_URL=https://latale.example
```

The existing optional image-model overrides continue to work:

```dotenv
OPENAI_IMAGE_IMPORT_MODEL=gpt-5.4-mini
OPENAI_IMAGE_IMPORT_VERIFICATION_MODEL=gpt-4.1-mini
```

Use `DISCORD_BOT_TOKEN` only while running the registration script. It is not used by the webhook and should not be stored in Vercel.

`NUXT_PUBLIC_SITE_URL` supplies the “Open in the calculator” link. On Vercel, the production project URL is used as a fallback.

## Runtime behavior

The endpoint:

1. Reads the untouched request body, verifies Discord's Ed25519 signature, and rejects stale timestamps.
2. Answers PINGs and validates `/gear-score` options.
3. Defers the interaction within Discord's three-second deadline.
4. Downloads only the signed attachment's HTTPS Discord CDN URL.
5. Reuses the screenshot importer, strict evaluation rules, and snapshot renderer.
6. Edits the original deferred response with a PNG and calculator link.

Processing has a 210-second internal deadline under the deployment's 240-second function duration. The interaction token remains valid long enough for that edit. There is no durable retry: if a deployment is interrupted while processing, the user should run the command again.

Warm instances apply best-effort limits of one active job per user, two concurrent imports, a 30-second per-user cooldown, and short-lived interaction-ID replay suppression. These are intentionally not a durable or cross-instance quota system; the controlled beta is the primary access boundary for this version.

Gear artwork and the Geist font weights used by the server renderer are bundled with the deployment. The decorative hero uses the same allowlisted official LaTale image as the web snapshot, is cached by warm instances, and falls back to the snapshot's built-in gradient when the remote image is unavailable.

## Security and privacy

- Never expose `OPENAI_API_KEY` or the bot token in client code. Keep Discord webhook configuration server-side.
- The bot token is registration-only. Rotate it immediately if it is exposed.
- Interaction requests are rejected before parsing unless their Discord signature is valid and recent. Warm instances also reject duplicate interaction IDs before starting image analysis.
- Attachment downloads allow only `cdn.discordapp.com` and `media.discordapp.net`, reject redirects, and enforce type, size, and dimension limits.
- Logs contain outcome codes and timings only. They do not include screenshots, interaction tokens, OCR text, or raw Discord user IDs.
- OpenAI image requests use the existing non-persistent importer behavior (`store: false`).
- Discord responses disable mentions so imported or generated text cannot ping users or roles.

## Smoke test

After registration has propagated:

1. Install the application with the printed user-install URL.
2. Run `/gear-score` in the app DM with a clear full-tooltip screenshot.
3. Confirm the deferred message is edited in place with one PNG, score, tier, and calculator link.
4. Repeat with `private: true` and confirm only the invoking user sees the response.
5. Try a screenshot with the title cropped, select `equipment`, and confirm the hint is used.
6. Try an ambiguous enchant row and confirm the command gives retry guidance instead of a score.
7. Verify the same user-installed command is available in a DM/GDM and a server channel where Discord permits user apps.

## Troubleshooting

- **Discord rejects the endpoint URL:** confirm `DISCORD_PUBLIC_KEY` belongs to the same application as `DISCORD_APPLICATION_ID`, and confirm the deployment accepts `POST /api/discord/interactions`.
- **Unknown command:** run the registration script again and allow time for the global command to propagate.
- **The response stays on “thinking”:** inspect function logs for an outcome code. An interrupted serverless invocation has no queue retry.
- **The image is rejected:** upload a non-animated PNG, JPEG, or WebP under 8 MB and no larger than 8192 pixels per side.
- **The app is missing in a context:** confirm User Install and all three command contexts are enabled, then reinstall the app.
