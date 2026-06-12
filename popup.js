const CURRENT_VERSION = 34;

const autoHealInput = document.getElementById('autoHeal');
const autoBiCanhInput = document.getElementById('autoBiCanh');
const autoGardenInput = document.getElementById('autoGarden');
const gardenAoEInput = document.getElementById('gardenAoE');
const minPlayersInput = document.getElementById('minPlayers');
const delayInput = document.getElementById('delayTime');
const cooldownInput = document.getElementById('cooldownTime');
const startStopBtn = document.getElementById('startStopBtn');
const statusText = document.getElementById('statusText');
const gardenStatusText = document.getElementById('gardenStatusText');
const debugLogsContainer = document.getElementById('debugLogs');

const DEFAULT_SETTINGS = {
  autoHeal: true,
  autoBiCanh: true,
  autoGarden: false,
  gardenAoE: false,
  delayTime: 2000,
  cooldownTime: 10000,
  minPlayers: 1
};

function updateStatusText(running, gardenStatus = '', debugLogs = '[]') {
  statusText.textContent = running ? 'Đang chạy' : 'Đang dừng';
  startStopBtn.textContent = running ? 'Dừng' : 'Bắt đầu';
  startStopBtn.dataset.mode = running ? 'stop' : 'start';
  if (running && gardenStatus) {
    gardenStatusText.textContent = gardenStatus;
    gardenStatusText.style.display = 'block';
  } else {
    gardenStatusText.textContent = '';
    gardenStatusText.style.display = 'none';
  }

  if (debugLogs && debugLogs !== '[]') {
    try {
      const logs = JSON.parse(debugLogs);
      if (logs && logs.length > 0) {
        debugLogsContainer.innerHTML = logs.map(l => `<div class="log-line">${l}</div>`).join('');
        debugLogsContainer.scrollTop = debugLogsContainer.scrollHeight;
      } else {
        debugLogsContainer.innerHTML = '<div class="console-empty">Chưa có hoạt động nào được ghi nhận.</div>';
      }
    } catch (e) {
      debugLogsContainer.innerHTML = '<div class="console-empty">Lỗi định dạng nhật ký.</div>';
    }
  } else {
    if (running) {
      debugLogsContainer.innerHTML = '<div class="console-empty">Đang kết nối với bot...</div>';
    } else {
      debugLogsContainer.innerHTML = '<div class="console-empty">Hệ thống đang dừng.</div>';
    }
  }
}

function toggleGardenOptions() {
  const gardenModeGroup = document.getElementById('gardenModeGroup');
  if (autoGardenInput.checked) {
    gardenModeGroup.style.display = 'flex';
  } else {
    gardenModeGroup.style.display = 'none';
  }
}

function toggleBiCanhOptions() {
  const biCanhGroup = document.getElementById('biCanhGroup');
  if (autoBiCanhInput.checked) {
    biCanhGroup.style.display = 'grid';
  } else {
    biCanhGroup.style.display = 'none';
  }
}

function getConfig() {
  return {
    autoHeal: autoHealInput.checked,
    autoBiCanh: autoBiCanhInput.checked,
    autoGarden: autoGardenInput.checked,
    gardenAoE: gardenAoEInput.checked,
    delayTime: Number(delayInput.value) || DEFAULT_SETTINGS.delayTime,
    cooldownTime: Number(cooldownInput.value) || DEFAULT_SETTINGS.cooldownTime,
    minPlayers: Number(minPlayersInput.value) || DEFAULT_SETTINGS.minPlayers
  };
}

async function saveConfig() {
  const config = getConfig();
  chrome.storage.local.set(config);
  try {
    const tab = await findDiscordTab();
    if (tab) {
      await ensureContentScript(tab.id);
      await chrome.tabs.sendMessage(tab.id, {
        source: 'popup',
        action: 'update-config',
        config
      });
    }
  } catch(e) {}
}

