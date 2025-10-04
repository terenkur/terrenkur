const obsModule = require('obs-websocket-js');
const OBSWebSocket = obsModule.OBSWebSocket || obsModule.default || obsModule;

const {
  OBS_WS_HOST = '127.0.0.1',
  OBS_WS_PORT = '4455',
  OBS_WS_PASSWORD,
  OBS_IMAGE_SOURCE_NAME,
  OBS_AUDIO_SOURCE_NAME,
} = process.env;

const obs = new OBSWebSocket();
let connected = false;
let connectingPromise = null;
let reconnectTimeout = null;
let retryAttempts = 0;

const MAX_RETRY_DELAY = 30000;
const BASE_RETRY_DELAY = 2000;

function getWebSocketUrl() {
  const port = Number.parseInt(OBS_WS_PORT, 10) || 4455;
  const host = OBS_WS_HOST || '127.0.0.1';
  return `ws://${host}:${port}`;
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function establishConnection() {
  if (connected) return obs;
  if (connectingPromise) return connectingPromise;

  connectingPromise = (async () => {
    const url = getWebSocketUrl();
    while (true) {
      try {
        if (OBS_WS_PASSWORD) {
          await obs.connect(url, OBS_WS_PASSWORD);
        } else {
          await obs.connect(url);
        }
        connected = true;
        retryAttempts = 0;
        return obs;
      } catch (err) {
        connected = false;
        retryAttempts += 1;
        const delayMs = Math.min(
          MAX_RETRY_DELAY,
          BASE_RETRY_DELAY * 2 ** Math.min(retryAttempts, 5)
        );
        console.error(
          `OBS connection failed (${err?.message || err}). Retrying in ${delayMs}ms.`
        );
        await delay(delayMs);
      }
    }
  })()
    .finally(() => {
      connectingPromise = null;
    });

  return connectingPromise;
}

function scheduleReconnect() {
  if (reconnectTimeout) return;
  const delayMs = Math.min(
    MAX_RETRY_DELAY,
    BASE_RETRY_DELAY * 2 ** Math.min(retryAttempts, 5)
  );
  reconnectTimeout = setTimeout(() => {
    reconnectTimeout = null;
    establishConnection().catch((err) => {
      console.error('OBS reconnection attempt failed', err);
    });
  }, delayMs);
}

obs.on('ConnectionClosed', () => {
  connected = false;
  retryAttempts += 1;
  scheduleReconnect();
});

obs.on('ConnectionError', (err) => {
  connected = false;
  retryAttempts += 1;
  console.error('OBS connection error', err);
  scheduleReconnect();
});

async function ensureConnection() {
  return establishConnection();
}

async function setInputSettingsSafe(inputName, inputSettings) {
  if (!inputName || !inputSettings) return;
  const client = await ensureConnection();
  await client.call('SetInputSettings', {
    inputName,
    inputSettings,
    overlay: true,
  });
}

async function triggerRestartSafe(inputName) {
  if (!inputName) return;
  const client = await ensureConnection();
  await client
    .call('TriggerMediaInputAction', {
      inputName,
      mediaAction: 'OBS_WEBSOCKET_MEDIA_INPUT_ACTION_RESTART',
    })
    .catch((err) => {
      console.error(`Failed to restart media input ${inputName}`, err);
    });
}

async function updateMediaInputs({ gifUrl, soundUrl }) {
  if (!OBS_IMAGE_SOURCE_NAME && !OBS_AUDIO_SOURCE_NAME) {
    return;
  }
  const tasks = [];
  if (OBS_IMAGE_SOURCE_NAME && gifUrl) {
    tasks.push(
      setInputSettingsSafe(OBS_IMAGE_SOURCE_NAME, {
        url: gifUrl,
        local_file: gifUrl,
        file: gifUrl,
      })
        .then(() => triggerRestartSafe(OBS_IMAGE_SOURCE_NAME))
        .catch((err) => {
          console.error(`Failed to update OBS image source ${OBS_IMAGE_SOURCE_NAME}`, err);
        })
    );
  }
  if (OBS_AUDIO_SOURCE_NAME && soundUrl) {
    tasks.push(
      setInputSettingsSafe(OBS_AUDIO_SOURCE_NAME, {
        local_file: soundUrl,
        file: soundUrl,
        playlist: [{ value: soundUrl }],
      })
        .then(() => triggerRestartSafe(OBS_AUDIO_SOURCE_NAME))
        .catch((err) => {
          console.error(`Failed to update OBS audio source ${OBS_AUDIO_SOURCE_NAME}`, err);
        })
    );
  }
  if (tasks.length > 0) {
    await Promise.all(tasks);
  }
}

async function toggleSceneItem(sceneName, sourceName, enabled) {
  if (!sceneName || !sourceName) return;
  const client = await ensureConnection();
  try {
    const { sceneItemId } = await client.call('GetSceneItemId', {
      sceneName,
      sourceName,
    });
    await client.call('SetSceneItemEnabled', {
      sceneName,
      sceneItemId,
      sceneItemEnabled: Boolean(enabled),
    });
  } catch (err) {
    console.error(`Failed to toggle scene item ${sourceName} in ${sceneName}`, err);
  }
}

function isConfigured() {
  return Boolean(OBS_IMAGE_SOURCE_NAME || OBS_AUDIO_SOURCE_NAME);
}

module.exports = {
  ensureConnection,
  updateMediaInputs,
  toggleSceneItem,
  isConfigured,
};
