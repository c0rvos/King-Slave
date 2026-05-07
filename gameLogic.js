// ══════════════════════════════════════════════════
//  KING vs SLAVE — Game Logic
//  Match = 4 games × 3 rounds = 12 rounds total
//  Roles alternate each game. Player who won dice starts as King.
// ══════════════════════════════════════════════════

const CARDS = {
    king:    { name: 'King',    type: 'king',    emoji: '♔' },
    slave:   { name: 'Slave',   type: 'slave',   emoji: '⛓' },
    citizen: { name: 'Citizen', type: 'citizen', emoji: '☠' }
};

// Each player always gets 5 cards: the role card + 4 citizens
function buildHand(role) {
    const hand = [{ ...CARDS[role] }];
    for (let i = 0; i < 4; i++) hand.push({ ...CARDS.citizen });
    return shuffle(hand);
}

function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

// initializeDecks: p1IsKing tells us role of player1 for this game
function initializeDecks(p1IsKing) {
    return {
        deck1: buildHand(p1IsKing ? 'king' : 'slave'),
        deck2: buildHand(p1IsKing ? 'slave' : 'king')
    };
}

// createGame — initialises entire match state
function createGame(p1Id, p2Id, p1Name, p2Name, deck1, deck2, p1IsKing) {
    return {
        player1Id:   p1Id,   player2Id:   p2Id,
        player1Name: p1Name, player2Name: p2Name,

        // Hands
        player1Hand: deck1, player2Hand: deck2,

        // Roles (flip each game)
        player1Role: p1IsKing ? 'king' : 'slave',
        player2Role: p1IsKing ? 'slave' : 'king',

        // Scores (cumulative across all 12 rounds)
        player1Score: 0, player2Score: 0,

        // History per round (cleared each round)
        player1History: [], player2History: [],

        // Current play
        player1Play: null, player2Play: null,
        player1PlayPending: false, player2PlayPending: false,

        // Match structure: 4 games × 3 rounds
        totalGames:    4,
        roundsPerGame: 3,
        gameNumber:    1,   // which game we're in (1-4)
        roundInGame:   1,   // which round within the current game (1-3)
        overallRound:  1,   // 1-12

        // p1WasKingFirst: true means in game 1 p1 is king
        p1WasKingFirst: p1IsKing,

        gameOver: false,
        winner:   null
    };
}

// ── Win condition ──────────────────────────────────
// King > Citizen, Citizen > Slave, Slave > King, same = Draw
function getWinner(c1, c2) {
    if (c1.type === c2.type) return 'tie';
    if (c1.type === 'king'    && c2.type === 'citizen') return 'p1';
    if (c2.type === 'king'    && c1.type === 'citizen') return 'p2';
    if (c1.type === 'citizen' && c2.type === 'slave')   return 'p1';
    if (c2.type === 'citizen' && c1.type === 'slave')   return 'p2';
    if (c1.type === 'slave'   && c2.type === 'king')    return 'p1';
    if (c2.type === 'slave'   && c1.type === 'king')    return 'p2';
    return 'tie';
}

// ── Scoring ────────────────────────────────────────
// Slave beats King  → 5 pts
// Citizen beats Slave → 2 pts
// King beats Citizen → 3 pts  (King card was played → round ends)
// Draw → 0
function calculatePoints(winner, c1, c2) {
    if (winner === 'tie') return 0;
    const wc = winner === 'p1' ? c1 : c2;
    const lc = winner === 'p1' ? c2 : c1;
    if (wc.type === 'slave'   && lc.type === 'king')    return 5;
    if (wc.type === 'citizen' && lc.type === 'slave')   return 2;
    if (wc.type === 'king'    && lc.type === 'citizen') return 1;
    return 0;
}

// ── Apply a play ───────────────────────────────────
function applyPlay(game) {
    const c1 = game.player1Play.card;
    const c2 = game.player2Play.card;
    const i1 = game.player1Play.cardIndex;
    const i2 = game.player2Play.cardIndex;

    const winner = getWinner(c1, c2);
    let pts1 = 0, pts2 = 0;
    let msg1 = '', msg2 = '';

    if (winner === 'p1') {
        pts1 = calculatePoints('p1', c1, c2);
        msg1 = `⚔ You win — ${c1.name} beats ${c2.name} · +${pts1}`;
        msg2 = `☠ Opponent wins — ${c1.name} beats ${c2.name}`;
    } else if (winner === 'p2') {
        pts2 = calculatePoints('p2', c1, c2);
        msg1 = `☠ Opponent wins — ${c2.name} beats ${c1.name}`;
        msg2 = `⚔ You win — ${c2.name} beats ${c1.name} · +${pts2}`;
    } else {
        msg1 = msg2 = `— Draw — both played ${c1.name}`;
    }

    game.player1Score += pts1;
    game.player2Score += pts2;

    game.player1History.push(c1);
    game.player2History.push(c2);

    game.player1Hand.splice(i1, 1);
    game.player2Hand.splice(i2, 1);

    // A round ends immediately when any player wins a trick (meaning King or Slave was involved)
    // or if hands are empty (which only happens if they draw 4 times then play the 5th)
    const kingPlayed = c1.type === 'king' || c2.type === 'king';
    const handsEmpty = game.player1Hand.length === 0 || game.player2Hand.length === 0;
    const roundEnded = winner !== 'tie' || handsEmpty;

    const totalRounds = game.totalGames * game.roundsPerGame; // 12
    const matchOver = roundEnded && game.overallRound >= totalRounds;

    let gameOver = false, winnerName = null;
    if (matchOver) {
        gameOver = true;
        winnerName = game.player1Score > game.player2Score ? 'player1'
                   : game.player2Score > game.player1Score ? 'player2'
                   : 'tie';
        game.gameOver = true;
        game.winner   = winnerName;
    }

    return {
        roundResultFor: { player1: msg1, player2: msg2 },
        player1Score: game.player1Score,
        player2Score: game.player2Score,
        player1Card: c1, player2Card: c2,
        kingPlayed, roundEnded, gameOver,
        winner: winnerName,
        pts1, pts2
    };
}

// ── Advance to next round / game ───────────────────
function advanceToNextRound(game) {
    game.overallRound++;
    game.roundInGame++;

    // Check if we need to move to the next game
    if (game.roundInGame > game.roundsPerGame) {
        game.gameNumber++;
        game.roundInGame = 1;

        // Flip roles for the new game
        game.player1Role = game.player1Role === 'king' ? 'slave' : 'king';
        game.player2Role = game.player2Role === 'king' ? 'slave' : 'king';
    }

    // Fresh hands for this round
    const p1IsKing = game.player1Role === 'king';
    const { deck1, deck2 } = initializeDecks(p1IsKing);
    game.player1Hand = deck1;
    game.player2Hand = deck2;
    game.player1History = [];
    game.player2History = [];

    // Who plays first this game?
    // Odd games (1,3): King plays first.  Even games (2,4): Slave plays first.
    const kingGoesFirst = game.gameNumber % 2 === 1;

    return {
        gameNumber:   game.gameNumber,
        roundInGame:  game.roundInGame,
        overallRound: game.overallRound,
        player1Role:  game.player1Role,
        player2Role:  game.player2Role,
        player1Hand:  game.player1Hand,
        player2Hand:  game.player2Hand,
        kingGoesFirst
    };
}

module.exports = { CARDS, initializeDecks, createGame, applyPlay, advanceToNextRound };