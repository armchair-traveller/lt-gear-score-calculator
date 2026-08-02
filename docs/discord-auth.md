# Discord authentication and planner saves

Discord sign-in uses Better Auth with Discord as the only identity provider and a single Turso database named `ltgear-auth`. The same database stores one canonical gear planner for each Better Auth user. Authentication reuses the Discord application that owns the `/gear-score` command, but OAuth sign-in and command installation remain separate flows.

## Current scope

This rollout provides:

- Sign in with Discord.
- A server-managed session.
- Display of the signed-in Discord identity.
- Sign out.
- One gear planner saved across signed-in devices.
- Local-first planner edits with automatic background saves.
- Explicit conflict resolution when device and cloud copies differ.

It does **not** save calculator inputs, quality targets, recent upgrade items, calculator history, or image-import history; connect command results to an account; create multiple named planners; or provide self-service account deletion. The calculator, upgrade workbench, planner, image importer, share links, and Discord command remain usable without signing in.

## Planner save behavior

Planner persistence is local-first:

- Signed-out changes are saved only on the current device.
- Signed-in changes are written to the current device immediately and then saved to Turso in the background.
- The editor never waits on the network before closing.
- A failed cloud request reports **Save paused** and offers a retry. The local planner remains usable and no local edit is discarded.
- If browser storage is blocked or full, the mutation is not reported as saved and no cloud write is attempted. **Save paused** explains the device failure and retries the retained in-memory mutation after storage becomes available.
- Signing out retains the device copy. It does not clear or silently replace planner data.

On the first signed-in reconciliation:

- Matching copies need no action.
- A populated device copy is uploaded when the account has no planner.
- A populated account copy is loaded when the device planner is empty.
- A populated device copy never silently repopulates an intentionally emptied cloud planner; that case requires a choice.
- If both copies contain different data, the user chooses **Replace cloud with this device** or **Use cloud plan** before either copy is overwritten.

A small device-only metadata record tracks the last modification time and the opaque Better Auth user ID associated with the retained copy. It never contains a Discord ID, email address, or plan contents, and exists only to prevent one account's retained planner from being uploaded to another account after a reload.

Later writes use the stored revision to detect stale updates. A revision conflict returns to the same explicit chooser. Shared planner links remain read-only previews; adopting a shared plan requires confirmation when the current planner is non-empty and then follows the same local-first save path.

Application ownership always uses Better Auth's internal user ID. The Discord snowflake remains provider-account data and is not used as the `gear_plan` owner key.

## Supported environments

Only local development and the canonical production deployment are supported for OAuth:

| Environment | Base URL | Discord redirect URI |
| --- | --- | --- |
| Local | `http://localhost:3000` | `http://localhost:3000/api/auth/callback/discord` |
| Production | `https://ltgear.vercel.app` | `https://ltgear.vercel.app/api/auth/callback/discord` |

Register those two redirect URIs exactly in the Discord Developer Portal. Do not register arbitrary Vercel preview URLs, wildcard callbacks, `127.0.0.1`, or alternate ports unless the supported environment policy is deliberately changed. Preview deployments are not an OAuth test environment.

## Environment variables

Copy `.env.example` to `.env.local` for local development. The repository ignores `*.local` files.

| Name | Purpose |
| --- | --- |
| `DISCORD_APPLICATION_ID` | Existing Discord Application ID. Better Auth uses this value as the OAuth client ID; do not create `DISCORD_CLIENT_ID`. |
| `DISCORD_CLIENT_SECRET` | Discord OAuth client secret. Server-only. |
| `DISCORD_PUBLIC_KEY` | Existing interaction-signature public key used by the `/gear-score` webhook. |
| `BETTER_AUTH_SECRET` | High-entropy secret used to sign and encrypt Better Auth state and sessions. Server-only. |
| `BETTER_AUTH_URL` | Exact origin of the current environment, without a trailing slash. |
| `TURSO_DATABASE_URL` | libSQL URL for the `ltgear-auth` database. Server-only configuration. |
| `TURSO_AUTH_TOKEN` | Database-scoped read/write token for `ltgear-auth`. Server-only secret. |
| `NUXT_PUBLIC_SITE_URL` | Canonical public site URL used by generated calculator links. This is intentionally public. |

