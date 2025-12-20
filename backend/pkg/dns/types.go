package dns

import (
	"fmt"
	"strings"

	"dns-tic-tac-toe/pkg/game"
)

// Command represents a DNS command type
type Command string

const (
	CommandNew      Command = "new"
	CommandCreate   Command = "create"
	CommandList     Command = "list"
	CommandSessions Command = "sessions"
	CommandHelp     Command = "help"
	CommandJoin     Command = "join"
	CommandBoard    Command = "board"
	CommandStatus   Command = "status"
	CommandMove     Command = "move"
	CommandReset    Command = "reset"
	CommandJSON     Command = "json"
	CommandUnknown  Command = "unknown"
)

// IsValid checks if the command is valid
func (c Command) IsValid() bool {
	return c != CommandUnknown && c != ""
}

// IsSessionManagement returns true if the command is a session management command
func (c Command) IsSessionManagement() bool {
	return c == CommandNew || c == CommandCreate || c == CommandList || c == CommandSessions || c == CommandHelp
}

// IsGameCommand returns true if the command is a game command
func (c Command) IsGameCommand() bool {
	return c == CommandJoin || c == CommandBoard || c == CommandStatus || c == CommandMove || c == CommandReset || c == CommandJSON
}

// ParseCommand parses a string into a Command type
func ParseCommand(cmdStr string) Command {
	cmdStr = strings.ToLower(strings.TrimSpace(cmdStr))

	switch cmdStr {
	case "new", "create":
		return CommandNew
	case "list", "sessions":
		return CommandList
	case "help", "":
		return CommandHelp
	case "join":
		return CommandJoin
	case "board", "status":
		return CommandBoard
	case "reset":
		return CommandReset
	case "json":
		return CommandJSON
	default:
		if strings.HasPrefix(cmdStr, "move-") {
			return CommandMove
		}
		return CommandUnknown
	}
}

// String returns the string representation of the command
func (c Command) String() string {
	return string(c)
}

// SessionID represents a session identifier
type SessionID string

// IsValid checks if the session ID has a valid format
func (id SessionID) IsValid() bool {
	return len(id) >= 4 && len(id) <= 36
}

// String returns the string representation of the session ID
func (id SessionID) String() string {
	return string(id)
}

// MoveParams represents the parameters for a move command
type MoveParams struct {
	Row         int
	Col         int
	PlayerToken string
}

// IsValid validates the move parameters (position only, token validation happens in server)
func (m *MoveParams) IsValid() bool {
	return m.Row >= 0 && m.Row < 3 && m.Col >= 0 && m.Col < 3
}

// ParseMoveParams parses a move command string into MoveParams
// Format: move-ROW-COL-TOKEN (e.g., move-1-2-abc12345)
func ParseMoveParams(moveStr string) (*MoveParams, error) {
	if !strings.HasPrefix(moveStr, "move-") {
		return nil, fmt.Errorf("invalid move format: must start with 'move-'")
	}

	parts := strings.Split(moveStr, "-")
	if len(parts) != 4 {
		return nil, fmt.Errorf("invalid move format: expected move-ROW-COL-TOKEN, got %d parts", len(parts))
	}

	var row, col int
	var token string

	if _, err := fmt.Sscanf(parts[1], "%d", &row); err != nil {
		return nil, fmt.Errorf("invalid row: %v", err)
	}

	if _, err := fmt.Sscanf(parts[2], "%d", &col); err != nil {
		return nil, fmt.Errorf("invalid col: %v", err)
	}

	token = parts[3]
	if len(token) == 0 {
		return nil, fmt.Errorf("invalid token: token cannot be empty")
	}

	params := &MoveParams{
		Row:         row,
		Col:         col,
		PlayerToken: token,
	}

	if !params.IsValid() {
		return nil, fmt.Errorf("invalid move parameters: row=%d, col=%d (must be 0-2)", row, col)
	}

	return params, nil
}

// Query represents a parsed DNS query
type Query struct {
	SessionID   SessionID
	PlayerToken game.PlayerToken
	Command     Command
	MoveParams  *MoveParams
	RawQuery    string
}

// IsSessionManagement returns true if the query is a session management command
func (q *Query) IsSessionManagement() bool {
	return q.SessionID == "" && q.Command.IsSessionManagement()
}

// IsGameCommand returns true if the query is a game command
func (q *Query) IsGameCommand() bool {
	return q.SessionID != "" && q.SessionID.IsValid() && q.Command.IsGameCommand()
}

// IsValid returns true if the query is valid
func (q *Query) IsValid() bool {
	if q.IsSessionManagement() {
		return q.Command.IsValid()
	}
	if q.IsGameCommand() {
		return q.SessionID.IsValid() && q.Command.IsValid()
	}
	return false
}

// Zone represents a DNS zone configuration
type Zone string

// Normalize ensures the zone has a trailing dot
func (z Zone) Normalize() string {
	zoneStr := string(z)
	if len(zoneStr) > 0 && zoneStr[len(zoneStr)-1] != '.' {
		return zoneStr + "."
	}
	return zoneStr
}
