// Card definitions
const CARDS = {
    king:    { name: 'King',    type: 'king',    emoji: '♔', value: 'king'    },
    slave:   { name: 'Slave',   type: 'slave',   emoji: '⛓', value: 'slave'   },
    citizen: { name: 'Citizen', type: 'citizen', emoji: '☠', value: 'citizen' }
};

// Initialize decks based on role (King side or Slave side)
function initializeDecks(firstPlayerIsKing) {
    let deck1 = [], deck2 = [];
    if (firstPlayerIsKing) {
        deck1.push({ ...CARDS.king });
        for (let i = 0; i < 3; i++) deck1.push({ ...CARDS.citizen });
        deck2.push({ ...CARDS.slave });
        for (let i = 0; i < 4; i++) deck2.push({ ...CARDS.citizen });
    } else {
        deck1.push({ ...CARDS.slave });
        for (let i = 0; i < 4; i++) deck1.push({ ...CARDS.citizen });
        deck2.push({ ...CARDS.king });
        for (let i = 0; i < 3; i++) deck2.push({ ...CARDS.citizen });
    }
    function shuffle(deck) {
        for (let i = deck.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [deck[i], deck[j]] = [deck[j], deck[i]];
        }
        return deck;
    }
    return { deck1: shuffle(deck1), deck2: shuffle(deck2) };
}

// Create a new game
function createGame(player1Id, player2Id, player1Name, player2Name, deck1, deck2, firstPlayerIsKing) {
    return {
        player1Id, player2Id, player1Name, player2Name,
        player1Hand: deck1, player2Hand: deck2,
        player1Role: firstPlayerIsKing ? 'king' : 'slave',
        player2Role: firstPlayerIsKing ? 'slave' : 'king',
        player1Score: 0, player2Score: 0,
        player1History: [], player2History: [],
        player1Play: null, player2Play: null,
        player1PlayPending: false, player2PlayPending: false,
        currentTurn: 0, currentRound: 1,
        totalRounds: 10,  // total rounds
        gameOver: false, winner: null
    };
}

function getWinner(cardA, cardB) {
    if (cardA.type === cardB.type) return 'tie';
    if (cardA.type === 'king'    && cardB.type === 'citizen') return 'playerA';
    if (cardB.type === 'king'    && cardA.type === 'citizen') return 'playerB';
    if (cardA.type === 'citizen' && cardB.type === 'slave')   return 'playerA';
    if (cardB.type === 'citizen' && cardA.type === 'slave')   return 'playerB';
    if (cardA.type === 'slave'   && cardB.type === 'king')    return 'playerA';
    if (cardB.type === 'slave'   && cardA.type === 'king')    return 'playerB';
    return 'tie';
}

function calculatePoints(winner, cardA, cardB) {
    if (winner === 'playerA' && cardA.type === 'slave'  && cardB.type === 'king')  return 5;
    if (winner === 'playerB' && cardB.type === 'slave'  && cardA.type === 'king')  return 5;
    return 1;
}



function applyPlay(game) {
    const card1      = game.player1Play.card;
    const card2      = game.player2Play.card;
    const card1Index = game.player1Play.cardIndex;
    const card2Index = game.player2Play.cardIndex;

    const winner = getWinner(card1, card2);

    let points1 = 0, points2 = 0;
    let resultMessage1 = '', resultMessage2 = '';

    if (winner === 'playerA') {
        points1 = calculatePoints(winner, card1, card2);
        const ptsTxt = points1 === 5 ? '5 POINTS' : '1 point';
        resultMessage1 = `You won — ${card1.name} beats ${card2.name} · ${ptsTxt}`;
        resultMessage2 = `Opponent won — ${card1.name} beats ${card2.name}`;
    } else if (winner === 'playerB') {
        points2 = calculatePoints(winner, card1, card2);
        const ptsTxt = points2 === 5 ? '5 POINTS' : '1 point';
        resultMessage1 = `Opponent won — ${card2.name} beats ${card1.name}`;
        resultMessage2 = `You won — ${card2.name} beats ${card1.name} · ${ptsTxt}`;
    } else {
        resultMessage1 = `Tied — both played ${card1.name}`;
        resultMessage2 = `Tied — both played ${card2.name}`;
    }

    game.player1Score += points1;
    game.player2Score += points2;

    game.player1History.push(card1);
    game.player2History.push(card2);

    game.player1Hand.splice(card1Index, 1);
    game.player2Hand.splice(card2Index, 1);

    game.currentTurn++;

    const roundEnded = game.player1Hand.length === 0 || game.player2Hand.length === 0;
    let gameOver = false, winner_name = null;

    // Full game end: last round, last turn
    if (game.currentRound >= game.totalRounds && roundEnded) {
        gameOver = true;
        winner_name = game.player1Score > game.player2Score ? 'player1'
                    : game.player2Score > game.player1Score ? 'player2'
                    : 'tie';
        game.gameOver = gameOver;
        game.winner   = winner_name;
    }

    return {
        roundResultFor: { player1: resultMessage1, player2: resultMessage2 },
        player1Score: game.player1Score,
        player2Score: game.player2Score,
        player1Card: card1,
        player2Card: card2,
        gameOver,
        winner: winner_name,
        roundEnded
    };
}

module.exports = { CARDS, initializeDecks, createGame, getWinner, calculatePoints, applyPlay };