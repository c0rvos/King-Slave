const socket = io();

// ── State ──────────────────────────────────────────
let currentGameId   = null;
let currentPlayerId = null;
let myHand          = [];
let myHistory       = [];
let waitingPlay     = false;
let currentRound    = 1;
let currentTurn     = 0;
const maxTurns      = 5;

// ── Screen refs ────────────────────────────────────
const screens = {
    login:       document.getElementById('loginScreen'),
    lobby:       document.getElementById('lobbyScreen'),
    createLobby: document.getElementById('createLobbyScreen'),
    joinLobby:   document.getElementById('joinLobbyScreen'),
    dice:        document.getElementById('diceScreen'),
    game:        document.getElementById('gameScreen'),
    gameOver:    document.getElementById('gameOverScreen'),
};

// ── DOM refs ───────────────────────────────────────
const $  = id => document.getElementById(id);
const playerNameInput = $('playerNameInput');
const joinLobbyBtn    = $('joinLobbyBtn');
const lobbyPlayerName = $('lobbyPlayerName');
const findMatchBtn    = $('findMatchBtn');
const cancelMatchBtn  = $('cancelMatchBtn');
const waitingStatus   = $('waitingStatus');
const createLobbyBtn  = $('createLobbyBtn');
const joinPrivateBtn  = $('joinPrivateBtn');
const cancelLobbyBtn  = $('cancelLobbyBtn');
const copyCodeBtn     = $('copyCodeBtn');
const copyLabel       = $('copyLabel');
const roomCodeLetters = $('roomCodeLetters');
const joinCodeBtn     = $('joinCodeBtn');
const backFromJoinBtn = $('backFromJoinBtn');
const joinLobbyError  = $('joinLobbyError');
const codeInputs      = [1,2,3,4].map(i => $(`codeInput${i}`));
const lobbyIcon       = $('lobbyIcon');

const yourDiceRoll      = $('yourDiceRoll');
const opponentDiceRoll  = $('opponentDiceRoll');
const yourDiceName      = $('yourDiceName');
const opponentDiceName  = $('opponentDiceName');
const diceResult        = $('diceResult');

const roundDisplay     = $('roundDisplay');
const turnDisplay      = $('turnDisplay');
const yourName         = $('yourName');
const opponentName     = $('opponentName');
const yourRole         = $('yourRole');
const opponentRole     = $('opponentRole');
const yourScore        = $('yourScore');
const opponentScore    = $('opponentScore');
const resultBanner     = $('roundResult');

const yourPlayedZone   = $('yourPlayedZone');
const opponentFlipCard = $('opponentFlipCard');
const opponentPlay     = $('opponentPlay');
const oppPlayStatus    = $('oppPlayStatus');
const opponentCardsLeft= $('opponentCardsLeft');

const yourHand         = $('yourHand');
const yourHistory      = $('yourHistory');
const gameMsg          = $('gameMessage');
const yourEmote        = $('yourEmote');
const opponentEmote    = $('opponentEmote');

const gameOverCrown    = $('gameOverCrown');
const gameOverTitle    = $('gameOverTitle');
const gameOverMessage  = $('gameOverMessage');
const finalScores      = $('finalScores');
const playAgainBtn     = $('playAgainBtn');
const backToLobbyBtn   = $('backToLobbyBtn');

// Chat refs
const chatSidebar = $('chatSidebar');
const chatToggleBtn = $('chatToggle');
const chatMessages = $('chatMessages');
const chatInput = $('chatInput');
const chatSendBtn = $('chatSendBtn');

let myPlayerName = '';

// ── Helpers ────────────────────────────────────────
function showScreen(name) {
    Object.values(screens).forEach(s => s.classList.remove('active'));
    screens[name].classList.add('active');
    
    // Auto-show/hide sidebar
    if (name === 'game') chatSidebar.classList.remove('collapsed');
    else chatSidebar.classList.add('collapsed');
}

function setMsg(text, type = '') {
    gameMsg.textContent = text;
    gameMsg.className   = `game-msg ${type}`;
}

function cardEmoji(type) {
    return type === 'king' ? '♔' : type === 'slave' ? '⛓' : '☠';
}

function getCardHTML(card) {
    return `<div class="card ${card.type}">
        <div class="card-illustration"></div>
    </div>`;
}

// ══════════════════════════════════════════════════
//  LOGIN & LOBBY
// ══════════════════════════════════════════════════
joinLobbyBtn.onclick = () => {
    const name = playerNameInput.value.trim();
    if (!name) { playerNameInput.focus(); return; }
    myPlayerName = name;
    socket.emit('joinLobby', { playerName: myPlayerName });
};
playerNameInput.addEventListener('keydown', e => { if (e.key === 'Enter') joinLobbyBtn.click(); });

