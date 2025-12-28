package dns

import (
	"encoding/json"
	"fmt"
	"strings"

	"dns-tic-tac-toe/pkg/game"

	"github.com/miekg/dns"
)

// WriteError writes an error response
func WriteError(msg *dns.Msg, qname string, err error, ttl uint32) {
	response := fmt.Sprintf("ERROR: %s", err.Error())
	writeText(msg, qname, response, ttl)
}

// WriteErrorWithContext writes an error response with additional context
func WriteErrorWithContext(msg *dns.Msg, qname string, err error, context string, ttl uint32, zone string) {
	response := fmt.Sprintf("ERROR: %s\n%s", err.Error(), context)
	writeText(msg, qname, response, ttl)
}

// WriteSuccess writes a success message
func WriteSuccess(msg *dns.Msg, qname string, message string, ttl uint32) {
	writeText(msg, qname, message, ttl)
}

// WriteSessionCreated writes a session creation response
func WriteSessionCreated(msg *dns.Msg, qname string, sessionID SessionID, ttl uint32, zone string) {
	zoneExample := strings.TrimSuffix(zone, ".")
	response := fmt.Sprintf("New session created!\nSession ID: %s\n\nUse this ID in your queries:\n- %s.board.%s\n- %s.move-1-2-X.%s\n- %s.reset.%s",
		sessionID, sessionID, zoneExample, sessionID, zoneExample, sessionID, zoneExample)
	writeText(msg, qname, response, ttl)
}

// WriteSessionList writes a list of active sessions
func WriteSessionList(msg *dns.Msg, qname string, sessions []string, ttl uint32, zone string) {
	zoneExample := strings.TrimSuffix(zone, ".")
	if len(sessions) == 0 {
		writeText(msg, qname, fmt.Sprintf("No active sessions. Create one with: new.%s", zoneExample), ttl)
		return
	}
	response := fmt.Sprintf("Active sessions (%d):\n%s", len(sessions), strings.Join(sessions, "\n"))
	writeText(msg, qname, response, ttl)
}

// WriteBoard writes a board view response
func WriteBoard(msg *dns.Msg, qname string, sessionID SessionID, gameEngine game.Engine, ttl uint32) {
	response := fmt.Sprintf("Session: %s\n%s", sessionID, gameEngine.FormatBoard())
	writeText(msg, qname, response, ttl)
}

// WriteBoardWithMessage writes a board view with an additional message
func WriteBoardWithMessage(msg *dns.Msg, qname string, sessionID SessionID, message string, gameEngine game.Engine, ttl uint32) {
	response := fmt.Sprintf("Session: %s\n%s\n%s", sessionID, message, gameEngine.FormatBoard())
	writeText(msg, qname, response, ttl)
}

// WriteMoveAccepted writes a move acceptance response
func WriteMoveAccepted(msg *dns.Msg, qname string, sessionID SessionID, gameEngine game.Engine, ttl uint32) {
	WriteBoardWithMessage(msg, qname, sessionID, "Move accepted!", gameEngine, ttl)
}

// WriteMoveError writes a move error response
func WriteMoveError(msg *dns.Msg, qname string, sessionID SessionID, err error, gameEngine game.Engine, ttl uint32) {
	WriteBoardWithMessage(msg, qname, sessionID, fmt.Sprintf("ERROR: %s", err.Error()), gameEngine, ttl)
}

// WriteReset writes a game reset response
func WriteReset(msg *dns.Msg, qname string, sessionID SessionID, gameEngine game.Engine, ttl uint32) {
	WriteBoardWithMessage(msg, qname, sessionID, "Game reset!", gameEngine, ttl)
}

// WriteJSON writes a JSON state response
func WriteJSON(msg *dns.Msg, qname string, gameEngine game.Engine, ttl uint32) {
	jsonState := gameEngine.GetStateJSON()
	writeText(msg, qname, jsonState, ttl)
}

// WriteJSONWithSession writes a JSON state response, adjusting status based on player count
func WriteJSONWithSession(msg *dns.Msg, qname string, gameEngine game.Engine, session *game.Session, ttl uint32) {
	state := gameEngine.GetState()

	// Status should only be "playing" when exactly 2 players have joined
	// If less than 2 players, set status to pending (regardless of game engine status)
	if session.GetPlayerCount() < 2 {
		state.Status = game.StatusPending
	}
	// If 2 players have joined, use the game engine's status (playing, X_wins, O_wins, or draw)

	jsonData, _ := json.Marshal(state)
	writeText(msg, qname, string(jsonData), ttl)
}

// WriteHelp writes a help message
func WriteHelp(msg *dns.Msg, qname string, ttl uint32, zone string) {
	zoneExample := strings.TrimSuffix(zone, ".")
	help := fmt.Sprintf(`DNS Tic-Tac-Toe Commands:

Session Management:
- new.%s - Create a new game session
- list.%s - List all active sessions

Game Commands (replace {session-id} with your session ID, {token} with your player token):
- {session-id}.join.%s - Join a session and get your player token
- {session-id}.board.%s - View current board
- {session-id}-{token}-move-ROW-COL.%s - Make a move using your token
- {session-id}.reset.%s - Reset the game
- {session-id}.json.%s - Get board state as JSON
- {session-id}.%s - View board (shortcut)

Example:
1. dig @127.0.0.1 TXT new.%s  # Create session, get ID
2. dig @127.0.0.1 TXT abc123.join.%s  # Join session, get token (assigned X or O)
3. dig @127.0.0.1 TXT abc123-xyz78901-move-1-1.%s  # Make move with token`,
		zoneExample, zoneExample, zoneExample, zoneExample, zoneExample, zoneExample, zoneExample, zoneExample, zoneExample, zoneExample, zoneExample)
	writeText(msg, qname, help, ttl)
}

// WriteInvalidCommand writes an invalid command error with help
func WriteInvalidCommand(msg *dns.Msg, qname string, command string, validCommands []string, ttl uint32) {
	helpText := strings.Join(validCommands, "\n- ")
	response := fmt.Sprintf("ERROR: unknown command: %s\n\nValid commands:\n- %s", command, helpText)
	writeText(msg, qname, response, ttl)
}

// WriteJoinSuccess writes a successful join response
func WriteJoinSuccess(msg *dns.Msg, qname string, sessionID SessionID, token game.PlayerToken, player game.Player, ttl uint32, zone string) {
	zoneExample := strings.TrimSuffix(zone, ".")
	response := fmt.Sprintf("Joined session: %s\nPlayer Token: %s\nYou are playing as: %s\n\nUse your token to make moves:\n%s-%s-move-ROW-COL.%s\n\nExample: %s-%s-move-1-1.%s",
		sessionID, token, player, sessionID, token, zoneExample, sessionID, token, zoneExample)
	writeText(msg, qname, response, ttl)
}

// writeText writes text to the DNS response as a TXT record
// TTL is set to 0 by default (configured via DNS_TTL env var) to prevent caching
// Note: System DNS resolvers may enforce minimum TTL values
// but the server always returns the configured TTL value (0 by default)
func writeText(msg *dns.Msg, qname string, text string, ttl uint32) {
	txt := &dns.TXT{
		Hdr: dns.RR_Header{
			Name:   qname,
			Rrtype: dns.TypeTXT,
			Class:  dns.ClassINET,
			Ttl:    ttl,
		},
		Txt: []string{text},
	}
	msg.Answer = append(msg.Answer, txt)
}
