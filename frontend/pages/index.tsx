import { useState, useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { DNSQueryDisplay, DNSQuery } from '@/components/dns-query-display';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Gamepad2, X, Circle, Copy, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ThemeToggle } from '@/components/theme-toggle';

type Player = 'X' | 'O' | '';
type Status = 'pending' | 'playing' | 'X_wins' | 'O_wins' | 'draw';

interface GameState {
  board: Player[][];
  turn: Player;
  status: Status;
}

// DNS configuration - use NEXT_PUBLIC_ prefixed vars for client-side access
// Fall back to same defaults used in API routes
const ZONE = process.env.NEXT_PUBLIC_DNS_ZONE || 'game.local';
const DNS_HOST = process.env.NEXT_PUBLIC_DNS_HOST || '127.0.0.1';
const DNS_PORT = parseInt(process.env.NEXT_PUBLIC_DNS_PORT || '53', 10);

export default function Home() {
  const router = useRouter();
  const [sessionId, setSessionId] = useState<string>('');
  const [newSessionId, setNewSessionId] = useState<string>('');
  const [playerToken, setPlayerToken] = useState<string>('');
  const [player, setPlayer] = useState<Player>('');
  const [gameState, setGameState] = useState<GameState>({
    board: [['', '', ''], ['', '', ''], ['', '', '']],
    turn: 'X',
    status: 'playing',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [dnsQueries, setDnsQueries] = useState<DNSQuery[]>([]);
  const [linkCopied, setLinkCopied] = useState(false);
  const [autoJoinAttempted, setAutoJoinAttempted] = useState(false);
  const [inviteUrl, setInviteUrl] = useState<string>('');

  const addDNSQuery = (query: string, type: DNSQuery['type'], response?: string) => {
    const newQuery: DNSQuery = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      query,
      response,
      timestamp: new Date(),
      type,
    };
    setDnsQueries((prev) => [...prev, newQuery]);
  };

  const updateLastDNSQuery = (response: string) => {
    setDnsQueries((prev) => {
      if (prev.length === 0) return prev;
      const updated = [...prev];
      updated[updated.length - 1] = { ...updated[updated.length - 1], response };
      return updated;
    });
  };

  const createOrJoinSession = async () => {
    setLoading(true);
    setError('');

    try {
      if (newSessionId) {
        // Join existing session
        setSessionId(newSessionId);
        // The refreshBoard will handle adding the query and capturing the response
        await refreshBoard();
      } else {
        // Create new session
        addDNSQuery(`new.${ZONE}`, 'new');
        const response = await fetch('/api/sessions/new', {
          method: 'POST',
        });
        const data = await response.json();
        if (!response.ok) {
          if (data.dns_response) {
            updateLastDNSQuery(data.dns_response);
          }
          throw new Error(data.error || 'Failed to create session');
        }
        if (data.dns_response) {
          updateLastDNSQuery(data.dns_response);
        }
        const newSessionId = data.session_id;
        setSessionId(newSessionId);
        addDNSQuery(`${newSessionId}.board.${ZONE}`, 'board');
        await refreshBoard();
        
        // Auto-join the newly created session
        addDNSQuery(`${newSessionId}.join.${ZONE}`, 'join');
        const joinResponse = await fetch(`/api/sessions/${newSessionId}/join`, {
          method: 'POST',
        });
        const joinData = await joinResponse.json();
        if (!joinResponse.ok) {
          if (joinData.dns_response) {
            updateLastDNSQuery(joinData.dns_response);
          }
          // Don't throw error, just log it - user can still manually join
          console.error('Auto-join failed:', joinData.error);
        } else {
          if (joinData.dns_response) {
            updateLastDNSQuery(joinData.dns_response);
          }
          setPlayerToken(joinData.player_token);
          setPlayer(joinData.player as Player);
          addDNSQuery(`${newSessionId}.board.${ZONE}`, 'board');
          await refreshBoard();
        }
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const joinSession = async () => {
    if (!sessionId) return;

    setLoading(true);
    setError('');

    try {
      addDNSQuery(`${sessionId}.join.${ZONE}`, 'join');
      const response = await fetch(`/api/sessions/${sessionId}/join`, {
        method: 'POST',
      });
      const data = await response.json();
      if (!response.ok) {
        if (data.dns_response) {
          updateLastDNSQuery(data.dns_response);
        }
        throw new Error(data.error || 'Failed to join session');
      }
      if (data.dns_response) {
        updateLastDNSQuery(data.dns_response);
      }
      setPlayerToken(data.player_token);
      setPlayer(data.player as Player);
      addDNSQuery(`${sessionId}.board.${ZONE}`, 'board');
      await refreshBoard();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const makeMove = async (row: number, col: number) => {
    if (!playerToken || gameState.status !== 'playing' || gameState.turn !== player) {
      return;
    }

    if (gameState.board[row][col] !== '') {
      return;
    }

    setLoading(true);
    setError('');

    try {
      const query = `${sessionId}-${playerToken}-move-${row}-${col}.${ZONE}`;
      addDNSQuery(query, 'move');
      const response = await fetch(`/api/sessions/${sessionId}/move`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token: playerToken,
          row,
          col,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        if (data.dns_response) {
          updateLastDNSQuery(data.dns_response);
        }
        throw new Error(data.error || 'Invalid move');
      }
      if (data.dns_response) {
        updateLastDNSQuery(data.dns_response);
      }
      setGameState({
        board: data.board,
        turn: data.turn,
        status: data.status,
      });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const refreshBoard = async () => {
    if (!sessionId) return;

    setLoading(true);
    setError('');

    try {
      addDNSQuery(`${sessionId}.json.${ZONE}`, 'board');
      const response = await fetch(`/api/sessions/${sessionId}/board`);
      const data = await response.json();
      if (!response.ok) {
        if (data.dns_response) {
          updateLastDNSQuery(data.dns_response);
        }
        throw new Error(data.error || 'Failed to fetch board');
      }
      if (data.dns_response) {
        updateLastDNSQuery(data.dns_response);
      }
      setGameState({
        board: data.board,
        turn: data.turn,
        status: data.status,
      });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const resetGame = async () => {
    if (!sessionId) return;

    setLoading(true);
    setError('');

    try {
      addDNSQuery(`${sessionId}.reset.${ZONE}`, 'reset');
      const response = await fetch(`/api/sessions/${sessionId}/reset`, {
        method: 'POST',
      });
      const data = await response.json();
      if (!response.ok) {
        if (data.dns_response) {
          updateLastDNSQuery(data.dns_response);
        }
        throw new Error(data.error || 'Failed to reset game');
      }
      if (data.dns_response) {
        updateLastDNSQuery(data.dns_response);
      }
      setGameState({
        board: data.board,
        turn: data.turn,
        status: data.status,
      });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const leaveSession = () => {
    setSessionId('');
    setPlayerToken('');
    setPlayer('');
    setGameState({
      board: [['', '', ''], ['', '', ''], ['', '', '']],
      turn: 'X',
      status: 'playing',
    });
    setError('');
    setNewSessionId('');
  };

  const getStatusText = () => {
    switch (gameState.status) {
      case 'pending':
        return 'Waiting for players to join...';
      case 'playing':
        return `Current Turn: ${gameState.turn}`;
      case 'X_wins':
        return '🎉 X Wins!';
      case 'O_wins':
        return '🎉 O Wins!';
      case 'draw':
        return "It's a Draw!";
      default:
        return gameState.status;
    }
  };

  const getStatusVariant = () => {
    switch (gameState.status) {
      case 'pending':
        return 'secondary';
      case 'playing':
        return 'default';
      case 'X_wins':
        return 'destructive';
      case 'O_wins':
        return 'default';
      case 'draw':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  const getInviteUrl = () => {
    if (!sessionId || typeof window === 'undefined') return '';
    return `${window.location.origin}${window.location.pathname}?session=${sessionId}&autoJoin=true`;
  };

  const copyShareLink = async () => {
    if (!sessionId) return;
    
    const shareUrl = getInviteUrl();
    if (!shareUrl) return;
    
    try {
      await navigator.clipboard.writeText(shareUrl);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    } catch (err) {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = shareUrl;
      textArea.style.position = 'fixed';
      textArea.style.opacity = '0';
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand('copy');
        setLinkCopied(true);
        setTimeout(() => setLinkCopied(false), 2000);
      } catch (fallbackErr) {
        console.error('Failed to copy link:', fallbackErr);
      }
      document.body.removeChild(textArea);
    }
  };

  // Update invite URL when sessionId changes
  useEffect(() => {
    if (sessionId && typeof window !== 'undefined') {
      const url = `${window.location.origin}${window.location.pathname}?session=${sessionId}&autoJoin=true`;
      setInviteUrl(url);
    } else {
      setInviteUrl('');
    }
  }, [sessionId]);

  // Handle auto-join from URL parameters
  useEffect(() => {
    if (autoJoinAttempted || !router.isReady || sessionId) return;

    const { session, autoJoin } = router.query;
    
    if (session && typeof session === 'string' && autoJoin === 'true') {
      setAutoJoinAttempted(true);
      const targetSessionId = session;
      setSessionId(targetSessionId);
      setNewSessionId(targetSessionId);
      
      // Small delay to ensure state is set before joining
      const joinFlow = async () => {
        // First, check if session exists by fetching board
        try {
          const response = await fetch(`/api/sessions/${targetSessionId}/board`);
          const data = await response.json();
          if (response.ok) {
            // Session exists, now auto-join
            addDNSQuery(`${targetSessionId}.join.${ZONE}`, 'join');
            const joinResponse = await fetch(`/api/sessions/${targetSessionId}/join`, {
              method: 'POST',
            });
            const joinData = await joinResponse.json();
            if (joinResponse.ok && joinData.dns_response) {
              updateLastDNSQuery(joinData.dns_response);
              setPlayerToken(joinData.player_token);
              setPlayer(joinData.player as Player);
              await refreshBoard();
              // Clean up URL by removing query parameters
              router.replace(window.location.pathname, undefined, { shallow: true });
            } else {
              if (joinData.dns_response) {
                updateLastDNSQuery(joinData.dns_response);
              }
              setError(joinData.error || 'Failed to auto-join session');
            }
          } else {
            setError(data.error || 'Session not found');
          }
        } catch (err: any) {
          setError(err.message || 'Failed to auto-join session');
        }
      };
      
      setTimeout(joinFlow, 300);
    }
  }, [router.isReady, router.query, autoJoinAttempted, sessionId]);

  // Auto-refresh board every 2 seconds when in a session
  useEffect(() => {
    if (!sessionId || !playerToken) return;

    const interval = setInterval(() => {
      refreshBoard();
    }, 2000);

    return () => clearInterval(interval);
  }, [sessionId, playerToken]);

  return (
    <>
      <Head>
        <title>DNS Tic-Tac-Toe</title>
        <meta name="description" content="Play tic-tac-toe via DNS!" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                const stored = localStorage.getItem('theme');
                const shouldBeDark = stored ? stored === 'dark' : true;
                if (shouldBeDark) {
                  document.documentElement.classList.add('dark');
                }
              })();
            `,
          }}
        />
      </Head>
      <main className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 p-6 transition-colors">
        {/* Theme Toggle - Fixed Top Right */}
        <div className="fixed top-4 right-4 z-50">
          <ThemeToggle />
        </div>
        <div className="max-w-7xl mx-auto h-[calc(100vh-3rem)] flex gap-6">
          {/* Main Game Area */}
          <div className="flex-1 flex flex-col">
            <Card className="flex-1 shadow-lg border-0">
              <CardHeader className="pb-4 border-b">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <Gamepad2 className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-2xl font-bold tracking-tight">DNS Tic-Tac-Toe</CardTitle>
                    <CardDescription className="mt-1 text-sm">
                      Play tic-tac-toe using DNS queries
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-8 pt-6">
                {/* Session Management */}
                {!sessionId && (
                  <div className="space-y-5">
                    <div>
                      <h2 className="text-lg font-semibold text-foreground mb-1">Create or Join Game</h2>
                      <p className="text-sm text-muted-foreground">Start a new session or join an existing one</p>
                    </div>
                    <div className="flex gap-3">
                      <Input
                        type="text"
                        value={newSessionId}
                        onChange={(e) => setNewSessionId(e.target.value)}
                        placeholder="Enter session ID (or leave empty to create new)"
                        className="flex-1 h-11"
                        onKeyDown={(e) => e.key === 'Enter' && createOrJoinSession()}
                      />
                      <Button
                        onClick={createOrJoinSession}
                        disabled={loading}
                        className="h-11 px-6"
                      >
                        {loading ? '...' : 'Continue'}
                      </Button>
                    </div>
                    {error && (
                      <Alert variant="destructive" className="mt-4">
                        <AlertDescription className="text-sm">{error}</AlertDescription>
                      </Alert>
                    )}
                  </div>
                )}

                {/* Game Section */}
                {sessionId && (
                  <div className="space-y-6">
                    <div className="flex items-center justify-between pb-4 border-b">
                      <div>
                        <h2 className="text-lg font-semibold text-foreground mb-1">Game Session</h2>
                        <p className="text-sm text-muted-foreground">Session ID</p>
                      </div>
                      <Badge variant="outline" className="text-sm font-mono px-3 py-1.5 bg-muted/50">
                        {sessionId}
                      </Badge>
                    </div>

                    {/* Player Info */}
                    {playerToken && (
                      <div className="flex items-center justify-between p-4 bg-gradient-to-r from-primary/5 to-primary/10 dark:from-primary/10 dark:to-primary/20 rounded-lg border border-primary/20 dark:border-primary/30">
                        <div className="flex items-center gap-3">
                          <Badge
                            variant={player === 'X' ? 'destructive' : 'default'}
                            className="text-sm font-semibold px-3 py-1"
                          >
                            Player {player}
                          </Badge>
                          <span className="text-xs text-muted-foreground font-mono">
                            {playerToken}
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Join Button */}
                    {!playerToken && (
                      <Button
                        onClick={joinSession}
                        disabled={loading}
                        className="w-full h-11 text-base font-medium"
                        size="lg"
                      >
                        {loading ? 'Joining...' : 'Join Game'}
                      </Button>
                    )}

                    {/* Invite Link Bar - Show when pending */}
                    {gameState.status === 'pending' && (
                      <Alert className="bg-gradient-to-r from-primary/5 to-primary/10 dark:from-primary/10 dark:to-primary/20 border-primary/20 dark:border-primary/30">
                        <div className="flex items-center justify-between gap-4 w-full">
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-semibold text-foreground mb-1.5">
                              Invite Link
                            </div>
                            <div className="flex items-center gap-2">
                              <code className="text-xs font-mono text-muted-foreground bg-background/50 dark:bg-background/30 px-2.5 py-1.5 rounded border border-border/50 truncate flex-1">
                                {inviteUrl || 'Generating link...'}
                              </code>
                              <Button
                                onClick={copyShareLink}
                                variant="outline"
                                size="sm"
                                className="shrink-0 h-8 px-3"
                                disabled={loading || !sessionId || !inviteUrl}
                              >
                                {linkCopied ? (
                                  <>
                                    <Check className="h-3.5 w-3.5 mr-1.5" />
                                    Copied
                                  </>
                                ) : (
                                  <>
                                    <Copy className="h-3.5 w-3.5 mr-1.5" />
                                    Copy
                                  </>
                                )}
                              </Button>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1.5">
                              Share this link with another player - they'll automatically join when they open it
                            </p>
                          </div>
                        </div>
                      </Alert>
                    )}

                    {/* Game Status */}
                    <div className="text-center py-2">
                      <Badge variant={getStatusVariant()} className="text-sm font-semibold px-4 py-2">
                        {getStatusText()}
                      </Badge>
                    </div>

                    {/* Game Board */}
                    <div className="flex justify-center py-4">
                      <div className="grid grid-cols-3 gap-4 p-6 bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-inner">
                        {gameState.board.map((row, rowIdx) =>
                          row.map((cell, colIdx) => {
                            const isDisabled =
                              cell !== '' ||
                              gameState.status !== 'playing' ||
                              gameState.turn !== player ||
                              !playerToken;
                            
                            return (
                              <button
                                key={`${rowIdx}-${colIdx}`}
                                className={cn(
                                  "aspect-square w-28 h-28 rounded-xl border-2 bg-white dark:bg-slate-800 shadow-sm flex items-center justify-center transition-all duration-200",
                                  cell === 'X' && "border-red-300 dark:border-red-600 text-red-600 dark:text-red-400 shadow-red-100 dark:shadow-red-900/20",
                                  cell === 'O' && "border-blue-300 dark:border-blue-600 text-blue-600 dark:text-blue-400 shadow-blue-100 dark:shadow-blue-900/20",
                                  !isDisabled && !cell && "border-slate-200 dark:border-slate-700 hover:border-primary hover:bg-primary/5 dark:hover:bg-primary/10 hover:shadow-md hover:scale-105 cursor-pointer active:scale-95",
                                  isDisabled && !cell && "border-slate-100 dark:border-slate-800 opacity-40 cursor-not-allowed",
                                  cell && "shadow-md"
                                )}
                                onClick={() => makeMove(rowIdx, colIdx)}
                                disabled={isDisabled}
                              >
                                {cell === 'X' ? (
                                  <X className="h-14 w-14 stroke-[3]" />
                                ) : cell === 'O' ? (
                                  <Circle className="h-14 w-14 stroke-[3]" />
                                ) : (
                                  <span className="text-slate-300 dark:text-slate-600 text-2xl font-light">_</span>
                                )}
                              </button>
                            );
                          })
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-3 justify-center pt-2">
                      <Button
                        onClick={refreshBoard}
                        disabled={loading}
                        variant="outline"
                        className="h-10"
                      >
                        Refresh
                      </Button>
                      <Button
                        onClick={resetGame}
                        disabled={loading || gameState.status === 'playing'}
                        variant="outline"
                        className="h-10"
                      >
                        Reset
                      </Button>
                      <Button
                        onClick={leaveSession}
                        disabled={loading}
                        variant="outline"
                        className="h-10"
                      >
                        Leave
                      </Button>
                    </div>

                    {error && (
                      <Alert variant="destructive" className="mt-4">
                        <AlertDescription className="text-sm">{error}</AlertDescription>
                      </Alert>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* DNS Query Sidebar */}
          <div className="w-[420px] flex-shrink-0">
            <DNSQueryDisplay
              queries={dnsQueries}
              onClear={() => setDnsQueries([])}
              dnsHost={DNS_HOST}
              dnsPort={DNS_PORT}
              dnsZone={ZONE}
            />
          </div>
        </div>
      </main>
    </>
  );
}
