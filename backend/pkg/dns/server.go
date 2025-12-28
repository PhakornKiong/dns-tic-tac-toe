package dns

import (
	"fmt"
	"log"
	"strings"

	"dns-tic-tac-toe/pkg/game"

	"github.com/miekg/dns"
)

// Server handles DNS queries and translates them into game actions
type Server struct {
	sessionManager *game.Manager
	zone           Zone
	ttl            uint32
}

// NewServer creates a new DNS server that uses the provided session manager
func NewServer(sessionManager *game.Manager, zone string, ttl uint32) *Server {
	return &Server{
		sessionManager: sessionManager,
		zone:           Zone(zone),
		ttl:            ttl,
	}
}

// HandleRequest processes incoming DNS requests
// Note: TTL is set to 0 by default to prevent caching. However, system DNS resolvers
// (like macOS mDNSResponder) may enforce minimum TTL values (e.g., 15s) regardless
// of what the server returns. To see the actual 0 TTL, query the server directly:
// dig @127.0.0.1 TXT example.game.local
func (ds *Server) HandleRequest(w dns.ResponseWriter, r *dns.Msg) {
	m := new(dns.Msg)
	m.SetReply(r)
	m.Authoritative = true

	if len(r.Question) == 0 {
		ds.handleError(m, r, w, ErrEmptyQuery)
		return
	}

	question := r.Question[0]
	qname := strings.ToLower(question.Name)
	qtype := question.Qtype

	// Handle NS queries for the zone
	if qtype == dns.TypeNS {
		// Check if query is for our zone or a subdomain
		zoneNormalized := ds.zone.Normalize()
		qnameNormalized := qname
		if !strings.HasSuffix(qnameNormalized, ".") {
			qnameNormalized += "."
		}

		if strings.HasSuffix(qnameNormalized, zoneNormalized) {
			// Return NS record for the zone
			ds.writeNSRecord(m, qname)
			w.WriteMsg(m)
			return
		}
		// Not our zone, return NXDOMAIN
		m.SetRcode(r, dns.RcodeNameError)
		w.WriteMsg(m)
		return
	}

	// For non-TXT queries that aren't NS, return NODATA (empty answer)
	if qtype != dns.TypeTXT {
		// Check if it's for our zone first
		zoneNormalized := ds.zone.Normalize()
		qnameNormalized := qname
		if !strings.HasSuffix(qnameNormalized, ".") {
			qnameNormalized += "."
		}

		if strings.HasSuffix(qnameNormalized, zoneNormalized) {
			// It's our zone but wrong query type, return empty answer (NODATA)
			w.WriteMsg(m)
			return
		}
		// Not our zone, return NXDOMAIN
		m.SetRcode(r, dns.RcodeNameError)
		w.WriteMsg(m)
		return
	}

	// Parse the query (for TXT queries)
	query, err := ds.parseQuery(qname)
	if err != nil {
		// Not our zone, return NXDOMAIN
		m.SetRcode(r, dns.RcodeNameError)
		w.WriteMsg(m)
		return
	}

	// Log successful zone match
	log.Printf("Handling query: qname=%s, qtype=%d, sessionID=%s, command=%s", qname, qtype, query.SessionID, query.Command)

	// Handle the parsed query
	ds.handleQuery(m, question.Name, query, w)
	w.WriteMsg(m)
}

// parseQuery parses a DNS query and returns a Query struct
func (ds *Server) parseQuery(qname string) (*Query, error) {
	zoneNormalized := ds.zone.Normalize()

	// Normalize qname: ensure it has trailing dot for comparison
	qnameNormalized := qname
	if !strings.HasSuffix(qnameNormalized, ".") {
		qnameNormalized += "."
	}

	// Check if query is for our zone
	if !strings.HasSuffix(qnameNormalized, zoneNormalized) {
		return nil, NewZoneMismatchError(qname, string(ds.zone))
	}

	// Extract subdomain by removing zone suffix
	subdomain := strings.TrimSuffix(qnameNormalized, zoneNormalized)
	subdomain = strings.TrimSuffix(subdomain, ".")

	query := &Query{
		RawQuery: subdomain,
	}

	// Parse the subdomain to extract session ID and command
	ds.parseSubdomain(subdomain, query)

	return query, nil
}