socket.on('lobbyJoined', data => {
    lobbyPlayerName.textContent = data.playerName;
    showScreen('lobby');
    resetLobbyUI();
});

findMatchBtn.onclick = () => {
    findMatchBtn.style.display   = 'none';
    cancelMatchBtn.classList.remove('hidden');
    waitingStatus.textContent = 'Searching for a condemned soul...';
    waitingStatus.classList.remove('hidden');
    socket.emit('findMatch');
};
cancelMatchBtn.onclick = () => { socket.emit('cancelMatchmaking'); resetLobbyUI(); };
socket.on('waiting', msg => { waitingStatus.textContent = msg; });
socket.on('matchmakingCancelled', () => resetLobbyUI());

// Create Lobby
createLobbyBtn.onclick = () => { socket.emit('createLobby'); };
socket.on('lobbyCreated', ({ code }) => {
    const letters = roomCodeLetters.querySelectorAll('span');
    code.split('').forEach((ch, i) => { if (letters[i]) letters[i].textContent = ch; });
    showScreen('createLobby');
});
cancelLobbyBtn.onclick = () => { socket.emit('cancelLobby'); showScreen('lobby'); resetLobbyUI(); };
socket.on('lobbyCancelled', () => { showScreen('lobby'); resetLobbyUI(); });

copyCodeBtn.onclick = () => {
    const code = [...roomCodeLetters.querySelectorAll('span')].map(s => s.textContent).join('');
    navigator.clipboard.writeText(code).then(() => {
        copyLabel.textContent = 'Copied!';
        setTimeout(() => copyLabel.textContent = 'Copy', 2000);
    });
};

// Join Private
joinPrivateBtn.onclick = () => {
    codeInputs.forEach(inp => inp.value = '');
    joinLobbyError.classList.add('hidden');
    showScreen('joinLobby');
    codeInputs[0].focus();
};
codeInputs.forEach((inp, idx) => {
    inp.addEventListener('input', () => {
        inp.value = inp.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
        if (inp.value && idx < 3) codeInputs[idx + 1].focus();
        if (inp.value && idx === 3) joinCodeBtn.click();
    });
    inp.addEventListener('keydown', e => {
        if (e.key === 'Backspace' && !inp.value && idx > 0) codeInputs[idx - 1].focus();
        if (e.key === 'ArrowLeft'  && idx > 0) codeInputs[idx - 1].focus();
        if (e.key === 'ArrowRight' && idx < 3) codeInputs[idx + 1].focus();
    });
});
joinCodeBtn.onclick = () => {
    const code = codeInputs.map(i => i.value).join('');
    if (code.length < 4) { showJoinError('Complete the code.'); return; }
    joinLobbyError.classList.add('hidden');
    socket.emit('joinLobbyCode', { code });
};
socket.on('lobbyJoinError', msg => { showJoinError(msg); });
function showJoinError(msg) { joinLobbyError.textContent = msg; joinLobbyError.classList.remove('hidden'); }
backFromJoinBtn.onclick = () => { showScreen('lobby'); resetLobbyUI(); };

// ══════════════════════════════════════════════════
//  GAME START & INIT
// ══════════════════════════════════════════════════
socket.on('gameStart', data => {
    currentGameId   = data.gameId;
    currentPlayerId = data.playerId;
    currentRound    = data.currentRound;

    yourName.textContent     = data.playerName;
    opponentName.textContent = data.opponentName;
    yourDiceName.textContent     = data.playerName;
    opponentDiceName.textContent = data.opponentName;

    yourDiceRoll.textContent     = data.diceResult.yourRoll;
    opponentDiceRoll.textContent = data.diceResult.opponentRoll;
    diceResult.textContent = `${data.diceResult.winner} takes the throne.`;

    chatMessages.innerHTML = ''; // clear chat

    // Save session for reconnection
    localStorage.setItem('kingSlave_session', JSON.stringify({ gameId: data.gameId, playerName: myPlayerName }));

    showScreen('dice');
    setTimeout(() => initGame(data), 3200);
});

