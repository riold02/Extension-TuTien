function queryInjectedBotStatus() {
  return new Promise((resolve) => {
    const requestId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    let timedOut = false;
    let timeout = null;

    const cleanup = () => {
      window.removeEventListener('message', handleStatusResponse);
      if (timeout) clearTimeout(timeout);
    };

    const handleStatusResponse = (event) => {
      if (!event.data || event.data.source !== 'auto-discord-extension') return;
      
      window.console.log('content.js: Nhận message từ window:', event.data.action, event.data);

      if (event.data.action !== 'status-response' || event.data.requestId !== requestId) {
        return;
      }
      cleanup();
      resolve({
        connected: true,
        running: event.data.running === true,
        gardenStatus: event.data.gardenStatus || '',
        debugLogs: event.data.debugLogs || '[]',
        version: event.data.version || 0
      });
    };

    const sendRequest = () => {
      window.console.log('content.js: Gửi status-request tới inject.js, requestId =', requestId);
      window.postMessage({source: 'auto-discord-extension', action: 'status-request', requestId}, '*');
    };

    window.addEventListener('message', handleStatusResponse);
    sendRequest();
    timeout = setTimeout(() => {
      if (timedOut) return;
      timedOut = true;
      window.console.warn('content.js: status-request lần 1 timeout, thử lại...');
      sendRequest();
      timeout = setTimeout(() => {
        cleanup();
        window.console.error('content.js: Đã thử 2 lần nhưng inject.js không phản hồi status-request. Mất kết nối!');
        resolve({connected: false, running: false, gardenStatus: '', debugLogs: '[]'});
      }, 1500);
    }, 1000);
  });
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || message.source !== 'popup') {
    return;
  }

  window.console.log('content.js: Nhận tin nhắn từ popup:', message.action);

  if (message.action === 'ping') {
    sendResponse({status: 'ok', version: 11});
    return true;
  }

  if (message.action === 'ping-inject') {
    window.console.log('content.js: Đang kiểm tra kết nối với inject.js (ping-inject)...');
    queryInjectedBotStatus().then((status) => {
      if (status.connected) {
        window.console.log('content.js: Kết nối với inject.js OK, version =', status.version);
        sendResponse({status: 'ok', version: status.version});
      } else {
        window.console.error('content.js: Không thể kết nối với inject.js');
        sendResponse({status: 'error'});
      }
    });
    return true;
  }

  if (message.action === 'status') {
    queryInjectedBotStatus().then((status) => {
      sendResponse({status: 'ok', running: status.running, gardenStatus: status.gardenStatus, debugLogs: status.debugLogs});
    });
    return true;
  }

  window.console.log('content.js: Chuyển tiếp action tới window:', message.action);
  window.postMessage(
    {
      source: 'auto-discord-extension',
      action: message.action,
      config: message.config
    },
    '*'
  );
  sendResponse({status: 'ok'});
  return true;
});

