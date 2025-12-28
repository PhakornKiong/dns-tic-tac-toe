package game

import (
	"encoding/json"
	"fmt"
	"strings"
	"sync"
)

// Engine defines the interface for a tic-tac-toe game engine
type Engine interface {
	// GetState returns the current game state
	GetState() *GameState

	// MakeMove attempts to make a move at the specified position
	// Returns an error if the move is invalid
	MakeMove(row, col int, player Player) error

	// Reset resets the game to its initial state
	Reset()

	// FormatBoard returns a human-readable string representation of the board
	FormatBoard() string

	// GetStateJSON returns the game state as a JSON string
	GetStateJSON() string

	// StartGame sets the game status to playing (called when both players have joined)
	StartGame()
}

// TicTacToe implements the Engine interface
type TicTacToe struct {
	state *GameState
	mu    sync.RWMutex
}

// NewTicTacToe creates a new tic-tac-toe game instance
func NewTicTacToe() *TicTacToe {
	return &TicTacToe{
		state: &GameState{
			Board:  [3][3]Player{{"", "", ""}, {"", "", ""}, {"", "", ""}},
			Turn:   PlayerX,
			Status: StatusPending,
		},
	}
}

// GetState returns the current game state (thread-safe copy)
func (g *TicTacToe) GetState() *GameState {
	g.mu.RLock()
	defer g.mu.RUnlock()
	// Return a copy to prevent external modification
	stateCopy := *g.state
	return &stateCopy
}

// MakeMove attempts to make a move at the specified position
func (g *TicTacToe) MakeMove(row, col int, player Player) error {
	g.mu.Lock()
	defer g.mu.Unlock()

	if g.state.Status != StatusPlaying {
		return NewGameOverError(g.state.Status)
	}

	if player != g.state.Turn {
		return NewWrongTurnError(player, g.state.Turn)
	}

	if row < 0 || row >= 3 || col < 0 || col >= 3 {
		return NewInvalidPositionError(row, col)
	}

	if g.state.Board[row][col] != "" {
		return ErrPositionTaken
	}

	g.state.Board[row][col] = player

	// Check for win
	if g.checkWin(player) {
		if player == PlayerX {
			g.state.Status = StatusXWins
		} else {
			g.state.Status = StatusOWins
		}
	} else if g.isBoardFull() {
		g.state.Status = StatusDraw
	} else {
		// Switch turn
		if g.state.Turn == PlayerX {
			g.state.Turn = PlayerO
		} else {
			g.state.Turn = PlayerX
		}
	}

	return nil
}

// Reset resets the game to its initial state
func (g *TicTacToe) Reset() {
	g.mu.Lock()
	defer g.mu.Unlock()
	// Reset to pending - the caller should call StartGame() if both players are still in
	g.state = &GameState{
		Board:  [3][3]Player{{"", "", ""}, {"", "", ""}, {"", "", ""}},
		Turn:   PlayerX,
		Status: StatusPending,
	}
}

// StartGame sets the game status to playing (called when both players have joined)
func (g *TicTacToe) StartGame() {
	g.mu.Lock()
	defer g.mu.Unlock()
	// Only start if currently pending
	if g.state.Status == StatusPending {
		g.state.Status = StatusPlaying
	}
}

// FormatBoard returns a human-readable string representation of the board
func (g *TicTacToe) FormatBoard() string {
	state := g.GetState()
	var sb strings.Builder
	sb.WriteString("\n")
	for i := 0; i < 3; i++ {
		for j := 0; j < 3; j++ {
			cell := state.Board[i][j]
			if cell == "" {
				sb.WriteString("_")
			} else {
				sb.WriteString(string(cell))
			}
			if j < 2 {
				sb.WriteString(" ")
			}
		}
		sb.WriteString("\n")
	}
	sb.WriteString(fmt.Sprintf("Turn: %s | Status: %s\n", state.Turn, state.Status))
	return sb.String()
}

// GetStateJSON returns the game state as a JSON string
func (g *TicTacToe) GetStateJSON() string {
	state := g.GetState()
	jsonData, _ := json.Marshal(state)
	return string(jsonData)
}

// checkWin checks if the specified player has won
func (g *TicTacToe) checkWin(player Player) bool {
	board := g.state.Board

	// Check rows
	for i := 0; i < 3; i++ {
		if board[i][0] == player && board[i][1] == player && board[i][2] == player {
			return true
		}
	}

	// Check columns
	for i := 0; i < 3; i++ {
		if board[0][i] == player && board[1][i] == player && board[2][i] == player {
			return true
		}
	}

	// Check diagonals
	if board[0][0] == player && board[1][1] == player && board[2][2] == player {
		return true
	}
	if board[0][2] == player && board[1][1] == player && board[2][0] == player {
		return true
	}

	return false
}

// isBoardFull checks if the board is completely filled
func (g *TicTacToe) isBoardFull() bool {
	for i := 0; i < 3; i++ {
		for j := 0; j < 3; j++ {
			if g.state.Board[i][j] == "" {
				return false
			}
		}
	}
	return true
}