The image importer and Discord interaction webhook retain their existing variables from `.env.example`. `DISCORD_BOT_TOKEN` is registration-only and must not be added to Vercel.

Generate `BETTER_AUTH_SECRET` locally with a cryptographically secure generator, for example:

```bash
openssl rand -base64 32
```

Put the result directly in `.env.local` or the Vercel encrypted environment-variable UI. Never paste secrets or database tokens into source files, commits, terminal transcripts intended for sharing, logs, issues, screenshots, or chat.

## Discord application setup

1. Open the existing application in the [Discord Developer Portal](https://discord.com/developers/applications).
2. Copy its **Application ID** into `DISCORD_APPLICATION_ID`. The same value continues to identify the interaction webhook and now serves as Better Auth's OAuth client ID.
3. On **OAuth2**, create or reset the client secret and store it as `DISCORD_CLIENT_SECRET`.
4. Add the two exact redirect URIs from the supported-environments table.
5. Request only the basic `identify` and `email` scopes.

Do not add `bot`, `guilds`, `guilds.join`, `connections`, `webhook.incoming`, or `applications.commands` to the sign-in flow. Better Auth login must not install the command, add a bot to a server, inspect guild membership, or request messaging access. The existing user-install command remains documented separately in [discord-bot.md](discord-bot.md).

### Discord accounts without email

Discord can return no email for phone-only accounts even when the `email` scope is requested. The auth profile mapper uses the stable Discord user ID to create an internal placeholder in the reserved `.invalid` domain, such as:

```text
123456789012345678@discord.invalid
```

That placeholder exists only because Better Auth requires an email-shaped user field. It is non-deliverable, must never be shown as the user's email, and must never be used for verification, notifications, password recovery, or account-deletion mail.

## Turso setup

Use one remote database named `ltgear-auth` for this rollout:

```bash
turso db create ltgear-auth
turso db show ltgear-auth --url
turso db tokens create ltgear-auth
```

Set the returned URL as `TURSO_DATABASE_URL` and the database token as `TURSO_AUTH_TOKEN`. The token command prints a secret: capture it directly into the local or deployment secret store and do not paste it into documentation or logs. Confirm the URL names `ltgear-auth` before applying any migration.

The application runtime needs data read/write access but should not receive a Turso Platform API token. Keep any schema-capable migration credential separate from the runtime credential when operational tooling allows it.

Foreign-key enforcement is connection and platform dependent, so verify it through the same `@libsql/client` path the application uses. During this rollout, `PRAGMA foreign_keys;` returned `1` for `ltgear-auth`. The checked-in schema also declares and locally tests the auth relationships, and Better Auth explicitly deletes its dependent account and session rows. Future product tables must still have explicit cleanup tests instead of assuming a platform default will remain unchanged.

## Schema and migrations

The intended package-script contract for the auth schema is:

| Script | Responsibility |
| --- | --- |
| `npm run auth:schema` | Regenerate the Better Auth Drizzle schema from the auth configuration. |
| `npm run db:generate` | Generate a reviewed SQL migration from the checked-in Drizzle schema. |
| `npm run db:migrate` | Apply checked-in migrations to the database selected by `TURSO_DATABASE_URL`. |
| `npm run db:studio` | Open Drizzle Studio for deliberate local inspection. |

When changing the auth model, the normal development order is:

```bash
npm run auth:schema
npm run db:generate
npm run db:migrate
```

Review and commit generated schema and migration files. Deployment should apply already-reviewed migrations with `npm run db:migrate`; it must not generate a new migration from live production state.

Better Auth generation owns `server/db/auth-schema.js`. The application-owned `gear_plan` table is defined separately and aggregated through `server/db/schema.js`, so running `npm run auth:schema` cannot erase product tables. The `gear_plan` row uses the Better Auth user ID as its primary key, stores sanitized versioned slots, and tracks a revision for conditional writes.

The additive planner migration also creates the migration-owned unique index on `account(provider_id, account_id)` that Better Auth 1.6.25 cannot generate. Before applying that migration to an existing database, run this count-only duplicate preflight and stop if the result is not zero:

```sql
SELECT COUNT(*) AS duplicate_pair_count
FROM (
  SELECT provider_id, account_id
  FROM account
  GROUP BY provider_id, account_id
  HAVING COUNT(*) > 1
);
```

The production order is: verify the database target, run the duplicate preflight, apply the committed migration, run the test/build checks, then push the reviewed commit to `main`. Never try to repair duplicate account rows automatically during deployment.

## Continuous integration

The GitHub Actions workflow uses Node.js 24 and runs `npm ci`, credential-free Better Auth schema generation with a checked-in drift check, the complete test suite, and the Nuxt server build. CI does not connect to Turso, apply migrations, use Discord credentials, or require repository secrets.

## Local verification

1. Copy `.env.example` to `.env.local` and fill the server-only values without sharing them. Use a local-only Better Auth secret and a newly scoped `ltgear-auth` token; keep the registration-only `DISCORD_BOT_TOKEN` local.
2. Set both `BETTER_AUTH_URL` and `NUXT_PUBLIC_SITE_URL` to `http://localhost:3000`.
3. Confirm the Discord application contains the exact localhost callback.
4. Apply the checked-in migrations with `npm run db:migrate`.
5. Start the server:

   ```bash
   npm run dev
   ```

6. While signed out, edit the planner and confirm the control says **Save across devices** while the entry survives a refresh on that device.
7. Sign in from the planner and confirm the OAuth return preserves the current path and query. Reconcile device/cloud copies if prompted, then verify the control reaches **Saved across devices**.
8. Change a planner entry, refresh, and open the same account in a second browser profile to confirm the canonical planner loads. Create a stale update deliberately and verify the conflict chooser preserves both summaries until a choice is made.
9. Sign out and confirm the device copy remains available and every anonymous tool continues to work.
10. Cancel the Discord consent screen once and confirm the app reports cancellation without altering local data.
11. Test a Discord account without an email if one is available, and confirm the `.invalid` placeholder is never rendered.

Do not test OAuth by pasting Discord tokens into requests or by automating a personal Discord account.

## Vercel production

Configure these Production environment overrides:

```dotenv
BETTER_AUTH_URL=https://ltgear.vercel.app
NUXT_PUBLIC_SITE_URL=https://ltgear.vercel.app
```

Add `BETTER_AUTH_SECRET`, `DISCORD_APPLICATION_ID`, `DISCORD_CLIENT_SECRET`, `DISCORD_PUBLIC_KEY`, `TURSO_DATABASE_URL`, and `TURSO_AUTH_TOKEN` through Vercel's encrypted environment-variable UI. Keep production auth credentials out of the Preview environment.

`DISCORD_BOT_TOKEN` must be absent from both Vercel Preview and Production. Command registration runs deliberately from a trusted local environment; the deployed webhook does not need the bot token.

Use the Nuxt server build:

```text
Build Command: npm run build
```

Do **not** use `npm run generate`. Better Auth requires the Nitro `/api/auth/**` server routes, and the repository already requires server routes for screenshot import and Discord interactions.

Before directing traffic to a build:

1. Run the count-only duplicate preflight, stop on a nonzero result, and then apply reviewed migrations to `ltgear-auth`.
2. Query `PRAGMA foreign_keys;` through the remote runtime client and record the result. The initial `ltgear-auth` rollout returned `1`; investigate before deployment if a later check differs.
3. Confirm the production callback is registered exactly.
4. Confirm the build sees the Production environment values.
5. Smoke-test anonymous calculation and local planner saves first, then sign-in, planner reconciliation, a cloud save, refresh, a second-browser load, sign-out, and the existing `/gear-score` interaction.
6. Inspect logs only for redacted outcome codes. Raw secrets, OAuth codes, cookies, emails, Turso tokens, and Discord user IDs must not be logged.

## Additive rollback

Authentication and the canonical planner row are additive to the anonymous application. A safe rollback restores the prior server deployment while leaving the calculator, local planner, upgrade workbench, share links, screenshot importer, and Discord command available.

Do not drop Turso tables, reverse migrations, rotate secrets, or delete user rows as the first rollback step. Keep the `ltgear-auth` database intact while the prior server build is restored and the incident is understood. Schema or data cleanup is a separate, reviewed destructive operation.

The `gear_plan` table can remain unused during a rollback. Because every edit is written to the browser first, rollback does not require an emergency planner-data export or a destructive database migration. Reconciliation after redeployment should still be tested before traffic is restored.