function initGame(data) {
    myHand      = data.hand;
    myHistory   = [];
    waitingPlay = false;
    currentTurn = 0;
    currentRound = data.currentRound;

    setRole(data.currentRole);
    updateHand();
    updateScores(0, 0);
    updateHud();
    resultBanner.textContent = `Round ${currentRound} — Survive.`;
    yourHistory.textContent  = '—';
    
    // Reset battle zone
    yourPlayedZone.innerHTML = '<div class="card-unknown">—</div>';
    opponentFlipCard.classList.remove('flipped');
    opponentPlay.innerHTML = '';
    oppPlayStatus.textContent = 'waiting...';
    oppPlayStatus.classList.remove('played');
    
    opponentCardsLeft.textContent = data.currentRole === 'king' ? '5' : '4';
    setMsg('Play a card.', '');

    showScreen('game');
}

function setRole(role) {
    const isKing = role === 'king';
    yourRole.textContent    = isKing ? '♔ KING' : '⛓ SLAVE';
    yourRole.className      = `prole ${isKing ? 'king' : 'slave'}`;
    opponentRole.textContent = isKing ? '⛓ SLAVE' : '♔ KING';
    opponentRole.className   = `prole ${isKing ? 'slave' : 'king'}`;
}

function updateHud() {
    roundDisplay.textContent = `Round ${currentRound} / 10`;
    turnDisplay.textContent  = `Turn ${currentTurn + 1}`;
}

function updateScores(yours, theirs) {
    yourScore.textContent    = yours;
    opponentScore.textContent = theirs;
}

function updateHand() {
    yourHand.innerHTML = '';
    if (!myHand || myHand.length === 0) return;
    myHand.forEach((card, idx) => {
        const div = document.createElement('div');
        div.className = `card ${card.type}`;
        div.innerHTML = `<div class="card-illustration"></div>`;
        div.title = card.name; // tooltip on hover for accessibility
        div.onclick = () => playCard(idx, card);
        yourHand.appendChild(div);
    });
}

function disableCards(off) {
    document.querySelectorAll('.hand-area .card').forEach(c =>
        off ? c.classList.add('disabled') : c.classList.remove('disabled')
    );
}

// ══════════════════════════════════════════════════
//  CARD PLAY & ANIMATIONS
// ══════════════════════════════════════════════════
function playCard(idx, card) {
    if (waitingPlay) return;
    socket.emit('playCard', { gameId: currentGameId, cardIndex: idx });
    waitingPlay = true;
    disableCards(true);
    
    // Move card to your battle slot visually
    yourPlayedZone.innerHTML = getCardHTML(card);
    setMsg('Waiting for opponent...', '');
}

socket.on('playRecorded', data => { /* handled locally */ });

socket.on('opponentCardPlayed', () => {
    // Show back face in opponent slot
    opponentFlipCard.classList.remove('flipped');
    oppPlayStatus.textContent = 'Card played ✔';
    oppPlayStatus.classList.add('played');
});

socket.on('roundComplete', data => {
    myHand      = data.yourHand;
    myHistory   = data.yourHistory || myHistory;
    currentTurn = data.currentTurn;

    updateHand();
    updateScores(data.yourScore, data.opponentScore);
    updateHud();
    resultBanner.textContent = data.roundResult;

    // Show opponent's card (Flip)
    if (data.opponentPlay) {
        opponentPlay.innerHTML = getCardHTML(data.opponentPlay);
        void opponentFlipCard.offsetWidth; // reflow
        opponentFlipCard.classList.add('flipped');
    }
    
    oppPlayStatus.textContent = 'waiting...';
    oppPlayStatus.classList.remove('played');
    opponentCardsLeft.textContent = data.opponentCardsLeft;

    if (myHistory.length > 0) {
        yourHistory.textContent = myHistory.map(c => cardEmoji(c.type)).join(' ');
    }

    waitingPlay = false;
    disableCards(false);
    setMsg('', '');

    if (data.gameOver) {
        setTimeout(() => showGameOver(data), 2500);
    }
});

socket.on('nextRound', data => {
    myHand       = data.newHand;
    myHistory    = [];
    currentRound = data.newRound;
    currentTurn  = 0;

    setRole(data.newRole);
    updateHand();
    updateHud();
    
    yourPlayedZone.innerHTML = '<div class="card-unknown">—</div>';
    opponentFlipCard.classList.remove('flipped');
    opponentPlay.innerHTML = '';
    oppPlayStatus.textContent = 'waiting...';
    oppPlayStatus.classList.remove('played');
    
    resultBanner.textContent = `Round ${currentRound} — Roles swapped!`;
    yourHistory.textContent  = '—';
    opponentCardsLeft.textContent = data.newRole === 'king' ? '5' : '4';
    waitingPlay = false;
    disableCards(false);
});

