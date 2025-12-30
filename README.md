# DNS Tic-Tac-Toe

A tic-tac-toe game played over DNS queries. The backend maintains all game logic and uses DNS TXT queries as the request-response cycle. The frontend provides a web interface that translates user actions into DNS queries.

**Try it live**: [https://dns-tic-tac-toe.phakorn.com/](https://dns-tic-tac-toe.phakorn.com/)

![DNS Tic-Tac-Toe Frontend](dns-tic-tac-toe.png)

## Architecture

- **Backend**: Go-based DNS server that maintains all game logic and processes game commands via DNS TXT queries. All game state and rules are handled server-side, with DNS TXT queries serving as both requests and responses.
- **Frontend**: Next.js web application that provides a user-friendly interface and translates user interactions into DNS TXT queries

### Web Interface

1. Create a new game session or join an existing one using the session ID
2. Join the game to get assigned a player token (X or O)
3. Make moves by clicking on the board
4. Share the invite link with another player to play together

### DNS Commands

The game is built on DNS TXT queries as the request-response mechanism. You can play directly using DNS queries with `dig`. Note that `game.local` is just the default DNS zone - you can configure any DNS zone you want (see Configuration section).

**Examples with default zone (`game.local`):**
- Create a new session: `dig @127.0.0.1 TXT new.game.local`
- Join a session: `dig @127.0.0.1 TXT {session-id}.join.game.local`
- View board: `dig @127.0.0.1 TXT {session-id}.board.game.local`
- Make a move: `dig @127.0.0.1 TXT {session-id}-{token}-move-ROW-COL.game.local`
- Reset game: `dig @127.0.0.1 TXT {session-id}.reset.game.local`

**Example with custom zone (`tictactoe.phakorn.com`):**
- Create a new session: `dig TXT new.tictactoe.phakorn.com`
- Join a session: `dig TXT {session-id}.join.tictactoe.phakorn.com`
- View board: `dig TXT {session-id}.board.tictactoe.phakorn.com`
- Make a move: `dig TXT {session-id}-{token}-move-ROW-COL.tictactoe.phakorn.com`
- Reset game: `dig TXT {session-id}.reset.tictactoe.phakorn.com`

<details>
<summary><strong>Example output:</strong></summary>

```bash
$ dig TXT new.tictactoe.phakorn.com

; <<>> DiG 9.10.6 <<>> TXT new.tictactoe.phakorn.com
;; global options: +cmd
;; Got answer:
;; ->>HEADER<<- opcode: QUERY, status: NOERROR, id: 26777
;; flags: qr rd ra; QUERY: 1, ANSWER: 1, AUTHORITY: 0, ADDITIONAL: 1

;; OPT PSEUDOSECTION:
; EDNS: version: 0, flags:; udp: 1232
;; QUESTION SECTION:
;new.tictactoe.phakorn.com.	IN	TXT

;; ANSWER SECTION:
new.tictactoe.phakorn.com. 0	IN	TXT	"New session created!\010Session ID: 66ca9014\010\010Use this ID in your queries:\010- 66ca9014.board.tictactoe.phakorn.com\010- 66ca9014.move-1-2-X.tictactoe.phakorn.com\010- 66ca9014.reset.tictactoe.phakorn.com"

;; Query time: 24 msec
;; SERVER: 100.100.100.100#53(100.100.100.100)
;; WHEN: Wed Dec 31 06:58:32 +08 2025
;; MSG SIZE  rcvd: 260
```
</details>

## Configuration

The backend can be configured using environment variables:

- `DNS_ZONE`: DNS zone name (default: `game.local`)
- `DNS_PORT`: Port to listen on (default: `53`)
- `DNS_TTL`: TTL for DNS responses (default: `0`)
- `SESSION_MAX_AGE`: Maximum age for game sessions (default: `120s`)
- `SESSION_CLEANUP_INTERVAL`: Interval for cleaning up old sessions (default: `120s`)

