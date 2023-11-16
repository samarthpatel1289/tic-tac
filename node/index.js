const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');


const app = express();
app.use(cors());
const pool = new Pool({
    user: 'sam',
    host: 'localhost',
    database: 'tic-tac',
    password: 'sam123',
    port: 5432,
  });
  
const port = 3000;

app.use(express.json());

// create a new game
app.post('/games', async (req, res) => {
  try {
    console.log("Game");
    const { player_x, player_o } = req.body;
    const result = await pool.query('INSERT INTO games (player_x, player_o) VALUES ($1, $2) RETURNING *', [player_x, player_o]);
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'An error occurred while creating the game.' });
  }
});

// get a game by ID
app.get('/games/:id', async (req, res) => {
  try {
    console.log("Get Game id");
    const { id } = req.params;
    const result = await pool.query('SELECT * FROM games WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      res.status(404).json({ message: 'Game not found.' });
    } else {
      res.json(result.rows[0]);
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'An error occurred while getting the game.' });
  }
});

function getWinningMoves(board) {
    const winningMoves = [];
    // Check rows
    for (let y = 0; y < 3; y++) {
      if (board[y][0] !== '' && board[y][0] === board[y][1] && board[y][1] === board[y][2]) {
        winningMoves.push([0, y], [1, y], [2, y]);
      }
    }
    // Check columns
    for (let x = 0; x < 3; x++) {
      if (board[0][x] !== '' && board[0][x] === board[1][x] && board[1][x] === board[2][x]) {
        winningMoves.push([x, 0], [x, 1], [x, 2]);
      }
    }
    // Check diagonals
    if (board[0][0] !== '' && board[0][0] === board[1][1] && board[1][1] === board[2][2]) {
      winningMoves.push([0, 0], [1, 1], [2, 2]);
    }
    if (board[2][0] !== '' && board[2][0] === board[1][1] && board[1][1] === board[0][2]) {
      winningMoves.push([2, 0], [1, 1], [0, 2]);
    }
    return winningMoves;
  }
  

// make a move in a game
app.post('/games/:id/moves', async (req, res) => {
    try {
      console.log("Make a move");
      const { id } = req.params;
      const { player, x, y } = req.body;
      const gameResult = await pool.query('SELECT * FROM games WHERE id = $1', [id]);
      if (gameResult.rows.length === 0) {
        res.status(404).json({ message: 'Game not found.' });
        return;
      }
      const game = gameResult.rows[0];
      if (game.status !== 'in_progress') {
        res.status(400).json({ message: 'This game has already ended.' });
        return;
      }
      const moveResult = await pool.query('INSERT INTO moves (game_id, player, x, y) VALUES ($1, $2, $3, $4) RETURNING *', [id, player, x, y]);
      const move = moveResult.rows[0];
      // Check if the move resulted in a win or a draw and update the game status accordingly
      const gameStatusResult = await pool.query('SELECT * FROM games WHERE id = $1', [id]);
      const updatedGame = gameStatusResult.rows[0];
      const movesResult = await pool.query('SELECT * FROM moves WHERE game_id = $1 ORDER BY id ASC', [id]);
      const moves = movesResult.rows;

      const board = [];
      for (let i = 0; i < 3; i++) {
        board.push(['', '', '']);
      }
      for (const move of moves) {
        board[move.y][move.x] = move.player;
      }
      const winningMoves = getWinningMoves(board);
      let status;
      if (winningMoves.length > 0) {
        status = 'won';
      } else if (moves.length === 9) {
        status = 'draw';
      } else {
        status = 'in_progress';
      }
      await pool.query('UPDATE games SET status = $1 WHERE id = $2', [status, id]);
      const updatedGameResult = await pool.query('SELECT * FROM games WHERE id = $1', [id]);
      const updatedGameWithStatus = updatedGameResult.rows[0];
      res.status(201).json({
        move,
        game_status: updatedGameWithStatus.status,
        winning_moves: winningMoves,
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: 'An error occurred while making the move.' });
    }
  });
  

  app.listen(port, () => {
    console.log(`Server listening at http://localhost:${port}`);
  });