async function ensureContentScript(tabId) {
  // 1. Kiểm tra và tiêm content.js vào thế giới ISOLATED
  let contentOk = false;
  try {
    const res = await chrome.tabs.sendMessage(tabId, {source: 'popup', action: 'ping'});
    if (res && res.status === 'ok') {
      contentOk = true;
    }
  } catch (e) {}

  if (!contentOk) {
    await chrome.scripting.executeScript({
      target: {tabId},
      files: ['content.js']
    });
  }

  // 2. Kiểm tra và tiêm inject.js vào thế giới MAIN
  let injectOk = false;
  try {
    const response = await chrome.tabs.sendMessage(tabId, {
      source: 'popup',
      action: 'ping-inject'
    });
    if (response && response.status === 'ok' && response.version === CURRENT_VERSION) {
      injectOk = true;
    }
  } catch (e) {}

  if (!injectOk) {
    await chrome.scripting.executeScript({
      target: {tabId},
      files: ['inject.js'],
      world: 'MAIN'
    });
  }
}

async function findDiscordTab() {
  const [activeTab] = await chrome.tabs.query({active: true, currentWindow: true});
  if (activeTab && activeTab.url && activeTab.url.includes('discord.com')) {
    return activeTab;
  }

  const tabs = await chrome.tabs.query({currentWindow: true});
  return tabs.find((tab) => tab.url && tab.url.includes('discord.com')) || null;
}

async function sendAction(action) {
  const tab = await findDiscordTab();
  if (!tab) {
    statusText.textContent = 'Không tìm thấy tab Discord.';
    return;
  }

  await ensureContentScript(tab.id);

  try {
    const response = await chrome.tabs.sendMessage(tab.id, {
      source: 'popup',
      action,
      config: getConfig()
    });
    if (response && response.status === 'ok') {
      updateStatusText(action === 'start');
    }
  } catch (error) {
    statusText.textContent = 'Lỗi gửi lệnh: ' + error.message;
    console.error(error);
  }
}

async function getRunningStatus() {
  const tab = await findDiscordTab();
  if (!tab) return { running: false, error: 'Không tìm thấy tab Discord.' };

  await ensureContentScript(tab.id);

  try {
    const response = await chrome.tabs.sendMessage(tab.id, {
      source: 'popup',
      action: 'status'
    });
    return response || { running: false };
  } catch (error) {
    return { running: false, error: error.message };
  }
}

async function loadSettings() {
  chrome.storage.local.get(DEFAULT_SETTINGS, async (result) => {
    autoHealInput.checked = result.autoHeal;
    autoBiCanhInput.checked = result.autoBiCanh;
    autoGardenInput.checked = result.autoGarden;
    gardenAoEInput.checked = result.gardenAoE;
    minPlayersInput.value = result.minPlayers;
    delayInput.value = result.delayTime;
    cooldownInput.value = result.cooldownTime;
    toggleGardenOptions();
    toggleBiCanhOptions();
    const status = await getRunningStatus();
    if (status.error) {
      statusText.textContent = 'Lỗi: ' + status.error;
    } else {
      updateStatusText(status.running, status.gardenStatus, status.debugLogs);
    }
  });
}

startStopBtn.addEventListener('click', async () => {
  saveConfig();
  if (startStopBtn.dataset.mode === 'stop') {
    await sendAction('stop');
  } else {
    await sendAction('start');
  }
});

autoHealInput.addEventListener('change', saveConfig);
autoBiCanhInput.addEventListener('change', () => {
  toggleBiCanhOptions();
  saveConfig();
});
autoGardenInput.addEventListener('change', () => {
  toggleGardenOptions();
  saveConfig();
});
gardenAoEInput.addEventListener('change', saveConfig);
minPlayersInput.addEventListener('change', saveConfig);
delayInput.addEventListener('change', saveConfig);
cooldownInput.addEventListener('change', saveConfig);

document.addEventListener('DOMContentLoaded', loadSettings);

let isPolling = false;
setInterval(async () => {
  if (isPolling) return;
  isPolling = true;
  try {
    const status = await getRunningStatus();
    if (status.error) {
      statusText.textContent = 'Lỗi: ' + status.error;
    } else {
      updateStatusText(status.running, status.gardenStatus, status.debugLogs);
    }
  } catch(e) {}
  isPolling = false;
}, 2000);
