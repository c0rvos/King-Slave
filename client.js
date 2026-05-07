const socket = io();

// ── State ──────────────────────────────────────────
let currentGameId   = null;
let currentPlayerId = null;
let myHand          = [];
let myHistory       = [];
let waitingPlay     = false;
let currentRound    = 1;
let currentTurn     = 0;
let myPlayerName    = '';
let diceRolled      = false;

// ── Screen refs ────────────────────────────────────
const screens = {
    login:       document.getElementById('loginScreen'),
    lobby:       document.getElementById('lobbyScreen'),
    createLobby: document.getElementById('createLobbyScreen'),
    joinLobby:   document.getElementById('joinLobbyScreen'),
    dice:        document.getElementById('diceScreen'),
    roleChoice:  document.getElementById('roleChoiceScreen'),
    game:        document.getElementById('gameScreen'),
    gameOver:    document.getElementById('gameOverScreen'),
};

const $ = id => document.getElementById(id);

// ── DOM refs ───────────────────────────────────────
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

const gameOverCrown    = $('gameOverCrown');
const gameOverTitle    = $('gameOverTitle');
const gameOverMessage  = $('gameOverMessage');
const finalScores      = $('finalScores');
const playAgainBtn     = $('playAgainBtn');
const backToLobbyBtn   = $('backToLobbyBtn');

const chatSidebar   = $('chatSidebar');
const chatMessages  = $('chatMessages');
const chatInput     = $('chatInput');
const chatSendBtn   = $('chatSendBtn');

const leaveBtn    = $('leaveGameBtn');
const topIcons    = document.querySelector('.game-top-icons');
const chatNotif   = $('chatNotifDot');

// ── Helpers ───────────────────────────────────────
function showScreen(name) {
    Object.values(screens).forEach(s => s && s.classList.remove('active'));
    if (screens[name]) screens[name].classList.add('active');
    const inGame = name === 'game';
    if (chatSidebar) chatSidebar.classList.add('collapsed');
    if (topIcons) topIcons.style.display = inGame ? 'flex' : 'none';
}

function setMsg(text, type = '') {
    if (!gameMsg) return;
    gameMsg.textContent = text;
    gameMsg.className   = `game-msg ${type}`;
}

function cardEmoji(type) {
    return type === 'king' ? '♔' : type === 'slave' ? '⛓' : '☠';
}

function getCardHTML(card) {
    const imgMap = { king: 'assets/king.jpg', slave: 'assets/slave.jpg', citizen: 'assets/citizen.jpg' };
    return `<div class="card ${card.type}"><div class="card-illustration"><img src="${imgMap[card.type]||''}" alt="${card.type}"></div></div>`;
}

function fitName(el, name) {
    if (!el) return;
    el.textContent = name;
    el.style.fontSize = name.length > 12 ? '0.7rem' : name.length > 8 ? '0.85rem' : '';
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
    findMatchBtn.style.display = 'none';
    cancelMatchBtn.classList.remove('hidden');
    waitingStatus.textContent = 'Searching for a condemned soul...';
    waitingStatus.classList.remove('hidden');
    socket.emit('findMatch');
};
cancelMatchBtn.onclick = () => { socket.emit('cancelMatchmaking'); resetLobbyUI(); };
socket.on('waiting', msg => { waitingStatus.textContent = msg; });
socket.on('matchmakingCancelled', () => resetLobbyUI());

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
//  DICE ROLL — 3D white dice
// ══════════════════════════════════════════════════
let pendingGameData = null;

socket.on('gameStart', data => {
    currentGameId   = data.gameId;
    currentPlayerId = data.playerId;
    currentRound    = data.currentRound;
    pendingGameData = data;

    fitName($('yourDiceName'), data.playerName);
    fitName($('opponentDiceName'), data.opponentName);
    fitName(yourName, data.playerName);
    fitName(opponentName, data.opponentName);

    chatMessages.innerHTML = '';
    sessionStorage.setItem('kingSlave_session', JSON.stringify({ gameId: data.gameId, playerName: myPlayerName }));

    // Animate 3D dice
    showScreen('dice');
    diceRolled = false;
    const rollBtn = $('diceRollBtn');
    if (rollBtn) {
        rollBtn.classList.remove('hidden');
        rollBtn.onclick = () => {
            if (diceRolled) return;
            diceRolled = true;
            rollBtn.disabled = true;
            rollBtn.classList.add('hidden');
            animateDice($('yourDice3d'), data.diceResult.yourRoll, () => {
                animateDice($('oppDice3d'), data.diceResult.opponentRoll, () => {
                    const res = $('diceResult');
                    if (res) {
                        res.textContent = `${data.diceResult.winner} takes the throne.`;
                        res.classList.add('show');
                    }
                    setTimeout(() => showRoleChoice(data), 1800);
                });
            });
        };
    }
});

