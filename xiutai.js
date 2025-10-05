// File: xiutai.js (ĐÃ CẬP NHẬT: THAY THẾ TOÀN BỘ ALERT() BẰNG HIỂN THỊ TRONG TRANG)

// --- KHAI BÁO BIẾN TRẠNG THÁI VÀ THIẾT LẬP ---
let balance = 1000000; 
const BET_MULTIPLIER = 2; 

let gameState = 'waiting_bet'; // Trạng thái: waiting_bet, shaking, result_hidden, result_show

// Khởi tạo cược TÀI và XỈU riêng biệt để cho phép tăng cược
let currentBets = {
    'tài': 0,
    'xỉu': 0
};

// Biến cho tự động chơi lại
let gameTimer = null;
const AUTO_PLAY_DELAY = 7000; // 7 giây

// Biến lưu lịch sử
let gameHistory = [];
const MAX_HISTORY = 10;

// Các biến cho logic kéo/thả
let isDragging = false;
let cupStartX, cupStartY; 
let cupX, cupY;           

// Biến để quản lý trạng thái hiển thị lỗi (dùng cho timeout)
let errorTimeout = null;


/* ------------------------------------------------------------------
 * HÀM CHUNG VÀ XỬ LÝ LỖI GIAO DIỆN MỚI
 * ------------------------------------------------------------------ */

function updateBalance(amount) {
    balance += amount;
    document.getElementById('current-balance').textContent = balance.toLocaleString('vi-VN'); 
}

function updateDiceImages(d1, d2, d3) {
    document.getElementById('dice-1').src = `dice_${d1}.png`;
    document.getElementById('dice-2').src = `dice_${d2}.png`;
    document.getElementById('dice-3').src = `dice_${d3}.png`;
    document.getElementById('dice-set-container').style.opacity = 1;
}

/**
 * Hiển thị thông báo lỗi trên #game-status và làm rung input tiền cược nếu cần.
 * @param {string} message - Nội dung thông báo lỗi.
 * @param {boolean} highlightInput - Có làm nổi bật input tiền cược không.
 */
function displayError(message, highlightInput = false) {
    const gameStatus = document.getElementById('game-status');
    const betInput = document.getElementById('bet-input');
    
    // Xóa timeout cũ nếu có
    if (errorTimeout) clearTimeout(errorTimeout);

    // Hiển thị lỗi
    // Sử dụng màu đỏ đã định nghĩa trong CSS (var(--accent-red))
    gameStatus.textContent = `⚠️ LỖI: ${message}`;
    gameStatus.style.color = 'var(--accent-red)'; 

    if (highlightInput) {
        betInput.classList.add('input-error-shake');
    }

    // Thiết lập timeout để xóa thông báo lỗi và đưa về trạng thái chờ
    errorTimeout = setTimeout(() => {
        if (gameState === 'waiting_bet') {
             gameStatus.textContent = "Hãy nhập số tiền cược, đặt cược Tài hoặc Xỉu!";
        }
        gameStatus.style.color = 'var(--text-light)'; 
        betInput.classList.remove('input-error-shake');
    }, 4000); 
}


/* ------------------------------------------------------------------
 * HÀM QUẢN LÝ TRẠNG THÁI VÀ CƯỢC
 * ------------------------------------------------------------------ */

function startCountdown(seconds) {
    let timeLeft = seconds;
    const timerDisplay = document.getElementById('timer-message');
    timerDisplay.textContent = `Tự động ván mới sau ${timeLeft}s...`;

    if (gameTimer) clearInterval(gameTimer);

    gameTimer = setInterval(() => {
        timeLeft--;
        timerDisplay.textContent = `Tự động ván mới sau ${timeLeft}s...`;

        if (timeLeft <= 0) {
            clearInterval(gameTimer);
            timerDisplay.textContent = "";
            resetGame();
        }
    }, 1000);
}

function stopCountdown() {
    if (gameTimer) {
        clearInterval(gameTimer);
        gameTimer = null;
    }
    document.getElementById('timer-message').textContent = "";
}

function handleRollButtonClick() {
    if (gameState === 'result_show') {
        stopCountdown();
        resetGame();
    } else {
        rollDice();
    }
}

