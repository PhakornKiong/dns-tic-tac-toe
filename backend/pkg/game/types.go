package game

// ManagerConfig holds configuration for the session manager
type ManagerConfig struct {
	SessionIDLength   int
	PlayerTokenLength int
}

// ManagerOption is a function that configures a ManagerConfig
type ManagerOption func(*ManagerConfig)

// WithSessionIDLength sets the session ID length
func WithSessionIDLength(length int) ManagerOption {
	return func(c *ManagerConfig) {
		c.SessionIDLength = length
	}
}

// WithPlayerTokenLength sets the player token length
func WithPlayerTokenLength(length int) ManagerOption {
	return func(c *ManagerConfig) {
		c.PlayerTokenLength = length
	}
}

// Player represents a tic-tac-toe player
type Player string

const (
	PlayerX Player = "X"
	PlayerO Player = "O"
)

// Status represents the current game status
type Status string

const (
	StatusPending Status = "pending"
	StatusPlaying Status = "playing"
	StatusXWins   Status = "X_wins"
	StatusOWins   Status = "O_wins"
	StatusDraw    Status = "draw"
)

// GameState represents the current state of a tic-tac-toe game
type GameState struct {
	Board  [3][3]Player `json:"board"`
	Turn   Player       `json:"turn"`
	Status Status       `json:"status"`
}
