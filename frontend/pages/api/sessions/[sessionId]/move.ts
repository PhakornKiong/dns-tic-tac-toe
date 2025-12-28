import type { NextApiRequest, NextApiResponse } from 'next';
import { queryTXT, parseJSONResponse, parseError } from '@/lib/dns-client';

const DNS_HOST = process.env.NEXT_PUBLIC_DNS_HOST;
const DNS_PORT = process.env.NEXT_PUBLIC_DNS_PORT ? parseInt(process.env.NEXT_PUBLIC_DNS_PORT, 10) : undefined;
const ZONE = process.env.NEXT_PUBLIC_DNS_ZONE || 'game.local';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { sessionId } = req.query;
  const { token, row, col } = req.body;

  if (!sessionId || typeof sessionId !== 'string') {
    return res.status(400).json({ error: 'Session ID is required' });
  }

  if (!token || typeof token !== 'string') {
    return res.status(400).json({ error: 'Player token is required' });
  }

  if (typeof row !== 'number' || typeof col !== 'number') {
    return res.status(400).json({ error: 'Row and col must be numbers' });
  }

  if (row < 0 || row > 2 || col < 0 || col > 2) {
    return res.status(400).json({ error: 'Row and col must be between 0 and 2' });
  }

  try {
    // Format: {session-id}-{token}-move-ROW-COL.game.local
    const domain = `${sessionId}-${token}-move-${row}-${col}.${ZONE}`;
    const queryOptions = {
      ...(DNS_HOST && { host: DNS_HOST }),
      ...(DNS_PORT && { port: DNS_PORT }),
    };
    const dnsResponse = await queryTXT(domain, queryOptions);

    const error = parseError(dnsResponse);
    if (error) {
      // Try to get current board state even on error
      try {
        const boardResponse = await queryTXT(`${sessionId}.json.${ZONE}`, queryOptions);
        const boardData = parseJSONResponse(boardResponse);
        if (boardData) {
          return res.status(400).json({
            error,
            board: boardData.board,
            turn: boardData.turn,
            status: boardData.status,
            dns_response: dnsResponse,
          });
        }
      } catch {
        // Ignore board fetch errors
      }
      return res.status(400).json({ error, dns_response: dnsResponse });
    }

    // Try to parse JSON from response
    const jsonData = parseJSONResponse(dnsResponse);
    if (jsonData) {
      return res.status(200).json({
        message: 'Move accepted',
        board: jsonData.board,
        turn: jsonData.turn,
        status: jsonData.status,
        dns_response: dnsResponse,
      });
    }

    // If no JSON, fetch current board state
    const boardResponse = await queryTXT(`${sessionId}.json.${ZONE}`, queryOptions);
    const boardData = parseJSONResponse(boardResponse);

    return res.status(200).json({
      message: 'Move accepted',
      board: boardData?.board || [['', '', ''], ['', '', ''], ['', '', '']],
      turn: boardData?.turn || 'X',
      status: boardData?.status || 'playing',
      dns_response: dnsResponse,
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'DNS query failed' });
  }
}

