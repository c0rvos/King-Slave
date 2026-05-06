const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const { createGame, applyPlay, initializeDecks } = require('./gameLogic');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

app.use(express.static('public'));

let waitingPlayers = [];
let games = new Map();       // gameId -> game
let players = new Map();     // socket.id -> { name, socket }
let lobbies = new Map();     // lobbyCode -> { hostId, hostName, createdAt }

function generateLobbyCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)];
    return lobbies.has(code) ? generateLobbyCode() : code;
}

function startGame(socket1, socket2, name1, name2) {
    const gameId = Date.now().toString();
    const roll1 = Math.floor(Math.random() * 100) + 1;
    const roll2 = Math.floor(Math.random() * 100) + 1;
    const p1IsKing = roll1 >= roll2;
    const { deck1, deck2 } = initializeDecks(p1IsKing);
    const game = createGame(socket1.id, socket2.id, name1, name2, deck1, deck2, p1IsKing);
    games.set(gameId, game);

    socket1.emit('gameStart', {
        gameId, playerId: 'player1', playerName: name1, opponentName: name2,
        hand: game.player1Hand, currentRole: game.player1Role, currentRound: game.currentRound,
        diceResult: { yourRoll: roll1, opponentRoll: roll2, winner: p1IsKing ? name1 : name2, youAreKingFirst: p1IsKing }
    });
    socket2.emit('gameStart', {
        gameId, playerId: 'player2', playerName: name2, opponentName: name1,
        hand: game.player2Hand, currentRole: game.player2Role, currentRound: game.currentRound,
        diceResult: { yourRoll: roll2, opponentRoll: roll1, winner: p1IsKing ? name1 : name2, youAreKingFirst: !p1IsKing }
    });

    console.log(`Game started: ${name1} vs ${name2} (gameId: ${gameId})`);
}

function findMatch(socket, playerName) {
    players.set(socket.id, { name: playerName, socket });

    if (waitingPlayers.length === 0) {
        waitingPlayers.push(socket.id);
        socket.emit('waiting', `Searching for a worthy opponent...`);
    } else {
        const opponentId = waitingPlayers.shift();
        const opponent = players.get(opponentId);
        if (opponent && opponent.socket) {
            startGame(socket, opponent.socket, playerName, opponent.name);
        } else {
            waitingPlayers.push(socket.id);
            socket.emit('waiting', 'Opponent vanished. Searching again...');
        }
    }
}

