package dns

import "fmt"

// Error represents a DNS server-related error
type Error struct {
	Code    ErrorCode
	Message string
}

// ErrorCode represents different types of DNS errors
type ErrorCode string

const (
	ErrCodeInvalidQuery      ErrorCode = "INVALID_QUERY"
	ErrCodeEmptyQuery        ErrorCode = "EMPTY_QUERY"
	ErrCodeInvalidFormat     ErrorCode = "INVALID_FORMAT"
	ErrCodeInvalidCommand    ErrorCode = "INVALID_COMMAND"
	ErrCodeInvalidMoveFormat ErrorCode = "INVALID_MOVE_FORMAT"
	ErrCodeInvalidPlayer     ErrorCode = "INVALID_PLAYER"
	ErrCodeInvalidSessionID  ErrorCode = "INVALID_SESSION_ID"
	ErrCodeZoneMismatch      ErrorCode = "ZONE_MISMATCH"
	ErrCodeSessionNotFound   ErrorCode = "SESSION_NOT_FOUND"
	ErrCodeSessionCreate     ErrorCode = "SESSION_CREATE_FAILED"
)

// Predefined errors
var (
	ErrEmptyQuery = &Error{
		Code:    ErrCodeEmptyQuery,
		Message: "empty query",
	}

	ErrInvalidFormat = &Error{
		Code:    ErrCodeInvalidFormat,
		Message: "invalid query format",
	}

	ErrInvalidCommand = &Error{
		Code:    ErrCodeInvalidCommand,
		Message: "invalid command",
	}

	ErrInvalidMoveFormat = &Error{
		Code:    ErrCodeInvalidMoveFormat,
		Message: "invalid move format",
	}

	ErrInvalidPlayer = &Error{
		Code:    ErrCodeInvalidPlayer,
		Message: "invalid player (must be X or O)",
	}

	ErrInvalidSessionID = &Error{
		Code:    ErrCodeInvalidSessionID,
		Message: "invalid session ID format",
	}
)

// Error implements the error interface
func (e *Error) Error() string {
	return e.Message
}

// NewInvalidQueryError creates a new invalid query error
func NewInvalidQueryError(query string) *Error {
	return &Error{
		Code:    ErrCodeInvalidQuery,
		Message: fmt.Sprintf("invalid query format: %s", query),
	}
}

// NewInvalidCommandError creates a new invalid command error
func NewInvalidCommandError(command string) *Error {
	return &Error{
		Code:    ErrCodeInvalidCommand,
		Message: fmt.Sprintf("unknown command: %s", command),
	}
}

// NewInvalidMoveFormatError creates a new invalid move format error
func NewInvalidMoveFormatError(format string) *Error {
	return &Error{
		Code:    ErrCodeInvalidMoveFormat,
		Message: fmt.Sprintf("invalid move format: %s. Use: {session-id}-{token}-move-ROW-COL (e.g., abc123-xyz78901-move-1-1)", format),
	}
}

// NewInvalidPlayerError creates a new invalid player error
func NewInvalidPlayerError(player string) *Error {
	return &Error{
		Code:    ErrCodeInvalidPlayer,
		Message: fmt.Sprintf("invalid player: %s (must be X or O)", player),
	}
}

// NewInvalidSessionIDError creates a new invalid session ID error
func NewInvalidSessionIDError(sessionID string) *Error {
	return &Error{
		Code:    ErrCodeInvalidSessionID,
		Message: fmt.Sprintf("invalid session ID format: %s (must be 8 characters)", sessionID),
	}
}

// NewSessionNotFoundError creates a new session not found error
func NewSessionNotFoundError(sessionID string) *Error {
	return &Error{
		Code:    ErrCodeSessionNotFound,
		Message: fmt.Sprintf("session not found: %s", sessionID),
	}
}

// NewSessionCreateError creates a new session creation error
func NewSessionCreateError(err error) *Error {
	return &Error{
		Code:    ErrCodeSessionCreate,
		Message: fmt.Sprintf("failed to create session: %s", err.Error()),
	}
}

// NewZoneMismatchError creates a new zone mismatch error
func NewZoneMismatchError(queryZone, expectedZone string) *Error {
	return &Error{
		Code:    ErrCodeZoneMismatch,
		Message: fmt.Sprintf("zone mismatch: query for %s, expected %s", queryZone, expectedZone),
	}
}