function resetGame() {
    if (gameState === 'shaking' || gameState === 'result_hidden') return;
    
    currentBets = { 'tài': 0, 'xỉu': 0 };
    gameState = 'waiting_bet';
    
    document.getElementById('bet-tài').textContent = 0;
    document.getElementById('bet-xỉu').textContent = 0;
    document.getElementById('roll-button').textContent = "TUNG XÚC XẮC";
    document.getElementById('roll-button').disabled = false;
    
    const diceCup = document.getElementById('dice-cup');
    diceCup.classList.remove('open', 'shaking', 'is-dragging');
    diceCup.querySelector('.cup-text').textContent = "SẴN SÀNG LẮC";
    diceCup.style.removeProperty('left'); 
    diceCup.style.removeProperty('bottom');
    diceCup.style.transform = 'translateX(-50%)'; 
    
    document.getElementById('dice-set-container').style.opacity = 0; 
    document.getElementById('dice-1').src = `dice_default.png`;
    document.getElementById('dice-2').src = `dice_default.png`;
    document.getElementById('dice-3').src = `dice_default.png`;
    
    document.querySelectorAll('.bet-option').forEach(option => {
        option.classList.remove('active-bet');
    });

    document.getElementById('game-status').textContent = "Hãy nhập số tiền cược, đặt cược Tài hoặc Xỉu!";
    document.getElementById('game-status').style.color = 'var(--text-light)'; // Đặt lại màu
}

function clearBet() {
    if (gameState !== 'waiting_bet') {
        displayError("Không thể hủy cược khi đang lắc hoặc đã úp bát.");
        return;
    }
    
    const totalCurrentBet = currentBets['tài'] + currentBets['xỉu'];

    if (totalCurrentBet > 0) {
        updateBalance(totalCurrentBet);
        resetGame(); 
        document.getElementById('game-status').textContent = "✅ Đã hủy cược. Số tiền được hoàn trả.";
    } else {
         displayError("Chưa có cược nào được đặt.");
    }
}

function placeBet(type) {
    if (gameState !== 'waiting_bet') {
        displayError("Vui lòng hoàn tất ván hiện tại hoặc nhấn VÁN MỚI.");
        return;
    }
    
    const betInput = document.getElementById('bet-input');
    const newAmount = parseInt(betInput.value);

    if (isNaN(newAmount) || newAmount < 10000) { 
        displayError("Số tiền cược tối thiểu là 10,000 VND.", true); 
        return; 
    }
    
    if (balance < newAmount) { 
        displayError(`Số dư không đủ để đặt cược thêm ${newAmount.toLocaleString('vi-VN')} VND.`, true); 
        return; 
    }
    
    // Logic: Tăng cược vào ô đã chọn
    updateBalance(-newAmount); 
    currentBets[type] += newAmount;
    
    // Cập nhật UI
    document.getElementById(`bet-${type}`).textContent = currentBets[type].toLocaleString('vi-VN');
    document.querySelector(`.bet-option.${type}`).classList.add('active-bet');
    
    const totalBet = currentBets['tài'] + currentBets['xỉu'];
    document.getElementById('game-status').textContent = `Đã thêm ${newAmount.toLocaleString('vi-VN')} vào ${type.toUpperCase()}. Tổng cược: ${totalBet.toLocaleString('vi-VN')} VND.`;
    document.getElementById('game-status').style.color = 'var(--text-light)'; // Đặt lại màu
}


/* ------------------------------------------------------------------
 * HÀM TUNG VÀ MỞ BÁT
 * ------------------------------------------------------------------ */

