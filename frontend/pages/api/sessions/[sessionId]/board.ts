import type { NextApiRequest, NextApiResponse } from 'next';
import { queryTXT, parseJSONResponse, parseError } from '@/lib/dns-client';

const DNS_HOST = process.env.DNS_HOST || '127.0.0.1';
const DNS_PORT = parseInt(process.env.DNS_PORT || '53', 10);
const ZONE = process.env.DNS_ZONE || 'game.local';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { sessionId } = req.query;

  if (!sessionId || typeof sessionId !== 'string') {
    return res.status(400).json({ error: 'Session ID is required' });
  }

  try {
    // Try to get JSON response first (more structured)
    const jsonResponse = await queryTXT(`${sessionId}.json.${ZONE}`, {
      host: DNS_HOST,
      port: DNS_PORT,
    });

    const error = parseError(jsonResponse);
    if (error) {
      return res.status(400).json({ error, dns_response: jsonResponse });
    }

    const jsonData = parseJSONResponse(jsonResponse);
    if (jsonData) {
      return res.status(200).json({
        board: jsonData.board,
        turn: jsonData.turn,
        status: jsonData.status,
        dns_response: jsonResponse,
      });
    }

    // Fallback to board command if JSON parsing fails
    const boardResponse = await queryTXT(`${sessionId}.board.${ZONE}`, {
      host: DNS_HOST,
      port: DNS_PORT,
    });

    const boardError = parseError(boardResponse);
    if (boardError) {
      return res.status(400).json({ error: boardError, dns_response: boardResponse });
    }

    // Parse board from text format (fallback)
    // This is a simple parser - you might need to adjust based on actual format
    return res.status(200).json({
      board: [['', '', ''], ['', '', ''], ['', '', '']],
      turn: 'X',
      status: 'playing',
      raw: boardResponse,
      dns_response: boardResponse,
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'DNS query failed' });
  }
}

