/**
 * Cloudflare Worker Entry Point
 * Handles routing for DNS Tic-Tac-Toe API
 */

import { queryTXT, parseError, parseJSONResponse } from './lib/dns-client';

const ZONE = 'tictactoe'; // Will be overridden by env var

export interface Env {
  DNS_ZONE?: string;
  DNS_HOST?: string;
  DNS_PORT?: string;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // Get DNS configuration from environment
    const dnsZone = env.DNS_ZONE || ZONE;
    const dnsHost = env.DNS_HOST || 'phakorn.com';
    const dnsPort = parseInt(env.DNS_PORT || '53', 10);
    
    // Set DNS server for this request (Workers don't have global process.env)
    // We'll pass host/port to each queryTXT call

    // Route handling
    try {
      // POST /api/sessions/new - Create new session
      if (path === '/api/sessions/new' && request.method === 'POST') {
        return await handleNewSession(dnsZone, dnsHost, dnsPort, corsHeaders);
      }

      // GET /api/sessions/list - List sessions
      if (path === '/api/sessions/list' && request.method === 'GET') {
        return await handleListSessions(dnsZone, dnsHost, dnsPort, corsHeaders);
      }

      // GET /api/sessions/:sessionId/board - Get board state
      const boardMatch = path.match(/^\/api\/sessions\/([^/]+)\/board$/);
      if (boardMatch && request.method === 'GET') {
        const sessionId = boardMatch[1];
        return await handleGetBoard(sessionId, dnsZone, dnsHost, dnsPort, corsHeaders);
      }

      // POST /api/sessions/:sessionId/join - Join session
      const joinMatch = path.match(/^\/api\/sessions\/([^/]+)\/join$/);
      if (joinMatch && request.method === 'POST') {
        const sessionId = joinMatch[1];
        return await handleJoinSession(sessionId, dnsZone, dnsHost, dnsPort, corsHeaders);
      }

      // POST /api/sessions/:sessionId/move - Make a move
      const moveMatch = path.match(/^\/api\/sessions\/([^/]+)\/move$/);
      if (moveMatch && request.method === 'POST') {
        const sessionId = moveMatch[1];
        const body = await request.json();
        return await handleMakeMove(sessionId, body, dnsZone, dnsHost, dnsPort, corsHeaders);
      }

      // POST /api/sessions/:sessionId/reset - Reset game
      const resetMatch = path.match(/^\/api\/sessions\/([^/]+)\/reset$/);
      if (resetMatch && request.method === 'POST') {
        const sessionId = resetMatch[1];
        return await handleResetGame(sessionId, dnsZone, dnsHost, dnsPort, corsHeaders);
      }

      // 404 for unknown routes
      return new Response(JSON.stringify({ error: 'Not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } catch (error: any) {
      return new Response(JSON.stringify({ error: error.message || 'Internal server error' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  },
};

// Handler functions
async function handleNewSession(
  zone: string,
  host: string,
  port: number,
  corsHeaders: Record<string, string>
): Promise<Response> {
  try {
    const dnsResponse = await queryTXT(`new.${zone}`, { host, port });
    const error = parseError(dnsResponse);
    if (error) {
      return new Response(JSON.stringify({ error, dns_response: dnsResponse }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const sessionIdMatch = dnsResponse.match(/Session ID: (\w+)/);
    if (!sessionIdMatch) {
      return new Response(JSON.stringify({ error: 'Failed to parse session ID', dns_response: dnsResponse }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(
      JSON.stringify({
        session_id: sessionIdMatch[1],
        message: 'Session created successfully',
        dns_response: dnsResponse,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message || 'DNS query failed' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}

async function handleListSessions(
  zone: string,
  host: string,
  port: number,
  corsHeaders: Record<string, string>
): Promise<Response> {
  try {
    const response = await queryTXT(`list.${zone}`, { host, port });
    const error = parseError(response);
    if (error) {
      return new Response(JSON.stringify({ error }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const lines = response.split('\n');
    const sessions: string[] = [];
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('Active sessions')) {
        sessions.push(trimmed);
      }
    }

    return new Response(
      JSON.stringify({
        sessions,
        count: sessions.length,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message || 'DNS query failed' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}

async function handleGetBoard(
  sessionId: string,
  zone: string,
  host: string,
  port: number,
  corsHeaders: Record<string, string>
): Promise<Response> {
  try {
    const jsonResponse = await queryTXT(`${sessionId}.json.${zone}`, { host, port });
    const error = parseError(jsonResponse);
    if (error) {
      return new Response(JSON.stringify({ error, dns_response: jsonResponse }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const jsonData = parseJSONResponse(jsonResponse);
    if (jsonData) {
      return new Response(
        JSON.stringify({
          board: jsonData.board,
          turn: jsonData.turn,
          status: jsonData.status,
          dns_response: jsonResponse,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Fallback
    const boardResponse = await queryTXT(`${sessionId}.board.${zone}`, { host, port });
    const boardError = parseError(boardResponse);
    if (boardError) {
      return new Response(JSON.stringify({ error: boardError, dns_response: boardResponse }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(
      JSON.stringify({
        board: [['', '', ''], ['', '', ''], ['', '', '']],
        turn: 'X',
        status: 'playing',
        raw: boardResponse,
        dns_response: boardResponse,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message || 'DNS query failed' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}

async function handleJoinSession(
  sessionId: string,
  zone: string,
  host: string,
  port: number,
  corsHeaders: Record<string, string>
): Promise<Response> {
  try {
    const dnsResponse = await queryTXT(`${sessionId}.join.${zone}`, { host, port });
    const error = parseError(dnsResponse);
    if (error) {
      return new Response(JSON.stringify({ error, dns_response: dnsResponse }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const tokenMatch = dnsResponse.match(/Player Token: (\w+)/);
    const playerMatch = dnsResponse.match(/You are playing as: ([XO])/);

    if (!tokenMatch || !playerMatch) {
      return new Response(JSON.stringify({ error: 'Failed to parse join response', dns_response: dnsResponse }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(
      JSON.stringify({
        session_id: sessionId,
        player_token: tokenMatch[1],
        player: playerMatch[1],
        message: `Joined as ${playerMatch[1]}`,
        dns_response: dnsResponse,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message || 'DNS query failed' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}

async function handleMakeMove(
  sessionId: string,
  body: any,
  zone: string,
  host: string,
  port: number,
  corsHeaders: Record<string, string>
): Promise<Response> {
  const { token, row, col } = body;

  if (!token || typeof token !== 'string') {
    return new Response(JSON.stringify({ error: 'Player token is required' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  if (typeof row !== 'number' || typeof col !== 'number') {
    return new Response(JSON.stringify({ error: 'Row and col must be numbers' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  if (row < 0 || row > 2 || col < 0 || col > 2) {
    return new Response(JSON.stringify({ error: 'Row and col must be between 0 and 2' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const domain = `${sessionId}-${token}-move-${row}-${col}.${zone}`;
    const dnsResponse = await queryTXT(domain, { host, port });

    const error = parseError(dnsResponse);
    if (error) {
      try {
        const boardResponse = await queryTXT(`${sessionId}.json.${zone}`, { host, port });
        const boardData = parseJSONResponse(boardResponse);
        if (boardData) {
          return new Response(
            JSON.stringify({
              error,
              board: boardData.board,
              turn: boardData.turn,
              status: boardData.status,
              dns_response: dnsResponse,
            }),
            {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
          );
        }
      } catch {
        // Ignore
      }
      return new Response(JSON.stringify({ error, dns_response: dnsResponse }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const jsonData = parseJSONResponse(dnsResponse);
    if (jsonData) {
      return new Response(
        JSON.stringify({
          message: 'Move accepted',
          board: jsonData.board,
          turn: jsonData.turn,
          status: jsonData.status,
          dns_response: dnsResponse,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const boardResponse = await queryTXT(`${sessionId}.json.${zone}`, { host, port });
    const boardData = parseJSONResponse(boardResponse);

    return new Response(
      JSON.stringify({
        message: 'Move accepted',
        board: boardData?.board || [['', '', ''], ['', '', ''], ['', '', '']],
        turn: boardData?.turn || 'X',
        status: boardData?.status || 'playing',
        dns_response: dnsResponse,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message || 'DNS query failed' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}

async function handleResetGame(
  sessionId: string,
  zone: string,
  host: string,
  port: number,
  corsHeaders: Record<string, string>
): Promise<Response> {
  try {
    const resetResponse = await queryTXT(`${sessionId}.reset.${zone}`, { host, port });
    const error = parseError(resetResponse);
    if (error) {
      return new Response(JSON.stringify({ error, dns_response: resetResponse }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const boardResponse = await queryTXT(`${sessionId}.json.${zone}`, { host, port });
    const boardData = parseJSONResponse(boardResponse);

    return new Response(
      JSON.stringify({
        message: 'Game reset',
        board: boardData?.board || [['', '', ''], ['', '', ''], ['', '', '']],
        turn: boardData?.turn || 'X',
        status: boardData?.status || 'playing',
        dns_response: resetResponse,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message || 'DNS query failed' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}

