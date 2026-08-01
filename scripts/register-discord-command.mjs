import { getGearScoreCommandDefinition } from '../server/utils/discord-command.js'

const applicationId = process.env.DISCORD_APPLICATION_ID
const botToken = process.env.DISCORD_BOT_TOKEN

if (!applicationId || !botToken) {
  console.error(
    'Set DISCORD_APPLICATION_ID and DISCORD_BOT_TOKEN before registering the command.',
  )
  process.exitCode = 1
}
else {
  const command = getGearScoreCommandDefinition()
  const response = await fetch(
    `https://discord.com/api/v10/applications/${encodeURIComponent(applicationId)}/commands`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bot ${botToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(command),
    },
  )
  const result = await response.json().catch(() => null)

  if (!response.ok) {
    console.error(
      `Discord command registration failed with HTTP ${response.status}:`,
      result?.message || 'Unknown Discord API error.',
    )
    process.exitCode = 1
  }
  else {
    const installUrl = new URL('https://discord.com/oauth2/authorize')
    installUrl.search = new URLSearchParams({
      client_id: applicationId,
      integration_type: '1',
      scope: 'applications.commands',
    }).toString()

    console.log(`Registered /${result.name} (${result.id}).`)
    console.log(`Controlled-beta user install link: ${installUrl}`)
  }
}