function animateDice(el, finalFace, cb) {
    if (!el) { cb && cb(); return; }
    el.classList.add('rolling');
    let count = 0;
    const faces = [1,2,3,4,5,6];
    const interval = setInterval(() => {
        const fake = faces[Math.floor(Math.random()*6)];
        setDiceFace(el, fake);
        count++;
        if (count > 14) {
            clearInterval(interval);
            el.classList.remove('rolling');
            setDiceFace(el, finalFace);
            el.classList.add('landed');
            setTimeout(() => { cb && cb(); }, 400);
        }
    }, 80);
}

function setDiceFace(el, n) {
    if (!el) return;
    el.setAttribute('data-face', n);
    const dot = el.querySelector('.dice-number');
    if (dot) dot.textContent = n;
}

// ══════════════════════════════════════════════════
//  ROLE CHOICE — show King/Slave cards after dice
// ══════════════════════════════════════════════════
function showRoleChoice(data) {
    showScreen('roleChoice');
    const kingCard  = $('choiceKingCard');
    const slaveCard = $('choiceSlaveCard');
    const choiceMsg = $('choiceMessage');
    const choiceLabel = $('choiceLabel');

    const iAmKing = data.currentRole === 'king';
    if (choiceMsg) choiceMsg.textContent = iAmKing
        ? 'The dice declared you KING'
        : 'The dice condemned you as SLAVE';
    if (choiceLabel) choiceLabel.textContent = 'Your role this round:';

    // highlight the assigned card
    if (kingCard)  kingCard.classList.toggle('role-chosen', iAmKing);
    if (slaveCard) slaveCard.classList.toggle('role-chosen', !iAmKing);

    const cont = $('continueToGameBtn');
    if (cont) {
        cont.classList.remove('hidden');
        cont.onclick = () => { initGame(data); };
    }
}

// ══════════════════════════════════════════════════
//  GAME INIT
// ══════════════════════════════════════════════════
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
    resultBanner.textContent = 'Play a card.';
    yourHistory.textContent  = '—';

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
    yourRole.textContent     = isKing ? '♔ KING' : '⛓ SLAVE';
    yourRole.className       = `prole ${isKing ? 'king' : 'slave'}`;
    opponentRole.textContent = isKing ? '⛓ SLAVE' : '♔ KING';
    opponentRole.className   = `prole ${isKing ? 'slave' : 'king'}`;
}

function updateHud() {
    roundDisplay.textContent = `Round ${currentRound}`;
    turnDisplay.textContent  = `Turn ${currentTurn + 1}`;
}

function updateScores(yours, theirs) {
    animateScore(yourScore, yours);
    animateScore(opponentScore, theirs);
}

function animateScore(el, val) {
    if (!el) return;
    el.classList.add('score-pop');
    el.textContent = val;
    setTimeout(() => el.classList.remove('score-pop'), 400);
}

