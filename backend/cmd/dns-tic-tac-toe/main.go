package main

import (
	"fmt"
	"log"
	"strings"
	"time"

	dnsgame "dns-tic-tac-toe/pkg/dns"
	"dns-tic-tac-toe/pkg/game"

	"github.com/caarlos0/env/v11"
	"github.com/miekg/dns"
)

// Config holds all configuration values loaded from environment variables
type Config struct {
	// DNS Server Configuration
	DNSZone    string `env:"DNS_ZONE" envDefault:"game.local"`
	DNSPort    string `env:"DNS_PORT" envDefault:"53"`
	DNSTTL     uint32 `env:"DNS_TTL" envDefault:"0"`
	NSHostname string `env:"NS_HOSTNAME" envDefault:"localhost"`
	NSIP       string `env:"NS_IP" envDefault:"127.0.0.1"`

	// Session Management Configuration
	SessionIDLength   int `env:"SESSION_ID_LENGTH" envDefault:"8"`
	PlayerTokenLength int `env:"PLAYER_TOKEN_LENGTH" envDefault:"8"`

	// Session Cleanup Configuration
	SessionMaxAge          time.Duration `env:"SESSION_MAX_AGE" envDefault:"120s"`
	SessionCleanupInterval time.Duration `env:"SESSION_CLEANUP_INTERVAL" envDefault:"120s"`
}

func main() {
	// Load configuration from environment variables
	var cfg Config
	if err := env.Parse(&cfg); err != nil {
		log.Fatalf("Failed to parse configuration: %v", err)
	}

	// Normalize zone (ensure trailing dot)
	zone := cfg.DNSZone
	if !strings.HasSuffix(zone, ".") {
		zone += "."
	}

	// Normalize port (ensure leading colon)
	port := cfg.DNSPort
	if !strings.HasPrefix(port, ":") {
		port = ":" + port
	}

	// Create session manager with config using functional options
	sessionManager := game.NewManager(
		game.WithSessionIDLength(cfg.SessionIDLength),
		game.WithPlayerTokenLength(cfg.PlayerTokenLength),
	)

	// Start session cleanup goroutine
	go func() {
		ticker := time.NewTicker(cfg.SessionCleanupInterval)
		defer ticker.Stop()
		for range ticker.C {
			sessionManager.CleanupOldSessions(cfg.SessionMaxAge)
		}
	}()

	// Create DNS server that uses the session manager and config
	dnsServer := dnsgame.NewServer(sessionManager, zone, cfg.DNSTTL, cfg.NSHostname, cfg.NSIP)

	// Setup DNS server - handle all queries and check zone in handler
	dns.HandleFunc(".", dnsServer.HandleRequest)

	// Start UDP server
	udpServer := &dns.Server{
		Addr:    port,
		Net:     "udp",
		Handler: dns.DefaultServeMux,
	}

	// Start TCP server
	tcpServer := &dns.Server{
		Addr:    port,
		Net:     "tcp",
		Handler: dns.DefaultServeMux,
	}

	fmt.Println("DNS Tic-Tac-Toe Server starting...")
	fmt.Println("Zone:", zone)
	fmt.Printf("Listening on %s (UDP and TCP)\n", port)

	portFlag := ""
	if port != ":53" {
		portFlag = fmt.Sprintf(" -p %s", strings.TrimPrefix(port, ":"))
	}

	// Get zone without trailing dot for examples
	zoneExample := strings.TrimSuffix(zone, ".")

	fmt.Println("\nExample commands:")
	fmt.Println("\n1. Create a new game session:")
	fmt.Printf("   dig @127.0.0.1%s TXT new.%s\n", portFlag, zoneExample)
	fmt.Println("\n2. Join the session (each player must join to get a token):")
	fmt.Printf("   dig @127.0.0.1%s TXT {session-id}.join.%s\n", portFlag, zoneExample)
	fmt.Println("   First player gets X, second player gets O")
	fmt.Println("\n3. View the board (replace {session-id} with your session ID):")
	fmt.Printf("   dig @127.0.0.1%s TXT {session-id}.board.%s\n", portFlag, zoneExample)
	fmt.Println("   Or use the shortcut:")
	fmt.Printf("   dig @127.0.0.1%s TXT {session-id}.%s\n", portFlag, zoneExample)
	fmt.Println("\n4. Make a move using your token:")
	fmt.Printf("   dig @127.0.0.1%s TXT {session-id}-{token}-move-ROW-COL.%s\n", portFlag, zoneExample)
	fmt.Println("   (Format: {session-id}-{token}-move-ROW-COL, e.g., abc123-xyz78901-move-1-1)")
	fmt.Println("\n5. Reset the game:")
	fmt.Printf("   dig @127.0.0.1%s TXT {session-id}.reset.%s\n", portFlag, zoneExample)
	fmt.Println("\n6. Get JSON state:")
	fmt.Printf("   dig @127.0.0.1%s TXT {session-id}.json.%s\n", portFlag, zoneExample)
	fmt.Println("\n7. List all active sessions:")
	fmt.Printf("   dig @127.0.0.1%s TXT list.%s\n", portFlag, zoneExample)
	fmt.Println("\n8. Show help:")
	fmt.Printf("   dig @127.0.0.1%s TXT help.%s\n", portFlag, zoneExample)
	fmt.Println("\nExample game flow:")
	fmt.Printf("  1. dig @127.0.0.1%s TXT new.%s                    # Create session\n", portFlag, zoneExample)
	fmt.Printf("  2. dig @127.0.0.1%s TXT abc123.join.%s            # Player 1 joins (gets X)\n", portFlag, zoneExample)
	fmt.Printf("  3. dig @127.0.0.1%s TXT abc123.join.%s            # Player 2 joins (gets O)\n", portFlag, zoneExample)
	fmt.Printf("  4. dig @127.0.0.1%s TXT abc123.board.%s           # View board\n", portFlag, zoneExample)
	fmt.Printf("  5. dig @127.0.0.1%s TXT abc123-xyz78901-move-1-1.%s  # Player 1 moves\n", portFlag, zoneExample)
	fmt.Printf("  6. dig @127.0.0.1%s TXT abc123-abc12345-move-0-0.%s  # Player 2 moves\n", portFlag, zoneExample)
	fmt.Println("  ... continue until someone wins!")

	// Start servers in goroutines
	go func() {
		if err := udpServer.ListenAndServe(); err != nil {
			log.Fatalf("Failed to start UDP server: %v", err)
		}
	}()

	if err := tcpServer.ListenAndServe(); err != nil {
		log.Fatalf("Failed to start TCP server: %v", err)
	}
}
