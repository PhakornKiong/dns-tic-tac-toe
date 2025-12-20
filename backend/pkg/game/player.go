package game

import (
	"fmt"

	"github.com/google/uuid"
)

// PlayerToken represents a unique token for a player in a session
type PlayerToken string

// GeneratePlayerToken generates a new unique player token
func GeneratePlayerToken(length int) PlayerToken {
	if length <= 0 {
		length = 8 // Default fallback
	}
	uuidStr := uuid.New().String()
	// Use configured length, but ensure we don't exceed UUID length (36 chars)
	if length > len(uuidStr) {
		length = len(uuidStr)
	}
	return PlayerToken(uuidStr[:length])
}

// String returns the string representation of the token
func (t PlayerToken) String() string {
	return string(t)
}

// PlayerInfo represents information about a player in a session
type PlayerInfo struct {
	Token  PlayerToken
	Player Player
}

// String returns a string representation of player info
func (p *PlayerInfo) String() string {
	return fmt.Sprintf("Token: %s, Player: %s", p.Token, p.Player)
}