// parseSubdomain parses the subdomain string into session ID and command
func (ds *Server) parseSubdomain(subdomain string, query *Query) {
	// Handle session management commands (no session ID needed)
	cmd := ParseCommand(subdomain)
	if cmd.IsSessionManagement() {
		query.Command = cmd
		return
	}

	// Check for move format: {session-id}-{token}-move-ROW-COL
	// Session ID and token come first, then command
	if strings.Contains(subdomain, "-move-") {
		parts := strings.Split(subdomain, "-")
		// Format: {session-id}-{token}-move-ROW-COL
		// Minimum 5 parts: sessionID, token, "move", row, col
		if len(parts) >= 5 {
			// Find where "move" appears (should be at index 2)
			moveIdx := -1
			for i, part := range parts {
				if part == "move" {
					moveIdx = i
					break
				}
			}
			if moveIdx == 2 && len(parts) >= 5 {
				sessionID := SessionID(parts[0])
				if sessionID.IsValid() {
					query.SessionID = sessionID
					query.PlayerToken = game.PlayerToken(parts[1])
					query.Command = CommandMove

					// Parse move parameters (extract row and col)
					var row, col int
					if _, err := fmt.Sscanf(parts[3], "%d", &row); err == nil {
						if _, err := fmt.Sscanf(parts[4], "%d", &col); err == nil {
							query.MoveParams = &MoveParams{
								Row: row,
								Col: col,
							}
						}
					}
					return
				}
			}
		}
	}

	// Parse session ID and command from subdomain
	// Format: {session-id}.{command}
	parts := strings.Split(subdomain, ".")
	if len(parts) < 2 {
		// Try to parse as session ID only (default to board view)
		sessionID := SessionID(subdomain)
		if sessionID.IsValid() {
			query.SessionID = sessionID
			query.Command = CommandBoard
			return
		}
		// Invalid format
		query.Command = CommandHelp
		return
	}

	// Format: {session-id}.{command}
	sessionID := SessionID(parts[0])
	if !sessionID.IsValid() {
		query.Command = CommandHelp
		return
	}

	query.SessionID = sessionID
	commandStr := strings.Join(parts[1:], ".")

	// Parse command type
	query.Command = ParseCommand(commandStr)

	// If it's a move command, parse the move parameters
	if query.Command == CommandMove {
		moveParams, err := ParseMoveParams(commandStr)
		if err == nil {
			query.MoveParams = moveParams
		} else {
			// Invalid move format, but keep the command as Move for error handling
			query.Command = CommandMove
		}
	}
}

// handleQuery processes a parsed query
func (ds *Server) handleQuery(m *dns.Msg, qname string, query *Query, _ dns.ResponseWriter) {
	if query.IsSessionManagement() {
		ds.handleSessionManagement(m, qname, query)
		return
	}

	if query.IsGameCommand() {
		ds.handleGameCommand(m, qname, query)
		return
	}

	// Invalid query format, show help
	WriteHelp(m, qname, ds.ttl, string(ds.zone))
}

// handleSessionManagement processes session management commands
func (ds *Server) handleSessionManagement(m *dns.Msg, qname string, query *Query) {
	switch query.Command {
	case CommandNew, CommandCreate:
		ds.handleCreateSession(m, qname)

	case CommandList, CommandSessions:
		ds.handleListSessions(m, qname)

	case CommandHelp:
		WriteHelp(m, qname, ds.ttl, string(ds.zone))

	default:
		WriteHelp(m, qname, ds.ttl, string(ds.zone))
	}
}

// handleCreateSession creates a new game session
func (ds *Server) handleCreateSession(m *dns.Msg, qname string) {
	sessionID, err := ds.sessionManager.CreateSession()
	if err != nil {
		dnsErr := NewSessionCreateError(err)
		WriteError(m, qname, dnsErr, ds.ttl)
		return
	}
	WriteSessionCreated(m, qname, SessionID(sessionID), ds.ttl, string(ds.zone))
}

// handleListSessions lists all active sessions
func (ds *Server) handleListSessions(m *dns.Msg, qname string) {
	sessions := ds.sessionManager.ListSessions()
	WriteSessionList(m, qname, sessions, ds.ttl, string(ds.zone))
}

