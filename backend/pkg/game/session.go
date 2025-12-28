package game

import (
	"fmt"
	"sync"
	"time"

	"github.com/google/uuid"
)

// Session represents a game session with a unique ID
type Session struct {
	ID        string
	Game      Engine
	Players   map[PlayerToken]Player // Maps player tokens to their assigned player (X or O)
	CreatedAt time.Time
	config    *ManagerConfig
	mu        sync.RWMutex
}

// Manager manages multiple game sessions
type Manager struct {
	sessions map[string]*Session
	config   *ManagerConfig
	mu       sync.RWMutex
}

// NewManager creates a new session manager with optional configuration
func NewManager(opts ...ManagerOption) *Manager {
	// Default config
	config := &ManagerConfig{
		SessionIDLength:   8,
		PlayerTokenLength: 8,
	}

	// Apply options
	for _, opt := range opts {
		opt(config)
	}

	return &Manager{
		sessions: make(map[string]*Session),
		config:   config,
	}
}

// CreateSession creates a new game session and returns its ID
func (m *Manager) CreateSession() (string, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	// Generate a unique short ID with configured length for easier DNS usage
	var shortID string
	for {
		uuidStr := uuid.New().String()
		// Use configured length, but ensure we don't exceed UUID length (36 chars)
		length := m.config.SessionIDLength
		if length > len(uuidStr) {
			length = len(uuidStr)
		}
		shortID = uuidStr[:length]
		// Ensure uniqueness (very unlikely collision, but check anyway)
		if _, exists := m.sessions[shortID]; !exists {
			break
		}
	}

	session := &Session{
		ID:        shortID,
		Game:      NewTicTacToe(),
		Players:   make(map[PlayerToken]Player),
		CreatedAt: time.Now(),
		config:    m.config,
	}

	m.sessions[shortID] = session

	return shortID, nil
}

// GetSession retrieves a session by ID
func (m *Manager) GetSession(id string) (*Session, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	session, exists := m.sessions[id]
	if !exists {
		return nil, fmt.Errorf("session not found: %s", id)
	}

	return session, nil
}

// DeleteSession removes a session
func (m *Manager) DeleteSession(id string) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	if _, exists := m.sessions[id]; !exists {
		return fmt.Errorf("session not found: %s", id)
	}

	delete(m.sessions, id)
	return nil
}

// ListSessions returns a list of all active session IDs
func (m *Manager) ListSessions() []string {
	m.mu.RLock()
	defer m.mu.RUnlock()

	ids := make([]string, 0, len(m.sessions))
	for id := range m.sessions {
		ids = append(ids, id)
	}

	return ids
}

// GetSessionCount returns the number of active sessions
func (m *Manager) GetSessionCount() int {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return len(m.sessions)
}

// JoinSession allows a player to join a session and returns a player token
// First player gets X, second player gets O
// Tic-tac-toe is always a 2-player game
func (s *Session) JoinSession() (PlayerToken, Player, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	// Check if session is full (tic-tac-toe is always 2 players)
	if len(s.Players) >= 2 {
		return "", "", fmt.Errorf("session is full (2 players already joined)")
	}

	// Determine which player to assign
	var assignedPlayer Player
	if len(s.Players) == 0 {
		assignedPlayer = PlayerX
	} else {
		assignedPlayer = PlayerO
	}

	// Generate a unique token for this player
	tokenLength := 8
	if s.config != nil {
		tokenLength = s.config.PlayerTokenLength
	}
	token := GeneratePlayerToken(tokenLength)

	// Ensure token uniqueness within the session (very unlikely, but check)
	for _, exists := s.Players[token]; exists; {
		token = GeneratePlayerToken(tokenLength)
	}

	s.Players[token] = assignedPlayer

	// If this is the second player joining, start the game
	if len(s.Players) == 2 {
		s.Game.StartGame()
	}

	return token, assignedPlayer, nil
}

// GetPlayer returns the Player (X or O) associated with a token
func (s *Session) GetPlayer(token PlayerToken) (Player, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	player, exists := s.Players[token]
	if !exists {
		return "", fmt.Errorf("invalid player token: %s", token)
	}

	return player, nil
}

// GetPlayerInfo returns information about all players in the session
func (s *Session) GetPlayerInfo() []PlayerInfo {
	s.mu.RLock()
	defer s.mu.RUnlock()

	info := make([]PlayerInfo, 0, len(s.Players))
	for token, player := range s.Players {
		info = append(info, PlayerInfo{
			Token:  token,
			Player: player,
		})
	}

	return info
}

// GetPlayerCount returns the number of players in the session
func (s *Session) GetPlayerCount() int {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return len(s.Players)
}

// CleanupOldSessions removes sessions older than the specified duration
func (m *Manager) CleanupOldSessions(maxAge time.Duration) {
	m.mu.Lock()
	defer m.mu.Unlock()

	now := time.Now()
	for id, session := range m.sessions {
		if now.Sub(session.CreatedAt) > maxAge {
			delete(m.sessions, id)
		}
	}
}
