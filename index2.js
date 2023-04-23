const express = require('express');
const cors = require('cors');
const app = express();
const port = process.env.PORT || 8080;

app.use(cors());
app.use(express.json());

const games = {};

app.post('/api/game', (req, res) => {
  const { player1, player2 } = req.body;
  const gameId = Math.random().toString(36).substring(7);
  games[gameId] = {
    board: [null, null, null, null, null, null, null, null, null],
    currentPlayer: 'X',
    player1,
    player2,
    score: { [player1]: 0, [player2]: 0 }
  };
  res.json({ gameId, board: games[gameId].board });
});

app.get('/api/game/:gameId', (req, res) => {
  const { gameId } = req.params;
  const gameData = games[gameId];
  res.json(gameData);
});

app.put('/api/game/:gameId', (req, res) => {
  const { gameId } = req.params;
  const { player, position } = req.body;
  const gameData = games[gameId];

  if (gameData.currentPlayer !== player) {
    return res.status(400).json({ message: 'Not your turn' });
  }

  if (gameData.board[position] !== null) {
    return res.status(400).json({ message: 'Position already taken' });
  }

  const updatedBoard = [...gameData.board];
  updatedBoard[position] = player;

  const updatedPlayer = player === 'X' ? 'O' : 'X';

  games[gameId] = {
    ...gameData,
    board: updatedBoard,
    currentPlayer: updatedPlayer
  };

  const winner = calculateWinner(updatedBoard);

  if (winner) {
    const score = { ...gameData.score };
    score[winner] += 1;
    games[gameId] = {
      ...gameData,
      score,
      winner,
      gameOver: true
    };
  }

  res.json({ message: 'Success' });
});

app.listen(port, () => {
  console.log(`Listening on port ${port}`);
});

function calculateWinner(board) {
  const lines = [
    [0, 1, 2],
    [3, 4, 5],
    [6, 7, 8],
    [0, 3, 6],
    [1, 4, 7],
    [2, 5, 8],
    [0, 4, 8],
    [2, 4, 6]
  ];

  for (let i = 0; i < lines.length; i++) {
    const [a, b, c] = lines[i];
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return board[a];
    }
  }

  return null;
}