// handleGameCommand processes game commands for a specific session
func (ds *Server) handleGameCommand(m *dns.Msg, qname string, query *Query) {
	// Get the session
	session, err := ds.sessionManager.GetSession(string(query.SessionID))
	if err != nil {
		dnsErr := NewSessionNotFoundError(string(query.SessionID))
		zoneExample := strings.TrimSuffix(string(ds.zone), ".")
		WriteErrorWithContext(m, qname, dnsErr, fmt.Sprintf("\nCreate a new session with: new.%s", zoneExample), ds.ttl, string(ds.zone))
		return
	}

	// Handle different commands
	switch query.Command {
	case CommandJoin:
		ds.handleJoinCommand(m, qname, query.SessionID, session)

	case CommandBoard, CommandStatus:
		ds.handleBoardCommand(m, qname, query.SessionID, session)

	case CommandMove:
		ds.handleMoveCommand(m, qname, query, session)

	case CommandReset:
		ds.handleResetCommand(m, qname, query.SessionID, session)

	case CommandJSON:
		ds.handleJSONCommand(m, qname, session)

	default:
		validCommands := []string{"join", "board", "reset", "json"}
		WriteInvalidCommand(m, qname, query.RawQuery, validCommands, ds.ttl)
	}
}

// handleBoardCommand handles board view commands
func (ds *Server) handleBoardCommand(m *dns.Msg, qname string, sessionID SessionID, session *game.Session) {
	WriteBoard(m, qname, sessionID, session.Game, ds.ttl)
}

// handleResetCommand handles reset commands
func (ds *Server) handleResetCommand(m *dns.Msg, qname string, sessionID SessionID, session *game.Session) {
	session.Game.Reset()
	// After reset, if both players are still in, start the game
	if session.GetPlayerCount() == 2 {
		session.Game.StartGame()
	}
	WriteReset(m, qname, sessionID, session.Game, ds.ttl)
}

// handleJSONCommand handles JSON state commands
func (ds *Server) handleJSONCommand(m *dns.Msg, qname string, session *game.Session) {
	WriteJSONWithSession(m, qname, session.Game, session, ds.ttl)
}

// writeNSRecord writes an NS record for the zone
func (ds *Server) writeNSRecord(m *dns.Msg, qname string) {
	// Get the zone name (without trailing dot for NS record)
	zoneName := strings.TrimSuffix(string(ds.zone), ".")
	if zoneName == "" {
		zoneName = "game.local"
	}

	// Use localhost as the name server (or could use the actual server hostname)
	nsName := "localhost."

	ns := &dns.NS{
		Hdr: dns.RR_Header{
			Name:   qname,
			Rrtype: dns.TypeNS,
			Class:  dns.ClassINET,
			Ttl:    ds.ttl,
		},
		Ns: nsName,
	}
	m.Answer = append(m.Answer, ns)
}

// handleError handles DNS errors
func (ds *Server) handleError(m *dns.Msg, r *dns.Msg, w dns.ResponseWriter, err *Error) {
	m.SetRcode(r, dns.RcodeFormatError)
	w.WriteMsg(m)
}

// handleJoinCommand processes a join command
func (ds *Server) handleJoinCommand(m *dns.Msg, qname string, sessionID SessionID, session *game.Session) {
	token, player, err := session.JoinSession()
	if err != nil {
		WriteError(m, qname, err, ds.ttl)
		return
	}
	WriteJoinSuccess(m, qname, sessionID, token, player, ds.ttl, string(ds.zone))
}

// handleMoveCommand processes a move command from the DNS query
func (ds *Server) handleMoveCommand(m *dns.Msg, qname string, query *Query, session *game.Session) {
	// Validate move parameters
	if query.MoveParams == nil || !query.MoveParams.IsValid() {
		dnsErr := NewInvalidMoveFormatError(query.RawQuery)
		WriteError(m, qname, dnsErr, ds.ttl)
		return
	}

	// Check if both players have joined
	if session.GetPlayerCount() < 2 {
		WriteError(m, qname, fmt.Errorf("waiting for players to join (need 2 players)"), ds.ttl)
		return
	}

	// Get player from token
	playerToken := query.PlayerToken
	if playerToken == "" {
		WriteError(m, qname, fmt.Errorf("player token is required"), ds.ttl)
		return
	}

	player, err := session.GetPlayer(playerToken)
	if err != nil {
		WriteError(m, qname, err, ds.ttl)
		return
	}

	// Execute the move
	err = session.Game.MakeMove(query.MoveParams.Row, query.MoveParams.Col, player)
	if err != nil {
		WriteMoveError(m, qname, query.SessionID, err, session.Game, ds.ttl)
	} else {
		WriteMoveAccepted(m, qname, query.SessionID, session.Game, ds.ttl)
	}
}