function updateHand() {
    yourHand.innerHTML = '';
    if (!myHand || !myHand.length) return;
    myHand.forEach((card, idx) => {
        const div = document.createElement('div');
        div.className = `card ${card.type}`;
        const imgMap = { king: 'assets/king.jpg', slave: 'assets/slave.jpg', citizen: 'assets/citizen.jpg' };
        div.innerHTML = `<div class="card-illustration"><img src="${imgMap[card.type]||''}" alt="${card.type}"></div>`;
        div.title = card.name;
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

    yourPlayedZone.innerHTML = getCardHTML(card);
    const playedCard = yourPlayedZone.querySelector('.card');
    if (playedCard) {
        playedCard.classList.add('card-play-anim');
        // King — flash red ring (round-ending card)
        if (card.type === 'king') {
            playedCard.classList.add('card-round-ender');
            showCardFlash('♔ KING PLAYED — ROUND ENDS!', 'king');
        }
    }
    setMsg('Waiting for opponent...', '');
}

function showCardFlash(text, type) {
    let flash = $('cardFlash');
    if (!flash) {
        flash = document.createElement('div');
        flash.id = 'cardFlash';
        flash.className = 'card-flash';
        document.body.appendChild(flash);
    }
    flash.textContent = text;
    flash.className = `card-flash show ${type}`;
    setTimeout(() => flash.className = 'card-flash', 2200);
}

socket.on('opponentCardPlayed', () => {
    opponentFlipCard.classList.remove('flipped');
    oppPlayStatus.textContent = 'Card played ✔';
    oppPlayStatus.classList.add('played');
});

socket.on('roundComplete', data => {
    myHand      = data.yourHand;
    myHistory   = data.yourHistory || myHistory;
    currentTurn = data.currentTurn;

    // Show opponent card with flip
    if (data.opponentPlay) {
        opponentPlay.innerHTML = getCardHTML(data.opponentPlay);
        void opponentFlipCard.offsetWidth;
        opponentFlipCard.classList.add('flipped');
    }

    // Brief delay then show result
    setTimeout(() => {
        updateHand();
        updateScores(data.yourScore, data.opponentScore);
        updateHud();
        resultBanner.textContent = data.roundResult;
        resultBanner.className   = 'result-banner show';

        oppPlayStatus.textContent = 'waiting...';
        oppPlayStatus.classList.remove('played');
        opponentCardsLeft.textContent = data.opponentCardsLeft;

        if (myHistory.length > 0) {
            yourHistory.textContent = myHistory.map(c => cardEmoji(c.type)).join(' ');
        }

        // Clear battle zone after 1.5s
        setTimeout(() => {
            yourPlayedZone.innerHTML = '<div class="card-unknown">—</div>';
            opponentFlipCard.classList.remove('flipped');
            opponentPlay.innerHTML = '';
            waitingPlay = false;
            disableCards(false);
            setMsg('Play a card.', '');
            resultBanner.className = 'result-banner';
        }, 1500);

        if (data.gameOver) {
            setTimeout(() => showGameOver(data), 3000);
        }
    }, 600);
});

socket.on('nextRound', data => {
    myHand       = data.newHand;
    myHistory    = [];
    currentRound = data.newRound;
    currentTurn  = 0;

    setRole(data.newRole);

    // Role swap flash
    showCardFlash(`⚔ ROUND ${currentRound} — ROLES SWAPPED!`, 'citizen');

    setTimeout(() => {
        updateHand();
        updateHud();
        yourPlayedZone.innerHTML = '<div class="card-unknown">—</div>';
        opponentFlipCard.classList.remove('flipped');
        opponentPlay.innerHTML = '';
        oppPlayStatus.textContent = 'waiting...';
        oppPlayStatus.classList.remove('played');
        yourHistory.textContent  = '—';
        opponentCardsLeft.textContent = data.newRole === 'king' ? '5' : '4';
        waitingPlay = false;
        disableCards(false);
        setMsg('Play a card.', '');
    }, 1200);
});

// ══════════════════════════════════════════════════
//  CHAT
// ══════════════════════════════════════════════════
const chatIconBtn = $('chatIconBtn');
const chatToggle  = $('chatToggle');

function openChat() {
    chatSidebar.classList.remove('collapsed');
    if (chatNotif) chatNotif.classList.add('hidden');
    setTimeout(() => chatInput && chatInput.focus(), 100);
}
function closeChat() { chatSidebar.classList.add('collapsed'); }

if (chatIconBtn) chatIconBtn.onclick = () => {
    chatSidebar.classList.contains('collapsed') ? openChat() : closeChat();
};
if (chatToggle) chatToggle.onclick = closeChat;

chatSendBtn.onclick = sendChat;
chatInput.onkeydown = e => { if (e.key === 'Enter') sendChat(); };

function appendChatMsg(senderName, text, isMe) {
    const div = document.createElement('div');
    div.className = `chat-msg ${isMe ? 'mine' : ''}`;
    div.innerHTML = `<div class="chat-msg-header"><span class="chat-msg-name">${senderName}</span></div><div class="chat-msg-text">${text}</div>`;
    chatMessages.appendChild(div);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function sendChat() {
    const text = chatInput.value.trim();
    if (!text || !currentGameId) return;
    socket.emit('chatMessage', { gameId: currentGameId, text });
    appendChatMsg(myPlayerName, text, true);
    chatInput.value = '';
}

socket.on('chatMessage', data => {
    if (data.senderName === myPlayerName) return; // already appended locally
    appendChatMsg(data.senderName, data.text, false);
    if (chatSidebar.classList.contains('collapsed') && chatNotif) {
        chatNotif.classList.remove('hidden');
    }
});

// ══════════════════════════════════════════════════
//  EMOTES
// ══════════════════════════════════════════════════
document.querySelectorAll('.emote-btn').forEach(btn => {
    btn.onclick = () => {
        if (!currentGameId) return;
        const emote = btn.textContent.trim();
        socket.emit('sendEmote', { gameId: currentGameId, emote });
        showEmote($('yourEmote'), emote);
    };
});

socket.on('receiveEmote', ({ emote }) => {
    showEmote($('opponentEmote'), emote);
});

function showEmote(el, text) {
    if (!el) return;
    el.textContent = text;
    el.classList.remove('show');
    void el.offsetWidth;
    el.classList.add('show');
    if (el.emoteTimer) clearTimeout(el.emoteTimer);
    el.emoteTimer = setTimeout(() => el.classList.remove('show'), 3000);
}

// ══════════════════════════════════════════════════
//  GAME OVER — animated victory/defeat screen
// ══════════════════════════════════════════════════
function showGameOver(data) {
    const iWin = (data.winner === 'player1' && currentPlayerId === 'player1') ||
                 (data.winner === 'player2' && currentPlayerId === 'player2');

    const wonOverlay = $('wonOverlay');
    if (wonOverlay) {
        wonOverlay.className = iWin ? 'won-overlay victory show' : 'won-overlay defeat show';
        $('wonText').textContent      = data.winner === 'tie' ? 'DRAW' : iWin ? 'YOU WIN!' : 'DEFEAT';
        $('wonSubText').textContent   = data.winner === 'tie' ? 'Nobody escapes.' : iWin ? 'The arena bows.' : 'You have been condemned.';
        $('wonScore').textContent     = `${data.yourScore} — ${data.opponentScore}`;
        setTimeout(() => {
            wonOverlay.classList.remove('show');
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
            finalScores.innerHTML = `${data.yourScore} — ${data.opponentScore}`;
            showScreen('gameOver');
        }, 3500);
        return;
    }

    if (data.winner === 'tie') {
        gameOverCrown.textContent = '⚖'; gameOverTitle.textContent = 'Draw';
        gameOverMessage.textContent = 'Nobody leaves the arena.';
    } else if (iWin) {
        gameOverCrown.textContent = '♔'; gameOverTitle.textContent = 'Victory';
        gameOverMessage.textContent = 'You survived. The other did not.';
    } else {
        gameOverCrown.textContent = '☠'; gameOverTitle.textContent = 'Defeat';
        gameOverMessage.textContent = 'You have been condemned.';
    }
    finalScores.innerHTML = `${data.yourScore} — ${data.opponentScore}`;
    showScreen('gameOver');
}

// ══════════════════════════════════════════════════
//  RECONNECT / ERRORS
// ══════════════════════════════════════════════════
socket.on('error', msg => setMsg(`Error: ${msg}`, 'warn'));
socket.on('waitingForReconnect', msg => { setMsg(msg, 'warn'); disableCards(true); });
socket.on('opponentReconnected', msg => { setMsg(msg, 'info'); disableCards(false); });
socket.on('opponentDisconnected', msg => {
    setMsg(`⚠ ${msg}`, 'warn');
    disableCards(true);
    sessionStorage.removeItem('kingSlave_session');
    setTimeout(() => { showScreen('lobby'); resetLobbyUI(); }, 3000);
});

// ══════════════════════════════════════════════════
//  LEAVE MODAL
// ══════════════════════════════════════════════════
const leaveModal      = $('leaveModal');
const leaveConfirmBtn = $('leaveConfirmBtn');
const leaveCancelBtn  = $('leaveCancelBtn');

if (leaveBtn) leaveBtn.onclick = () => leaveModal.classList.remove('hidden');
if (leaveCancelBtn) leaveCancelBtn.onclick = () => leaveModal.classList.add('hidden');
if (leaveConfirmBtn) leaveConfirmBtn.onclick = () => {
    leaveModal.classList.add('hidden');
    socket.emit('leaveGame', { gameId: currentGameId });
    sessionStorage.removeItem('kingSlave_session');
    showScreen('lobby');
    resetLobbyUI();
};

// ══════════════════════════════════════════════════
//  SESSION RESTORE
// ══════════════════════════════════════════════════
window.addEventListener('load', () => {
    const session = sessionStorage.getItem('kingSlave_session');
    if (session) {
        try {
            const { gameId, playerName } = JSON.parse(session);
            myPlayerName = playerName;
            socket.emit('reconnectToGame', { gameId, playerName });
        } catch(e) { sessionStorage.removeItem('kingSlave_session'); }
    }
});

// ══════════════════════════════════════════════════
//  MISC BUTTONS
// ══════════════════════════════════════════════════
playAgainBtn.onclick  = () => { showScreen('lobby'); resetLobbyUI(); };
backToLobbyBtn.onclick= () => { showScreen('lobby'); resetLobbyUI(); };
lobbyIcon.onclick = () => {
    const active = Object.entries(screens).find(([,el]) => el && el.classList.contains('active'));
    if (!active || active[0] === 'login' || active[0] === 'lobby') return;
    if (leaveModal) leaveModal.classList.remove('hidden');
};

function resetLobbyUI() {
    findMatchBtn.style.display = '';
    cancelMatchBtn.classList.add('hidden');
    waitingStatus.classList.add('hidden');
    currentGameId = null;
    waitingPlay   = false;
    diceRolled    = false;
    joinLobbyError.classList.add('hidden');
}