// ══════════════════════════════════════════════════
//  CHAT & EMOTES
// ══════════════════════════════════════════════════
chatToggleBtn.onclick = () => chatSidebar.classList.toggle('collapsed');

chatSendBtn.onclick = sendChat;
chatInput.onkeydown = e => { if (e.key === 'Enter') sendChat(); };

function sendChat() {
    const text = chatInput.value.trim();
    if (!text || !currentGameId) return;
    socket.emit('chatMessage', { gameId: currentGameId, text });
    chatInput.value = '';
}

socket.on('chatMessage', data => {
    const isMe = data.senderName === myPlayerName;
    const div = document.createElement('div');
    div.className = `chat-msg ${isMe ? 'mine' : ''}`;
    div.innerHTML = `<div class="chat-msg-header"><span class="chat-msg-name">${data.senderName}</span></div>${data.text}`;
    chatMessages.appendChild(div);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    
    if (chatSidebar.classList.contains('collapsed')) {
        chatToggleBtn.style.color = '#f00';
        setTimeout(() => chatToggleBtn.style.color = '', 500);
    }
});

document.querySelectorAll('.emote-btn').forEach(btn => {
    btn.onclick = () => {
        if (!currentGameId) return;
        const emote = btn.getAttribute('data-emote');
        socket.emit('sendEmote', { gameId: currentGameId, emote });
        showEmote(yourEmote, emote);
    };
});
socket.on('receiveEmote', ({ emote }) => showEmote(opponentEmote, emote));

function showEmote(el, text) {
    if (!el) return;
    el.textContent = text;
    el.classList.remove('show');
    void el.offsetWidth;
    el.classList.add('show');
}

// ══════════════════════════════════════════════════
//  GAME OVER & MISC
// ══════════════════════════════════════════════════
function showGameOver(data) {
    const iWin = (data.winner === 'player1' && currentPlayerId === 'player1') ||
                 (data.winner === 'player2' && currentPlayerId === 'player2');
    
    if (data.winner === 'tie') {
        gameOverCrown.textContent = '⚖';
        gameOverTitle.textContent = 'Draw';
        gameOverMessage.textContent = 'Nobody leaves the arena.';
    } else if (iWin) {
        gameOverCrown.textContent = '♔';
        gameOverTitle.textContent = 'Victory';
        gameOverMessage.textContent = 'You survived. The other did not.';
    } else {
        gameOverCrown.textContent = '☠';
        gameOverTitle.textContent = 'Defeat';
        gameOverMessage.textContent = 'You have been condemned.';
    }
    finalScores.innerHTML = `${data.yourScore} - ${data.opponentScore}`;
    showScreen('gameOver');
}

socket.on('error', msg => setMsg(`Error: ${msg}`, 'warn'));

socket.on('waitingForReconnect', msg => {
    setMsg(msg, 'warn');
    disableCards(true);
});

socket.on('opponentReconnected', msg => {
    setMsg(msg, 'info');
    disableCards(false);
});

socket.on('opponentDisconnected', msg => {
    setMsg(`⚠ ${msg}`, 'warn');
    disableCards(true);
    localStorage.removeItem('kingSlave_session');
    setTimeout(() => { showScreen('lobby'); resetLobbyUI(); }, 3000);
});

$('leaveGameBtn').onclick = () => {
    if (confirm('Are you sure you want to leave the arena? You will lose the game.')) {
        socket.emit('leaveGame', { gameId: currentGameId });
        localStorage.removeItem('kingSlave_session');
        showScreen('lobby');
        resetLobbyUI();
    }
};

// Check for existing session on load
window.addEventListener('load', () => {
    const session = localStorage.getItem('kingSlave_session');
    if (session) {
        const { gameId, playerName } = JSON.parse(session);
        myPlayerName = playerName;
        socket.emit('reconnectToGame', { gameId, playerName });
    }
});

playAgainBtn.onclick = () => { showScreen('lobby'); resetLobbyUI(); };
backToLobbyBtn.onclick = () => { showScreen('lobby'); resetLobbyUI(); };
lobbyIcon.onclick = () => {
    const active = Object.entries(screens).find(([, el]) => el.classList.contains('active'));
    if (!active || active[0] === 'login' || active[0] === 'lobby') return;
    if (confirm('Flee the arena? You will forfeit.')) {
        showScreen('lobby');
        resetLobbyUI();
    }
};

function resetLobbyUI() {
    findMatchBtn.style.display = '';
    cancelMatchBtn.classList.add('hidden');
    waitingStatus.classList.add('hidden');
    currentGameId   = null;
    waitingPlay     = false;
    joinLobbyError.classList.add('hidden');
}