io.on('connection', (socket) => {
    console.log('Connected:', socket.id);

    socket.on('joinLobby', ({ playerName }) => {
        socket.playerName = (playerName || '').trim() || `Player_${socket.id.slice(-4)}`;
        players.set(socket.id, { name: socket.playerName, socket });
        socket.emit('lobbyJoined', { playerName: socket.playerName });
    });

    socket.on('findMatch', () => {
        if (!socket.playerName) return socket.emit('error', 'Enter your name first');
        findMatch(socket, socket.playerName);
    });

    socket.on('cancelMatchmaking', () => {
        const i = waitingPlayers.indexOf(socket.id);
        if (i !== -1) waitingPlayers.splice(i, 1);
        socket.emit('matchmakingCancelled');
    });

    // --- CREATE LOBBY ---
    socket.on('createLobby', () => {
        if (!socket.playerName) return socket.emit('error', 'Enter your name first');
        // Remove from any existing lobby
        for (let [code, lobby] of lobbies.entries()) {
            if (lobby.hostId === socket.id) lobbies.delete(code);
        }
        const code = generateLobbyCode();
        lobbies.set(code, { hostId: socket.id, hostName: socket.playerName, createdAt: Date.now() });
        socket.emit('lobbyCreated', { code });
        console.log(`Lobby created: ${code} by ${socket.playerName}`);
    });

    socket.on('cancelLobby', () => {
        for (let [code, lobby] of lobbies.entries()) {
            if (lobby.hostId === socket.id) {
                lobbies.delete(code);
                socket.emit('lobbyCancelled');
                return;
            }
        }
    });

    // --- JOIN LOBBY BY CODE ---
    socket.on('joinLobbyCode', ({ code }) => {
        if (!socket.playerName) return socket.emit('error', 'Enter your name first');
        const upperCode = (code || '').toUpperCase().trim();
        const lobby = lobbies.get(upperCode);

        if (!lobby) {
            return socket.emit('lobbyJoinError', 'Room not found. Check the code and try again.');
        }
        if (lobby.hostId === socket.id) {
            return socket.emit('lobbyJoinError', "That's your own room!");
        }

        const host = players.get(lobby.hostId);
        if (!host || !host.socket) {
            lobbies.delete(upperCode);
            return socket.emit('lobbyJoinError', 'Host disconnected. Room no longer exists.');
        }

        lobbies.delete(upperCode);
        startGame(host.socket, socket, host.name, socket.playerName);
    });

    // --- CHAT ---
    socket.on('chatMessage', ({ gameId, text }) => {
        if (!text || typeof text !== 'string') return;
        const trimmed = text.trim().slice(0, 200);
        if (!trimmed) return;

        const game = games.get(gameId);
        if (!game) return;
        if (game.player1Id !== socket.id && game.player2Id !== socket.id) return;

        const senderName = socket.playerName || 'Unknown';
        const payload = { senderName, text: trimmed, ts: Date.now() };
        io.to(game.player1Id).emit('chatMessage', payload);
        io.to(game.player2Id).emit('chatMessage', payload);
    });

    // --- EMOTE ---
    socket.on('sendEmote', ({ gameId, emote }) => {
        const game = games.get(gameId);
        if (!game) return;
        const oppId = game.player1Id === socket.id ? game.player2Id : game.player1Id;
        io.to(oppId).emit('receiveEmote', { emote });
    });

    // --- PLAY CARD ---
    socket.on('playCard', ({ gameId, cardIndex }) => {
        const game = games.get(gameId);
        if (!game) return socket.emit('error', 'Game not found');

        const isP1 = game.player1Id === socket.id;
        const key = isP1 ? 'player1' : 'player2';
        const hand = game[`${key}Hand`];

        if (cardIndex >= hand.length) return socket.emit('error', 'Invalid card');

        const card = hand[cardIndex];
        game[`${key}Play`] = { card, cardIndex };
        game[`${key}PlayPending`] = true;
        socket.emit('playRecorded', { card });

        // Notify opponent that a card was placed (face-down — don't reveal type)
        const oppId = isP1 ? game.player2Id : game.player1Id;
        io.to(oppId).emit('opponentCardPlayed');

        if (game.player1PlayPending && game.player2PlayPending) {
            const result = applyPlay(game);

            io.to(game.player1Id).emit('roundComplete', {
                roundResult: result.roundResultFor.player1,
                yourScore: result.player1Score, opponentScore: result.player2Score,
                yourHand: game.player1Hand.map(c => ({ type: c.type, name: c.name })),
                opponentCardsLeft: game.player2Hand.length,
                yourHistory: game.player1History, opponentPlay: result.player2Card,
                currentRound: game.currentRound, currentTurn: game.currentTurn,
                gameOver: result.gameOver,
                winner: result.winner, yourRole: game.player1Role
            });
            io.to(game.player2Id).emit('roundComplete', {
                roundResult: result.roundResultFor.player2,
                yourScore: result.player2Score, opponentScore: result.player1Score,
                yourHand: game.player2Hand.map(c => ({ type: c.type, name: c.name })),
                opponentCardsLeft: game.player1Hand.length,
                yourHistory: game.player2History, opponentPlay: result.player1Card,
                currentRound: game.currentRound, currentTurn: game.currentTurn,
                gameOver: result.gameOver,
                winner: result.winner, yourRole: game.player2Role
            });

            game.player1PlayPending = false; game.player2PlayPending = false;
            game.player1Play = null; game.player2Play = null;

            // Trigger next round when one of the hands is empty
            const shouldAdvanceRound = !result.gameOver && game.currentRound < game.totalRounds && result.roundEnded;

            if (shouldAdvanceRound) {
                setTimeout(() => {
                    game.player1Role = game.player1Role === 'king' ? 'slave' : 'king';
                    game.player2Role = game.player2Role === 'king' ? 'slave' : 'king';
                    game.currentRound++;
                    game.currentTurn = 0;
                    const { deck1, deck2 } = initializeDecks(game.player1Role === 'king');
                    game.player1Hand = deck1; game.player2Hand = deck2;
                    game.player1History = []; game.player2History = [];
                    io.to(game.player1Id).emit('nextRound', { newRound: game.currentRound, newRole: game.player1Role, newHand: game.player1Hand.map(c => ({ type: c.type, name: c.name })) });
                    io.to(game.player2Id).emit('nextRound', { newRound: game.currentRound, newRole: game.player2Role, newHand: game.player2Hand.map(c => ({ type: c.type, name: c.name })) });
                }, 2800);
            }

            if (result.gameOver) games.delete(gameId);
        } else {
            socket.emit('waitingForOpponent', 'Waiting for opponent...');
        }
    });

    socket.on('disconnect', () => {
        const i = waitingPlayers.indexOf(socket.id);
        if (i !== -1) waitingPlayers.splice(i, 1);

        // Clean up hosted lobbies
        for (let [code, lobby] of lobbies.entries()) {
            if (lobby.hostId === socket.id) lobbies.delete(code);
        }

        for (let [gameId, game] of games.entries()) {
            if (game.player1Id === socket.id || game.player2Id === socket.id) {
                const oppId = game.player1Id === socket.id ? game.player2Id : game.player1Id;
                const opp = players.get(oppId);
                if (opp && opp.socket) opp.socket.emit('opponentDisconnected', 'Your opponent left the game.');
                games.delete(gameId);
                break;
            }
        }
        players.delete(socket.id);
        console.log('Disconnected:', socket.id);
    });
});

// Clean up stale lobbies (older than 10 minutes)
setInterval(() => {
    const now = Date.now();
    for (let [code, lobby] of lobbies.entries()) {
        if (now - lobby.createdAt > 600000) lobbies.delete(code);
    }
}, 60000);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`🎮 Server running on http://localhost:${PORT}`));