async function rollDice() {
    const totalBet = currentBets['tài'] + currentBets['xỉu'];

    if (gameState !== 'waiting_bet' || totalBet === 0) {
        displayError("Vui lòng đặt cược trước khi tung xúc xắc.");
        return;
    }

    // 1. Bắt đầu lắc
    stopCountdown();
    gameState = 'shaking';
    document.getElementById('roll-button').textContent = "ĐANG LẮC...";
    document.getElementById('roll-button').disabled = true;
    document.getElementById('game-status').textContent = "Đang lắc xúc xắc, chờ kết quả...";
    document.getElementById('game-status').style.color = 'var(--text-light)'; // Đặt lại màu
    
    const diceCup = document.getElementById('dice-cup');
    diceCup.classList.add('shaking');
    diceCup.querySelector('.cup-text').textContent = "LẮC LẮC...";
    
    // Tính toán kết quả
    const d1 = Math.floor(Math.random() * 6) + 1;
    const d2 = Math.floor(Math.random() * 6) + 1;
    const d3 = Math.floor(Math.random() * 6) + 1;
    const sum = d1 + d2 + d3;

    await new Promise(resolve => setTimeout(resolve, 2000)); 
    
    // 2. Ngừng lắc, úp bát, chờ kéo
    diceCup.classList.remove('shaking');
    updateDiceImages(d1, d2, d3); 
    
    processResult(d1, d2, d3, sum); 
    
    gameState = 'result_hidden';
    document.getElementById('roll-button').textContent = "ĐÃ LẮC";
    document.getElementById('game-status').textContent = "KÉO BÁT RA XEM KẾT QUẢ!";
    diceCup.querySelector('.cup-text').textContent = "KÉO LÊN!";
}

async function openCup() {
    if (gameState !== 'result_hidden') return;
    
    const diceCup = document.getElementById('dice-cup');
    diceCup.classList.add('open'); 
    
    document.getElementById('roll-button').textContent = "ĐANG TÍNH...";
    document.getElementById('game-status').textContent = "Xác nhận kết quả và tính toán thưởng/phạt...";
    
    await new Promise(resolve => setTimeout(resolve, 500)); 
    
    const finalMessage = document.getElementById('game-status').getAttribute('data-final-message');
    document.getElementById('game-status').textContent = finalMessage;
    
    gameState = 'result_show';
    document.getElementById('roll-button').textContent = "VÁN MỚI";
    document.getElementById('roll-button').disabled = false;
    
    startCountdown(7); 
}

function processResult(d1, d2, d3, sum) {
    let gameResult = '';
    let isTriple = (d1 === d2 && d2 === d3);
    let message = `Tổng: ${sum} (${d1}-${d2}-${d3}). Kết quả: `;
    let totalWinAmount = 0; 

    if (isTriple) {
        gameResult = "BỘ BA"; 
    } else if (sum >= 11 && sum <= 17) {
        gameResult = "TÀI";
    } else {
        gameResult = "XỈU";
    }

    if (isTriple) {
        message += `BỘ BA ĐỒNG NHẤT! Bạn thua tất cả cược Tài và Xỉu.`;
    } else {
        const winningBetType = gameResult.toLowerCase();
        const losingBetType = winningBetType === 'tài' ? 'xỉu' : 'tài';
        
        const betOnWin = currentBets[winningBetType];
        const betOnLose = currentBets[losingBetType];
        
        totalWinAmount = betOnWin * BET_MULTIPLIER; 
        updateBalance(totalWinAmount); 
        
        if (betOnWin > 0) {
            const profit = betOnWin * (BET_MULTIPLIER - 1);
            message += `${gameResult}! CHÚC MỪNG! Bạn thắng ${totalWinAmount.toLocaleString('vi-VN')} VND (Lãi: ${profit.toLocaleString('vi-VN')} VND).`;
        } else if (betOnLose > 0) {
             message += `${gameResult}! CHIA BUỒN! Bạn đã thua cược ${losingBetType.toUpperCase()}.`;
        } else {
            message = `Tổng: ${sum} (${d1}-${d2}-${d3}). Kết quả: ${gameResult}. (Bạn không đặt cược)`;
        }
    }

    document.getElementById('game-status').setAttribute('data-final-message', message);
    
    addHistoryItem(sum, gameResult);
}


/* ------------------------------------------------------------------
 * HÀM QUẢN LÝ LỊCH SỬ KẾT QUẢ (Giữ nguyên)
 * ------------------------------------------------------------------ */

function addHistoryItem(total, result) {
    gameHistory.unshift({ total, result });
    if (gameHistory.length > MAX_HISTORY) {
        gameHistory.pop();
    }
    renderHistory();
}

