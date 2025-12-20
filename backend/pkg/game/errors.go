package game

import "fmt"

// Error represents a game-related error
type Error struct {
	Code    ErrorCode
	Message string
}

// ErrorCode represents different types of game errors
type ErrorCode string

const (
	ErrCodeGameOver        ErrorCode = "GAME_OVER"
	ErrCodeWrongTurn       ErrorCode = "WRONG_TURN"
	ErrCodeInvalidPosition ErrorCode = "INVALID_POSITION"
	ErrCodePositionTaken   ErrorCode = "POSITION_TAKEN"
)

// Predefined errors
var (
	ErrGameOver = &Error{
		Code:    ErrCodeGameOver,
		Message: "game is over",
	}
	ErrWrongTurn = &Error{
		Code:    ErrCodeWrongTurn,
		Message: "not your turn",
	}
	ErrInvalidPosition = &Error{
		Code:    ErrCodeInvalidPosition,
		Message: "invalid position (must be 0-2)",
	}
	ErrPositionTaken = &Error{
		Code:    ErrCodePositionTaken,
		Message: "position already taken",
	}
)

// Error implements the error interface
func (e *Error) Error() string {
	return e.Message
}

// NewGameOverError creates a new game over error with status details
func NewGameOverError(status Status) *Error {
	return &Error{
		Code:    ErrCodeGameOver,
		Message: fmt.Sprintf("game is over: %s", status),
	}
}

// NewWrongTurnError creates a new wrong turn error with player details
func NewWrongTurnError(player, currentTurn Player) *Error {
	return &Error{
		Code:    ErrCodeWrongTurn,
		Message: fmt.Sprintf("not %s's turn (current turn: %s)", player, currentTurn),
	}
}

// NewInvalidPositionError creates a new invalid position error
func NewInvalidPositionError(row, col int) *Error {
	return &Error{
		Code:    ErrCodeInvalidPosition,
		Message: fmt.Sprintf("invalid position: row=%d, col=%d (must be 0-2)", row, col),
	}
}
