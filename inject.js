(() => {
  // Dọn dẹp listener cũ nếu có
  if (window.__autoDiscordBotMessageListener) {
    try {
      window.removeEventListener('message', window.__autoDiscordBotMessageListener);
    } catch(e) {}
  }
  // Dọn dẹp interval cũ nếu có
  if (window.botInterval) {
    try {
      clearInterval(window.botInterval);
      window.botInterval = null;
    } catch(e) {}
  }
  window.autoDiscordBotRunning = false;
  window.__autoDiscordBotInjected = true;
  const safeLocalStorage = (() => {
    try {
      const testKey = '__test_local_storage_accessibility__';
      window.localStorage.setItem(testKey, '1');
      window.localStorage.removeItem(testKey);
      return window.localStorage;
    } catch (e) {
      const store = {};
      return {
        getItem: (key) => store[key] || null,
        setItem: (key, value) => { store[key] = String(value); },
        removeItem: (key) => { delete store[key]; },
        clear: () => { for (const k in store) delete store[k]; }
      };
    }
  })();

  const console = {
    log: function(...args) {
      try {
        const msg = args.join(' ');
        let logs = [];
        try {
          logs = JSON.parse(safeLocalStorage.getItem('garden_debug_logs') || '[]');
        } catch(e) {}
        
        // Tránh log trùng lặp liên tiếp để không làm tràn khung hiển thị
        if (logs.length > 0) {
          const lastLog = logs[logs.length - 1];
          // Trích xuất phần nội dung bằng cách loại bỏ timestamp ở đầu, ví dụ: [12:34:56]
          const lastContent = lastLog.replace(/^\[\d{2}:\d{2}:\d{2}\]\s*/, '');
          if (lastContent === msg) {
            // Vẫn in ra console của trình duyệt để nhà phát triển xem
            try {
              window.console.log(...args);
            } catch(e) {}
            return;
          }
        }
        
        logs.push(`[${new Date().toLocaleTimeString('vi-VN', {hour: '2-digit', minute:'2-digit', second:'2-digit'})}] ${msg}`);
        if (logs.length > 8) logs.shift();
        try {
          safeLocalStorage.setItem('garden_debug_logs', JSON.stringify(logs));
        } catch(e) {}
      } catch(e) {}
      try {
        window.console.log(...args);
      } catch(e) {}
    }
  };


  function getState() {
    window.lastClickedTime = window.lastClickedTime || 0;
    window.lastHealedMsgId = window.lastHealedMsgId || null;
    return {
      autoHeal: window.autoDiscordAutoHeal !== undefined ? window.autoDiscordAutoHeal : true,
      autoBiCanh: window.autoDiscordAutoBiCanh !== undefined ? window.autoDiscordAutoBiCanh : true,
      autoGarden: window.autoDiscordAutoGarden !== undefined ? window.autoDiscordAutoGarden : false,
      gardenAoE: window.autoDiscordGardenAoE !== undefined ? window.autoDiscordGardenAoE : false,
      delayTime: window.autoDiscordDelayTime || 2000,
      cooldownTime: window.autoDiscordCooldownTime || 10000,
      minPlayers: window.autoDiscordMinPlayers !== undefined ? window.autoDiscordMinPlayers : 1
    };
  }

  function setState(config) {
    window.autoDiscordAutoHeal = !!config.autoHeal;
    window.autoDiscordAutoBiCanh = config.autoBiCanh !== undefined ? !!config.autoBiCanh : true;
    window.autoDiscordAutoGarden = !!config.autoGarden;
    window.autoDiscordGardenAoE = !!config.gardenAoE;
    window.autoDiscordDelayTime = parseInt(config.delayTime, 10) || 2000;
    window.autoDiscordCooldownTime = parseInt(config.cooldownTime, 10) || 10000;
    window.autoDiscordMinPlayers = parseInt(config.minPlayers, 10) || 1;
    window.lastClickedTime = window.lastClickedTime || 0;
    window.lastHealedMsgId = window.lastHealedMsgId || null;
  }

  function stopBot() {
    if (window.botInterval) {
      clearInterval(window.botInterval);
      window.botInterval = null;
    }
    window.autoDiscordBotRunning = false;
    console.log('AutoDiscord Bot đã dừng.');
  }

  function runBot() {
    try {
      const config = getState();
      const now = Date.now();
      
      window.console.log(`AutoDiscord runBot: delay=${config.delayTime}ms cooldown=${config.cooldownTime}ms autoHeal=${config.autoHeal} autoGarden=${config.autoGarden}`);
      
      // Áp dụng cooldownTime chung cho cả làm vườn và bí cảnh để bot hoạt động thong thả, an toàn
      if (now - window.lastClickedTime < config.cooldownTime) {
        window.console.log('AutoDiscord: đang đợi cooldown', now - window.lastClickedTime, 'ms');
        return;
      }

      if (config.autoGarden) {
        if (handleGardening(config)) {
          return;
        }
      }

      const dismissNodes = Array.from(document.querySelectorAll('div[role="button"], a, span')).filter((el) => {
        if (!el.innerText) return false;
        const text = el.innerText.trim().toLowerCase();
        return text === 'bỏ qua tin nhắn' || text === 'dismiss message';
      });
      if (dismissNodes.length > 0) {
        dismissNodes.forEach((n) => n.click());
        console.log('🧹 Đã dọn dẹp các tin báo lỗi hệ thống!');
      }

      let messages = Array.from(document.querySelectorAll('li[id^="chat-messages-"]'));
      if (messages.length === 0) {
        messages = Array.from(document.querySelectorAll('[class*="messageListItem"]'));
      }
      if (messages.length === 0) {
        window.console.log('AutoDiscord: không tìm thấy tin nhắn phù hợp để quét.');
        return;
      }

      const recentMessages = messages.slice(-2);
      let buttons = [];
      recentMessages.forEach((msg) => {
        buttons.push(...msg.querySelectorAll('button'));
      });

      const EXCLUDES = [
        'rời', 'khóa phòng', 'làm mới', 'sẵn sàng', 'nghỉ',
        'mời', 'trang chủ', 'kết thúc', 'tạo phòng', 'quay lại',
        'bất chấp', 'phá trận', 'cưỡng ép',
        'hành trang', 'tầm bảo', 'động phủ', 'lịch luyện', 'bí cảnh',
        'hoạt động', 'nhiệm vụ', 'cửa hàng', 'vấn đỉnh', 'vạn bảo lâu',
        'vạn thú các', 'chế tạo', 'bảng xếp hạng', 'hảo hữu', 'thư viện',
        'tông môn', 'đỗ phường', 'đạo quy', 'phúc lợi', 'chat thế giới'
      ];

      buttons = buttons.filter((b) => {
        if (b.disabled || !b.innerText) return false;
        const text = b.innerText.toLowerCase().trim();
        return !EXCLUDES.some((ex) => text.includes(ex));
      });
      if (buttons.length === 0) {
        window.console.log('AutoDiscord: không tìm thấy nút hợp lệ sau khi lọc exclude.');
        return;
      }

      buttons = buttons.reverse();

      // Kiểm tra xem có đang ở màn hình sảnh chờ (Lobby) hay không
      let isLobby = false;
      let lobbyMsg = null;
      if (config.autoBiCanh || config.autoHeal) {
        // Tìm tin nhắn mới nhất trong 2 tin nhắn gần đây có chứa nút bấm
        let activeMsgWithButtons = null;
        for (let i = recentMessages.length - 1; i >= 0; i--) {
          const msg = recentMessages[i];
          if (msg.querySelectorAll('button').length > 0) {
            activeMsgWithButtons = msg;
            break;
          }
        }
        if (activeMsgWithButtons) {
          const text = activeMsgWithButtons.innerText || "";
          if (text.match(/(?:đội ngũ|thành viên|số người|phòng|đội|đội hình|lobby|nhóm)\s*[:(]?\s*(\d+)\s*\/\s*(\d+)/i)) {
            isLobby = true;
            lobbyMsg = activeMsgWithButtons;
          }
        }
      }

      let lobbyMsgId = 'unknown_lobby';
      if (isLobby && lobbyMsg) {
        lobbyMsgId = lobbyMsg.id || lobbyMsg.getAttribute('data-list-item-id') || 'unknown_lobby';
      }

      // Giải phóng bộ đếm hồi máu khi không còn ở trong sảnh (ví dụ khi đang đi phó bản)
      if (!isLobby) {
        if (window.localStorage) {
          try {
            for (let i = window.localStorage.length - 1; i >= 0; i--) {
              const key = window.localStorage.key(i);
              if (key && key.startsWith('heal_clicks_')) {
                window.localStorage.removeItem(key);
              }
            }
          } catch(e) {}
        }
      }

      const SPECIAL_PRIORITIES = ['hứng lấy linh nhũ', 'để lại cho sinh linh khác', 'lắng nghe', 'phong ấn', 'cân bằng'];
      const PRIORITIES = ['sinh', 'hưu', 'cảnh', 'khai', 'đỗ'];
      const AUTO_CLICKS = ['bắt đầu', 'tiếp tục', 'tiếp tục khám phá', 'khởi hành', 'chiến tiếp'];

      let targetButton = null;
      let actionName = "";

      // 1. Ưu tiên 1: Hồi Toàn Đội (chỉ ở sảnh chờ, nếu có bật autoHeal và số lần click < 3)
      if (!targetButton && isLobby && config.autoHeal) {
        const clicksStr = safeLocalStorage.getItem('heal_clicks_' + lobbyMsgId);
        const clicks = clicksStr ? parseInt(clicksStr, 10) : 0;
        if (clicks < 3) {
          const hasHeal = buttons.find((b) => b.innerText && b.innerText.toLowerCase().trim() === 'hồi toàn đội');
          if (hasHeal) {
            targetButton = hasHeal;
            actionName = `Hồi Toàn Đội lần ${clicks + 1}/3`;
            safeLocalStorage.setItem('heal_clicks_' + lobbyMsgId, (clicks + 1).toString());
          }
        }
      }

      // 2. Ưu tiên 2: Các sự kiện đặc biệt trong bí cảnh (SPECIAL_PRIORITIES)
      if (!targetButton && config.autoBiCanh && !isLobby) {
        for (const sp of SPECIAL_PRIORITIES) {
          const btn = buttons.find((b) => b.innerText.toLowerCase().trim().includes(sp));
          if (btn) {
            targetButton = btn;
            actionName = `Sự kiện đặc biệt: ${btn.innerText}`;
            break;
          }
        }
      }

      // 3. Ưu tiên 3: Bắt Đầu / Khởi Hành (ở sảnh chờ, nếu bật autoBiCanh, kiểm tra đủ người và hoàn thành hồi máu)
      if (!targetButton && isLobby && config.autoBiCanh) {
        const startBtn = buttons.find((b) => {
          const text = b.innerText.toLowerCase();
          return text.includes('bắt đầu') || text.includes('khởi hành');
        });

        if (startBtn) {
          // Nếu bật tự động hồi máu, phải đảm bảo đã hồi máu đủ 3 lần trước khi bắt đầu!
          let canStart = true;
          if (config.autoHeal) {
            const clicksStr = safeLocalStorage.getItem('heal_clicks_' + lobbyMsgId);
            const clicks = clicksStr ? parseInt(clicksStr, 10) : 0;
            if (clicks < 3) {
              canStart = false;
              const statusMsg = `Bí Cảnh: Đang đợi hồi máu đủ 3 lần (Hiện tại: ${clicks}/3)...`;
              safeLocalStorage.setItem('bicanh_status_text', statusMsg);
              window.console.log(`AutoDiscord: ${statusMsg}`);
            }
          }

          if (canStart) {
            const lobbyText = lobbyMsg.innerText || "";
            let currentPlayers = 1;
            let match = lobbyText.match(/(?:đội ngũ|thành viên|số người|phòng|đội|đội hình|lobby|nhóm)\s*[:(]?\s*(\d+)\s*\/\s*(\d+)/i);
            if (match) {
              currentPlayers = parseInt(match[1], 10);
            }

            if (currentPlayers < config.minPlayers) {
              const statusMsg = `Bí Cảnh: Chờ đủ ${config.minPlayers} người (Hiện tại: ${currentPlayers}/${match ? match[2] : '5'})`;
              safeLocalStorage.setItem('bicanh_status_text', statusMsg);
              window.console.log(`AutoDiscord: ${statusMsg}`);
            } else {
              targetButton = startBtn;
              actionName = `Bấm Bắt đầu/Khởi hành (Đội: ${currentPlayers}/${match ? match[2] : '5'})`;
            }
          }
        }
      }

      // 4. Ưu tiên 4: Cửa theo thứ tự ưu tiên (PRIORITIES)
      if (!targetButton && config.autoBiCanh && !isLobby) {
        for (const p of PRIORITIES) {
          const btn = buttons.find((b) => b.innerText.toLowerCase().includes(p) && b.innerText.includes('['));
          if (btn) {
            targetButton = btn;
            actionName = `Di chuyển cửa ưu tiên ${btn.innerText}`;
            break;
          }
        }
      }

      // 5. Ưu tiên 5: Cửa bất kỳ (chứa [ và ])
      if (!targetButton && config.autoBiCanh && !isLobby) {
        const doors = buttons.filter((b) => b.innerText.includes('[') && b.innerText.includes(']'));
        if (doors.length > 0) {
          const btn = doors[Math.floor(Math.random() * doors.length)];
          targetButton = btn;
          actionName = `Di chuyển cửa ngẫu nhiên ${btn.innerText}`;
        }
      }

      // 6. Ưu tiên 6: Các nút tự động cơ bản (bắt đầu, tiếp tục, chiến tiếp...)
      if (!targetButton && config.autoBiCanh && !isLobby) {
        const btn = buttons.find((b) => {
          const text = b.innerText.toLowerCase().trim();
          return AUTO_CLICKS.some((ac) => text.includes(ac));
        });
        if (btn) {
          targetButton = btn;
          actionName = `Bấm nút tự động cơ bản: ${btn.innerText}`;
          
          // Dọn dẹp bộ đếm hồi máu khi bấm "chiến tiếp"
          if (btn.innerText.toLowerCase().trim().includes('chiến tiếp')) {
            if (window.localStorage) {
              try {
                for (let i = window.localStorage.length - 1; i >= 0; i--) {
                  const key = window.localStorage.key(i);
                  if (key && key.startsWith('heal_clicks_')) {
                    window.localStorage.removeItem(key);
                  }
                }
              } catch(e) {}
            }
          }
        }
      }

      // 7. Ưu tiên 7: Nút ngẫu nhiên dòng dưới cùng (Dự phòng bí cảnh)
      if (!targetButton && config.autoBiCanh && !isLobby && buttons.length > 0) {
        const bottomY = buttons[0].getBoundingClientRect().bottom;
        const recentButtons = buttons.filter((b) => Math.abs(bottomY - b.getBoundingClientRect().bottom) < 100);
        const btn = recentButtons[Math.floor(Math.random() * recentButtons.length)];
        if (btn) {
          targetButton = btn;
          actionName = `Bấm nút ngẫu nhiên dự phòng: ${btn.innerText}`;
        }
      }

      // Xử lý khi ở sảnh chờ mà không click nút nào (do đang chờ người hoặc chờ hồi máu)
      if (isLobby && !targetButton) {
        const statusMsg = safeLocalStorage.getItem('bicanh_status_text');
        if (!statusMsg || (!statusMsg.includes('Chờ đủ') && !statusMsg.includes('đợi hồi máu'))) {
          const defaultStatus = `Bí Cảnh: Đang trong phòng chờ, đợi chủ phòng xuất phát...`;
          safeLocalStorage.setItem('bicanh_status_text', defaultStatus);
          window.console.log(`AutoDiscord: ${defaultStatus}`);
        }
        return; // Dừng lại ở sảnh chờ, tuyệt đối không click bậy bạ
      }

      if (targetButton) {
        const textLower = targetButton.innerText.toLowerCase();
        
        // Cập nhật status hiển thị
        if (textLower.includes('[') && textLower.includes(']')) {
          safeLocalStorage.setItem('bicanh_status_text', `Bí Cảnh: Di chuyển cửa ${targetButton.innerText}`);
        } else if (textLower.includes('chiến tiếp')) {
          safeLocalStorage.setItem('bicanh_status_text', 'Bí Cảnh: Bấm Chiến tiếp...');
        } else if (textLower.includes('tiếp tục')) {
          safeLocalStorage.setItem('bicanh_status_text', 'Bí Cảnh: Bấm Tiếp tục khám phá...');
        } else if (actionName) {
          safeLocalStorage.setItem('bicanh_status_text', `Bí Cảnh: ${actionName}`);
        }

        console.log(`✅ Bot vừa bấm nút: ${targetButton.innerText} (${actionName || 'Tự động'})`);
        window.lastClickedTime = Date.now();
        targetButton.click();
      } else {
        window.console.log('AutoDiscord: không tìm thấy nút để bấm trong lần quét này.');
      }
    } catch (e) {
      console.log('Lỗi thực thi bot:', e.message);
      window.console.error('inject.js: Lỗi thực thi bot:', e);
    }
  }

  function isGardenCooldownActive() {
    try {
      const lastGardenTime = safeLocalStorage.getItem('lastGardenTime');
      if (!lastGardenTime) return false;
      const elapsed = Date.now() - parseInt(lastGardenTime, 10);
      return elapsed < 1 * 60 * 1000; // 1 minute in ms
    } catch(e) {
      window.console.error('inject.js: isGardenCooldownActive error:', e);
      return false;
    }
  }

  function checkAndResetGardenFlags() {
    try {
      const lastGardenTime = safeLocalStorage.getItem('lastGardenTime');
      if (lastGardenTime) {
        const elapsed = Date.now() - parseInt(lastGardenTime, 10);
        if (elapsed >= 1 * 60 * 1000) {
          safeLocalStorage.removeItem('garden_che_dan_done');
          safeLocalStorage.removeItem('garden_luyen_hoa_done');
          safeLocalStorage.removeItem('garden_quy_hiem_done');
          safeLocalStorage.removeItem('active_garden');
          safeLocalStorage.removeItem('well_water_drawn');
          safeLocalStorage.removeItem('garden_aoe_clicked');
          safeLocalStorage.removeItem('lastGardenTime');
          console.log('AutoDiscord: Đã hết cooldown 1 phút, reset trạng thái làm vườn.');
        }
      }
    } catch(e) {}
  }

  function getGardenStatusText() {
    try {
      if (!window.autoDiscordBotRunning) {
        return "";
      }
      
      const statusParts = [];
      
      // 1. Trạng thái Auto làm vườn
      if (window.autoDiscordAutoGarden) {
        if (isGardenCooldownActive()) {
          const lastGardenTime = safeLocalStorage.getItem('lastGardenTime');
          if (lastGardenTime) {
            const elapsed = Date.now() - parseInt(lastGardenTime, 10);
            const remaining = 1 * 60 * 1000 - elapsed;
            if (remaining > 0) {
              const minutes = Math.floor(remaining / 60000);
              const seconds = Math.floor((remaining % 60000) / 1000);
              statusParts.push(`Làm vườn: Chờ CD ${minutes}ph ${seconds}s`);
            }
          }
        } else {
          statusParts.push(safeLocalStorage.getItem('garden_status_text') || 'Đang chuẩn bị làm vườn...');
        }
      }
      
      // 2. Trạng thái Bí cảnh / Hồi máu
      if (window.autoDiscordAutoBiCanh || window.autoDiscordAutoHeal) {
        const bicanhStatus = safeLocalStorage.getItem('bicanh_status_text');
        if (bicanhStatus) {
          statusParts.push(bicanhStatus);
        }
      }
      
      if (statusParts.length > 0) {
        return statusParts.join(' | ');
      }
      
      return "Đang chạy, chờ hoạt động...";
    } catch(e) {
      window.console.error('inject.js: getGardenStatusText error:', e);
      return "Lỗi đọc trạng thái";
    }
  }

  function handleGardening(config) {
    checkAndResetGardenFlags();
    const cooldownActive = isGardenCooldownActive();

    let messages = Array.from(document.querySelectorAll('li[id^="chat-messages-"]'));
    if (messages.length === 0) {
      messages = Array.from(document.querySelectorAll('[class*="messageListItem"]'));
    }
    if (messages.length === 0) return false;

    // ONLY check the latest message
    const latestMsg = messages[messages.length - 1];
    if (!latestMsg) return false;

    // Must have buttons or a select menu to be a valid game screen
    const buttons = Array.from(latestMsg.querySelectorAll('button'));
    const hasSelect = latestMsg.querySelector('[role="combobox"], [class*="select"]');
    if (buttons.length === 0 && !hasSelect) {
      return false;
    }

    const text = latestMsg.innerText || "";
    
    const hasDuocVienBtn = buttons.some(b => b.innerText && b.innerText.toLowerCase().trim() === 'dược viên');
    let isGardenScreen = false;
    if (
      text.toLowerCase().includes("hồ sơ làm vườn") ||
      text.toLowerCase().includes("sơ đồ quy hoạch") ||
      text.toLowerCase().includes("chi tiết ô đất") ||
      hasDuocVienBtn
    ) {
      isGardenScreen = true;
    }

    if (!isGardenScreen) {
      // If we are not in a garden screen, and cooldown is not active, we try to enter the Sect (Tông Môn) page.
      if (!cooldownActive) {
        const tongMonBtn = buttons.find(b => b.innerText && b.innerText.toLowerCase().trim() === 'tông môn');
        if (tongMonBtn && !tongMonBtn.disabled) {
          console.log('AutoDiscord: Bấm "Tông Môn" để vào Dược Viên.');
          safeLocalStorage.setItem('garden_status_text', 'Đang vào Tông Môn...');
          tongMonBtn.click();
          window.lastClickedTime = Date.now() + 2000;
          return true;
        }
      }
      return false; // Let normal bot run (e.g. explore secret realm / bí cảnh)
    }

    // --- CASE 1: LOBBY PAGE ---
    if (text.toLowerCase().includes("hồ sơ làm vườn của đạo hữu:")) {
      if (cooldownActive) {
        const quayLaiBtn = buttons.find(b => b.innerText && b.innerText.toLowerCase().includes('quay lại tông môn'));
        if (quayLaiBtn && !quayLaiBtn.disabled) {
          console.log('AutoDiscord: Đang cooldown, rời Dược Viên về Tông Môn.');
          safeLocalStorage.setItem('garden_status_text', 'Rời Dược Viên (cooldown)...');
          quayLaiBtn.click();
          window.lastClickedTime = Date.now() + 3000;
          return true;
        }
      } else {
        const wellWaterDrawn = safeLocalStorage.getItem('well_water_drawn') === 'true';
        if (!wellWaterDrawn) {
          const mucNuocBtn = buttons.find(b => b.innerText && b.innerText.toLowerCase().includes('múc nước giếng'));
          if (mucNuocBtn) {
            if (!mucNuocBtn.disabled) {
              console.log('AutoDiscord: Bấm múc nước giếng.');
              safeLocalStorage.setItem('garden_status_text', 'Đang múc nước giếng...');
              safeLocalStorage.setItem('well_water_drawn', 'true');
              mucNuocBtn.click();
              window.lastClickedTime = Date.now() + 2000;
              return true;
            }
          }
          // Nếu không tìm thấy nút hoặc nút bị vô hiệu hóa, đánh dấu đã hoàn thành để chuyển sang làm vườn
          safeLocalStorage.setItem('well_water_drawn', 'true');
        }

        const cheDanDone = safeLocalStorage.getItem('garden_che_dan_done') === 'true';
        const luyenHoaDone = safeLocalStorage.getItem('garden_luyen_hoa_done') === 'true';
        const quyHiemDone = safeLocalStorage.getItem('garden_quy_hiem_done') === 'true';

        if (!cheDanDone) {
          const btn = buttons.find(b => b.innerText && b.innerText.toLowerCase().includes('vườn chế đan'));
          if (btn && !btn.disabled) {
            console.log('AutoDiscord: Vào Vườn Chế Đan.');
            safeLocalStorage.setItem('active_garden', 'che_dan');
            safeLocalStorage.setItem('garden_status_text', 'Đang vào Vườn Chế Đan...');
            btn.click();
            window.lastClickedTime = Date.now() + 2000;
            return true;
          }
        } else if (!luyenHoaDone) {
          const btn = buttons.find(b => b.innerText && b.innerText.toLowerCase().includes('vườn luyện hóa'));
          if (btn && !btn.disabled) {
            console.log('AutoDiscord: Vào Vườn Luyện Hóa.');
            safeLocalStorage.setItem('active_garden', 'luyen_hoa');
            safeLocalStorage.setItem('garden_status_text', 'Đang vào Vườn Luyện Hóa...');
            btn.click();
            window.lastClickedTime = Date.now() + 2000;
            return true;
          }
        } else if (!quyHiemDone) {
          const btn = buttons.find(b => b.innerText && b.innerText.toLowerCase().includes('vườn quý hiếm'));
          if (btn && !btn.disabled) {
            console.log('AutoDiscord: Vào Vườn Quý Hiếm.');
            safeLocalStorage.setItem('active_garden', 'quy_hiem');
            safeLocalStorage.setItem('garden_status_text', 'Đang vào Vườn Quý Hiếm...');
            btn.click();
            window.lastClickedTime = Date.now() + 2000;
            return true;
          }
        } else {
          console.log('AutoDiscord: Đã hoàn thành tất cả các vườn. Kích hoạt cooldown 1 phút.');
          safeLocalStorage.setItem('lastGardenTime', Date.now().toString());
          safeLocalStorage.setItem('garden_status_text', 'Đã xong toàn bộ vườn.');
          const quayLaiBtn = buttons.find(b => b.innerText && b.innerText.toLowerCase().includes('quay lại tông môn'));
          if (quayLaiBtn && !quayLaiBtn.disabled) {
            quayLaiBtn.click();
            window.lastClickedTime = Date.now() + 3000;
            return true;
          }
        }
      }
      return true;
    }

    // --- CASE 2: GARDEN MAP PAGE ---
    if (text.toLowerCase().includes("sơ đồ quy hoạch")) {
      if (cooldownActive) {
        const quayLaiBtn = buttons.find(b => {
          const t = (b.innerText || "").toLowerCase();
          return t.includes('quay lại') || t.includes('trở về') || t.includes('dược viên');
        });
        if (quayLaiBtn && !quayLaiBtn.disabled) {
          quayLaiBtn.click();
          window.lastClickedTime = Date.now() + 3000;
          return true;
        }
      } else {
        const activeGarden = safeLocalStorage.getItem('active_garden') || 'che_dan';
        const isCurrentDone = safeLocalStorage.getItem('garden_' + activeGarden + '_done') === 'true';

        let gardenName = "Chế Đan";
        if (activeGarden === 'luyen_hoa') gardenName = "Luyện Hóa";
        else if (activeGarden === 'quy_hiem') gardenName = "Quý Hiếm";

        if (isCurrentDone) {
          const quayLaiBtn = buttons.find(b => {
            const t = (b.innerText || "").toLowerCase();
            return t.includes('quay lại') || t.includes('trở về') || t.includes('dược viên');
          });
          if (quayLaiBtn && !quayLaiBtn.disabled) {
            safeLocalStorage.setItem('garden_status_text', `Vườn ${gardenName}: Đã xong, đang trở ra...`);
            quayLaiBtn.click();
            window.lastClickedTime = Date.now() + 3000;
            return true;
          }
        } else {
          if (config.gardenAoE) {
            const aoeClicked = safeLocalStorage.getItem('garden_aoe_clicked') === 'true';
            if (aoeClicked) {
              // Đã bấm AoE 1 lần rồi, giờ bấm quay lại sảnh chính Dược Viên
              console.log(`AutoDiscord: Đã bấm AoE xong cho vườn ${activeGarden}. Quay lại Dược Viên.`);
              safeLocalStorage.removeItem('garden_aoe_clicked');
              safeLocalStorage.setItem('garden_' + activeGarden + '_done', 'true');
              safeLocalStorage.setItem('garden_status_text', `Vườn ${gardenName}: Hoàn thành AoE, đang trở ra...`);
              const quayLaiBtn = buttons.find(b => {
                const t = (b.innerText || "").toLowerCase();
                return t.includes('quay lại') || t.includes('trở về') || t.includes('dược viên');
              });
              if (quayLaiBtn && !quayLaiBtn.disabled) {
                quayLaiBtn.click();
                window.lastClickedTime = Date.now() + 3000;
                return true;
              }
            } else {
              // Chưa bấm AoE, tìm nút AoE nào sáng (hoạt động) thì bấm
              const activeAoEBtn = buttons.find(b => {
                if (b.disabled || !b.innerText) return false;
                const t = b.innerText.toLowerCase();
                return t.includes('aoe');
              });

              if (activeAoEBtn) {
                console.log(`AutoDiscord: Bấm nút AoE: ${activeAoEBtn.innerText}`);
                safeLocalStorage.setItem('garden_status_text', `Vườn ${gardenName}: Đang sử dụng AoE...`);
                safeLocalStorage.setItem('garden_aoe_clicked', 'true');
                activeAoEBtn.click();
                window.lastClickedTime = Date.now() + 2000;
                return true;
              } else {
                // Không có nút AoE nào sáng -> coi như xong vườn này luôn
                console.log(`AutoDiscord: Không có nút AoE hoạt động. Hoàn thành vườn ${activeGarden}.`);
                safeLocalStorage.setItem('garden_' + activeGarden + '_done', 'true');
                safeLocalStorage.setItem('garden_status_text', `Vườn ${gardenName}: Không có AoE sáng, đang trở ra...`);
                const quayLaiBtn = buttons.find(b => {
                  const t = (b.innerText || "").toLowerCase();
                  return t.includes('quay lại') || t.includes('trở về') || t.includes('dược viên');
                });
                if (quayLaiBtn && !quayLaiBtn.disabled) {
                  quayLaiBtn.click();
                  window.lastClickedTime = Date.now() + 3000;
                  return true;
                }
              }
            }
          } else {
            // Chế độ đơn thể (chăm sóc từng ô)
            let selectMenu = latestMsg.querySelector('[role="combobox"], [class*="select"]');
            if (!selectMenu) {
              // Fallback: Tìm thẻ div hoặc button có chứa chữ "Chọn một ô đất" hoặc "gieo hạt"
              selectMenu = Array.from(latestMsg.querySelectorAll('div, button, [role="button"]')).find(el => {
                const t = el.innerText ? el.innerText.toLowerCase() : "";
                return t.includes("chọn một ô đất") || t.includes("gieo hạt") || t.includes("làm vườn") || t.includes("ô đất");
              });
            }

            if (selectMenu) {
              // Tìm option trực tiếp trên toàn bộ document để tránh lỗi so khớp sai container
              let option = Array.from(document.querySelectorAll('[role="option"], [class*="option-"], [class*="menuItem-"]')).find(el => {
                const t = (el.innerText || "").trim();
                return /Ô 1[^0-9]/.test(t) || t === "Ô 1" || t.includes("Ô đất 1") || t.includes("[1]");
              });

              if (!option) {
                // Fallback 1: Tìm trong các listbox hoặc popout container
                const containers = Array.from(document.querySelectorAll('[role="listbox"], [class*="popout-"], [class*="layer-"], [class*="menu-"], [class*="dropdown"]'));
                for (const container of containers) {
                  // Tránh so khớp nhầm với container chính của app (layers-...)
                  if (container.classList && (container.classList.contains('layers-1YqQoP') || container.className.includes('layers-'))) {
                    continue;
                  }
                  const found = Array.from(container.querySelectorAll('div, span, [role="button"], [role="option"]')).find(el => {
                    const t = (el.innerText || "").trim();
                    return /Ô 1[^0-9]/.test(t) || t === "Ô 1" || t.includes("Ô đất 1") || t.includes("[1]");
                  });
                  if (found) {
                    option = found;
                    break;
                  }
                }
              }

              if (!option) {
                // Fallback 2: Quét mọi thẻ có class hoặc role liên quan đến option, chứa text "Ô 1"
                option = Array.from(document.querySelectorAll('div, span, li')).find(el => {
                  const t = (el.innerText || "").trim();
                  const hasOptionText = /Ô 1[^0-9]/.test(t) || t === "Ô 1" || t.includes("Ô đất 1") || t.includes("[1]");
                  const isClickable = el.getAttribute('role') === 'option' || 
                                     el.className.includes('option') || 
                                     el.closest('[role="option"]') || 
                                     el.closest('[class*="option-"]') ||
                                     el.closest('[role="listbox"]');
                  return hasOptionText && isClickable;
                });
              }

              if (option) {
                console.log('AutoDiscord: Tìm thấy Ô 1:', option.innerText || option.textContent);
                console.log('AutoDiscord: Chọn Ô 1 từ menu.');
                safeLocalStorage.setItem('garden_status_text', `Vườn ${gardenName}: Đang chọn Ô 1...`);
                option.click();
                window.lastClickedTime = Date.now();
                return true;
              } else {
                console.log('AutoDiscord: Click dropdown chọn ô đất.');
                safeLocalStorage.setItem('garden_status_text', `Vườn ${gardenName}: Mở menu chọn ô...`);
                selectMenu.click();
                window.lastClickedTime = Date.now();
                return true;
              }
            } else {
              console.log('AutoDiscord: Không tìm thấy Select Dropdown để chọn ô đất.');
            }
          }
        }
      }
      return true;
    }

    // --- CASE 3: PLOT DETAILS PAGE ---
    if (text.toLowerCase().includes("chi tiết ô đất")) {
      if (config.gardenAoE) {
        // Trong chế độ AoE mà lỡ lạc vào trang chi tiết, bấm quay lại vườn ngay
        const quayLaiBtn = buttons.find(b => b.innerText && (b.innerText.toLowerCase().includes('quay lại vườn') || b.innerText.toLowerCase().includes('quay lại')));
        if (quayLaiBtn && !quayLaiBtn.disabled) {
          console.log('AutoDiscord: Đang ở chế độ AoE, quay lại sơ đồ vườn.');
          quayLaiBtn.click();
          window.lastClickedTime = Date.now() + 3000;
          return true;
        }
      }

      if (cooldownActive) {
        const quayLaiBtn = buttons.find(b => b.innerText && (b.innerText.toLowerCase().includes('quay lại vườn') || b.innerText.toLowerCase().includes('quay lại')));
        if (quayLaiBtn && !quayLaiBtn.disabled) {
          quayLaiBtn.click();
          window.lastClickedTime = Date.now() + 3000;
          return true;
        }
      } else {
        const plotMatch = text.match(/Chi Tiết Ô Đất\s*(\d+)(?:\s*\/\s*(\d+))?/i);
        const currentPlot = plotMatch ? parseInt(plotMatch[1], 10) : 1;

        let currentGardenType = 'che_dan';
        if (text.toLowerCase().includes('luyện hóa')) {
          currentGardenType = 'luyen_hoa';
        } else if (text.toLowerCase().includes('quý hiếm')) {
          currentGardenType = 'quy_hiem';
        }
        safeLocalStorage.setItem('active_garden', currentGardenType);

        let maxPlots = 14;
        if (plotMatch && plotMatch[2]) {
          maxPlots = parseInt(plotMatch[2], 10);
        } else {
          if (currentGardenType === 'quy_hiem') {
            maxPlots = 6;
          } else {
            maxPlots = 14;
          }
        }

        const wormsMatch = text.match(/Yêu trùng phá hoại:\s*(\d+)/i);
        const wormsCount = wormsMatch ? parseInt(wormsMatch[1], 10) : 0;

        const waterLineMatch = text.match(/Tưới nước:\s*([^\n]+)/i);
        const waterStatus = waterLineMatch ? waterLineMatch[1] : "";
        const canWater = waterStatus.includes("✅") || waterStatus.includes("Có thể làm ngay");

        const fertilizeLineMatch = text.match(/Bón phân:\s*([^\n]+)/i);
        const fertilizeStatus = fertilizeLineMatch ? fertilizeLineMatch[1] : "";
        const canFertilize = fertilizeStatus.includes("✅") || fertilizeStatus.includes("Có thể làm ngay");

        let gardenName = "Chế Đan";
        if (currentGardenType === 'luyen_hoa') gardenName = "Luyện Hóa";
        else if (currentGardenType === 'quy_hiem') gardenName = "Quý Hiếm";

        let actionText = "";
        if (wormsCount > 0) {
          actionText = " - Diệt sâu 🐛";
        } else if (canWater && canFertilize) {
          actionText = " - Tưới & Bón phân 💧🌱";
        } else if (canWater) {
          actionText = " - Tưới nước 💧";
        } else if (canFertilize) {
          actionText = " - Bón phân 🌱";
        } else {
          actionText = " - Đã chăm xong";
        }

        safeLocalStorage.setItem('garden_status_text', `Vườn ${gardenName}: Ô ${currentPlot}/${maxPlots}${actionText}`);
        console.log(`AutoDiscord Ô Đất ${currentPlot}/${maxPlots}: worms=${wormsCount} canWater=${canWater} canFertilize=${canFertilize}`);

        if (wormsCount > 0) {
          const batSauBtn = buttons.find(b => b.innerText && b.innerText.toLowerCase().includes('bắt sâu'));
          if (batSauBtn && !batSauBtn.disabled) {
            console.log(`AutoDiscord: Bấm diệt sâu cho ô ${currentPlot}.`);
            batSauBtn.click();
            window.lastClickedTime = Date.now();
            return true;
          }
        } else {
          if (canWater) {
            const tuoiNuocBtn = buttons.find(b => b.innerText && b.innerText.toLowerCase().includes('tưới nước') && !b.innerText.toLowerCase().includes('aoe'));
            if (tuoiNuocBtn && !tuoiNuocBtn.disabled) {
              console.log(`AutoDiscord: Bấm tưới nước cho ô ${currentPlot}.`);
              tuoiNuocBtn.click();
              window.lastClickedTime = Date.now();
              return true;
            }
          }
          if (canFertilize) {
            const bonPhanBtn = buttons.find(b => b.innerText && b.innerText.toLowerCase().includes('bón phân') && !b.innerText.toLowerCase().includes('aoe'));
            if (bonPhanBtn && !bonPhanBtn.disabled) {
              console.log(`AutoDiscord: Bấm bón phân cho ô ${currentPlot}.`);
              bonPhanBtn.click();
              window.lastClickedTime = Date.now();
              return true;
            }
          }
        }

        if (currentPlot === maxPlots) {
          console.log(`AutoDiscord: Đã xong ô cuối cùng (${currentPlot}) của vườn ${currentGardenType}.`);
          safeLocalStorage.setItem('garden_' + currentGardenType + '_done', 'true');
          safeLocalStorage.setItem('garden_status_text', `Vườn ${gardenName}: Xong Ô ${currentPlot}/${maxPlots}, đang quay lại...`);
          const quayLaiBtn = buttons.find(b => b.innerText && (b.innerText.toLowerCase().includes('quay lại vườn') || b.innerText.toLowerCase().includes('quay lại')));
          if (quayLaiBtn && !quayLaiBtn.disabled) {
            quayLaiBtn.click();
            window.lastClickedTime = Date.now() + 3000;
            return true;
          }
        } else {
          const cayTiepBtn = buttons.find(b => b.innerText && b.innerText.toLowerCase().includes('cây tiếp'));
          if (cayTiepBtn && !cayTiepBtn.disabled) {
            console.log(`AutoDiscord: Chuyển sang cây tiếp theo (${currentPlot + 1}).`);
            safeLocalStorage.setItem('garden_status_text', `Vườn ${gardenName}: Xong Ô ${currentPlot}/${maxPlots}, chuyển tiếp...`);
            cayTiepBtn.click();
            window.lastClickedTime = Date.now();
            return true;
          } else {
            // Fallback: Nếu không tìm thấy nút "Cây Tiếp" hoặc nút bị disabled, hãy thử bấm "Quay lại" để tránh bị kẹt
            const quayLaiBtn = buttons.find(b => b.innerText && (b.innerText.toLowerCase().includes('quay lại vườn') || b.innerText.toLowerCase().includes('quay lại')));
            if (quayLaiBtn && !quayLaiBtn.disabled) {
              console.log(`AutoDiscord: Không tìm thấy nút "Cây Tiếp", quay lại vườn.`);
              quayLaiBtn.click();
              window.lastClickedTime = Date.now() + 3000;
              return true;
            }
          }
        }
      }
      return true;
    }

    // --- CASE 4: SECT PAGE ---
    if (hasDuocVienBtn) {
      const duocVienBtn = buttons.find(b => b.innerText && b.innerText.toLowerCase().trim() === 'dược viên');
      if (!cooldownActive && duocVienBtn && !duocVienBtn.disabled) {
        console.log('AutoDiscord: Bấm "Dược Viên" từ Tông Môn.');
        safeLocalStorage.setItem('garden_status_text', 'Vào Dược Viên...');
        duocVienBtn.click();
        window.lastClickedTime = Date.now() + 2000;
        return true;
      }
      if (cooldownActive) {
        const quayLaiBtn = buttons.find(b => b.innerText && (b.innerText.toLowerCase().includes('quay lại') || b.innerText.toLowerCase().includes('trở về') || b.innerText.toLowerCase().includes('khám phá') || b.innerText.toLowerCase().includes('quay lại tông môn')));
        if (quayLaiBtn && !quayLaiBtn.disabled) {
          console.log('AutoDiscord: Rời Tông Môn về màn hình khám phá.');
          safeLocalStorage.setItem('garden_status_text', 'Rời Tông Môn...');
          quayLaiBtn.click();
          window.lastClickedTime = Date.now() + 3000;
          return true;
        }
      }
    }

    return false;
  }

  function startBot(config = {}) {
    setState(config);
    stopBot();

    // Clear gardening state when starting fresh
    safeLocalStorage.removeItem('garden_che_dan_done');
    safeLocalStorage.removeItem('garden_luyen_hoa_done');
    safeLocalStorage.removeItem('garden_quy_hiem_done');
    safeLocalStorage.removeItem('active_garden');
    safeLocalStorage.removeItem('well_water_drawn');
    safeLocalStorage.removeItem('garden_aoe_clicked');
    safeLocalStorage.removeItem('lastGardenTime');
    safeLocalStorage.removeItem('garden_status_text');
    safeLocalStorage.removeItem('garden_debug_logs');
    safeLocalStorage.removeItem('bicanh_status_text');
    if (window.localStorage) {
      try {
        for (let i = window.localStorage.length - 1; i >= 0; i--) {
          const key = window.localStorage.key(i);
          if (key && key.startsWith('heal_clicks_')) {
            window.localStorage.removeItem(key);
          }
        }
      } catch(e) {}
    }
    console.log('AutoDiscord: Đã reset bộ nhớ làm vườn & hồi hp khi khởi động bot.');

    window.botInterval = setInterval(runBot, window.autoDiscordDelayTime);
    window.autoDiscordBotRunning = true;
    runBot();
    console.log('🚀 AutoDiscord Bot đã bật.');
  }

  window.__autoDiscordBotMessageListener = (event) => {
    try {
      if (!event.data || event.data.source !== 'auto-discord-extension') return;
      
      window.console.log('inject.js: Nhận message từ window:', event.data.action, event.data);

      if (event.data.action === 'start') {
        try {
          window.console.log('inject.js: Nhận lệnh start từ popup, tiến hành khởi động bot...');
          startBot(event.data.config || {});
        } catch(e) {
          console.log('Lỗi khởi động bot:', e.message);
          window.console.error('inject.js: Lỗi khởi động bot:', e);
        }
      } else if (event.data.action === 'stop') {
        try {
          window.console.log('inject.js: Nhận lệnh stop từ popup...');
          stopBot();
        } catch(e) {
          console.log('Lỗi dừng bot:', e.message);
          window.console.error('inject.js: Lỗi dừng bot:', e);
        }
      } else if (event.data.action === 'update-config') {
        try {
          window.console.log('inject.js: Nhận lệnh cập nhật cấu hình thời gian thực...');
          setState(event.data.config || {});
        } catch(e) {
          window.console.error('inject.js: Lỗi cập nhật cấu hình:', e);
        }
      } else if (event.data.action === 'status-request') {
        let debugLogs = '[]';
        try {
          debugLogs = safeLocalStorage.getItem('garden_debug_logs') || '[]';
        } catch(e) {}
        
        window.console.log('inject.js: Phản hồi status-response. running =', !!window.autoDiscordBotRunning);
        window.postMessage({
          source: 'auto-discord-extension',
          action: 'status-response',
          requestId: event.data.requestId,
          running: !!window.autoDiscordBotRunning,
          gardenStatus: getGardenStatusText(),
          debugLogs: debugLogs,
          version: 34
        }, '*');
      }
    } catch(e) {
      window.console.error('Error in auto-discord message listener:', e);
    }
  };

  window.addEventListener('message', window.__autoDiscordBotMessageListener);

  window.console.log('inject.js: AutoDiscord bot injector đã sẵn sàng trong MAIN world.');
  console.log('AutoDiscord bot injector đã sẵn sàng.');
})();