function renderHistory() {
    const historyList = document.getElementById('history-list');
    historyList.innerHTML = '';
    
    gameHistory.forEach(item => {
        const itemDiv = document.createElement('div');
        let resultClass = item.result.toLowerCase().replace(' ', '_');
        if (item.result === "BỘ BA") resultClass = 'bộ_ba';

        itemDiv.className = 'history-item';
        itemDiv.innerHTML = `
            <span class="history-total">Tổng: ${item.total}</span>
            <span class="history-result ${resultClass}">${item.result}</span>
        `;
        historyList.appendChild(itemDiv);
    });
}


/* ------------------------------------------------------------------
 * LOGIC KÉO/THẢ BÁT (Giữ nguyên)
 * ------------------------------------------------------------------ */

function getCupPosition() {
    const diceCup = document.getElementById('dice-cup');
    cupY = parseFloat(diceCup.style.bottom || '0'); 
}
function handleStart(clientX, clientY) { 
    if (gameState !== 'result_hidden') return;
    
    isDragging = true;
    document.getElementById('dice-cup').classList.add('is-dragging');
    cupStartX = clientX;
    cupStartY = clientY;
    getCupPosition();
}
function handleMove(clientX, clientY) { 
    if (!isDragging) return;
    
    const diceCup = document.getElementById('dice-cup');
    const deltaX = clientX - cupStartX;
    const deltaY = clientY - cupStartY;
    
    diceCup.style.left = `calc(50% + ${deltaX}px)`; 
    const newBottom = Math.max(0, cupY - deltaY); 
    diceCup.style.bottom = `${newBottom}px`;
    diceCup.style.transform = 'translate(0)';

    if (deltaY > 100) {
        isDragging = false;
        diceCup.classList.remove('is-dragging');
        openCup();
    }
}
function handleEnd() { 
    if (!isDragging) return;
    
    const diceCup = document.getElementById('dice-cup');
    isDragging = false;
    diceCup.classList.remove('is-dragging');
    
    diceCup.style.removeProperty('left'); 
    diceCup.style.removeProperty('bottom');
    diceCup.style.transform = 'translateX(-50%)'; 
}

// Xử lý sự kiện kéo/thả của chuột
function dragStart(event) { event.preventDefault(); handleStart(event.clientX, event.clientY); }
document.addEventListener('mousemove', (event) => handleMove(event.clientX, event.clientY));
document.addEventListener('mouseup', handleEnd);

// Xử lý sự kiện chạm của di động
function touchStart(event) { handleStart(event.touches[0].clientX, event.touches[0].clientY); }
document.addEventListener('touchmove', (event) => {
    if (isDragging) {
        event.preventDefault();
        handleMove(event.touches[0].clientX, event.touches[0].clientY);
    }
}, { passive: false }); 
document.addEventListener('touchend', handleEnd);


/* ------------------------------------------------------------------
 * HÀM MODAL NẠP TIỀN VÀ KHỞI TẠO
 * ------------------------------------------------------------------ */

function openDepositModal() { document.getElementById('deposit-modal').style.display = 'flex'; }
function closeDepositModal() { document.getElementById('deposit-modal').style.display = 'none'; }

function processDeposit() {
    const amountInput = document.getElementById('deposit-amount');
    const amount = parseInt(amountInput.value);
    
    if (amount && amount >= 1000) {
        // Thông báo nạp tiền thành công trực tiếp
        console.log(`✅ Nạp tiền thành công: ${amount.toLocaleString('vi-VN')} VND.`);
        updateBalance(amount); 
        amountInput.value = ''; 
        closeDepositModal();
    } else { 
        // Hiển thị lỗi nạp tiền (thay thế alert trong modal bằng hiển thị trực tiếp)
        document.getElementById('deposit-amount').placeholder = "❌ Số tiền không hợp lệ (>= 1,000)";
        document.getElementById('deposit-amount').classList.add('input-error-shake');
        setTimeout(() => {
            document.getElementById('deposit-amount').placeholder = "Nhập số tiền...";
            document.getElementById('deposit-amount').classList.remove('input-error-shake');
        }, 3000);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    updateBalance(0);
    resetGame();
    renderHistory();
});