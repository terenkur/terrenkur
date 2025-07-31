const readline = require('node:readline');
require('dotenv').config();

const { TWITCH_CLIENT_ID, TWITCH_SECRET, OAUTH_CALLBACK_URL } = process.env;

if (!TWITCH_CLIENT_ID || !TWITCH_SECRET || !OAUTH_CALLBACK_URL) {
  console.error('TWITCH_CLIENT_ID, TWITCH_SECRET and OAUTH_CALLBACK_URL must be set');
  process.exit(1);
}

const scopes = [
  'moderation:read',
  'channel:read:vips',
  'channel:read:subscriptions',
  'channel:read:redemptions',
];

const authUrl = `https://id.twitch.tv/oauth2/authorize?response_type=code&client_id=${TWITCH_CLIENT_ID}&redirect_uri=${encodeURIComponent(OAUTH_CALLBACK_URL)}&scope=${encodeURIComponent(scopes.join(' '))}`;

console.log('Open the following URL in your browser and authorize access:');
console.log(authUrl);
console.log('\nAfter approving, you will be redirected to your callback URL.');
console.log('Copy the value of the "code" parameter from the URL and paste it below.\n');

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
rl.question('Authorization code: ', async (code) => {
  rl.close();
  try {
    const params = new URLSearchParams({
      client_id: TWITCH_CLIENT_ID,
      client_secret: TWITCH_SECRET,
      code: code.trim(),
      grant_type: 'authorization_code',
      redirect_uri: OAUTH_CALLBACK_URL,
    });

    const resp = await fetch('https://id.twitch.tv/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });

    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`Request failed with ${resp.status}: ${text}`);
    }
    const data = await resp.json();
    console.log('\nYour TWITCH_BROADCASTER_TOKEN is:\n');
    console.log(data.access_token);
    console.log('\nSave this value as TWITCH_BROADCASTER_TOKEN in backend/.env');
  } catch (err) {
    console.error('Failed to retrieve token:', err.message);
    process.exit(1);
  }
});
