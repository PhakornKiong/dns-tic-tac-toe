import type { NextApiRequest, NextApiResponse } from 'next';
import { queryTXT, parseJSONResponse, parseError } from '@/lib/dns-client';

const DNS_HOST = process.env.DNS_HOST || '127.0.0.1';
const DNS_PORT = parseInt(process.env.DNS_PORT || '53', 10);
const ZONE = process.env.DNS_ZONE || 'game.local';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { sessionId } = req.query;

  if (!sessionId || typeof sessionId !== 'string') {
    return res.status(400).json({ error: 'Session ID is required' });
  }

  try {
    const resetResponse = await queryTXT(`${sessionId}.reset.${ZONE}`, {
      host: DNS_HOST,
      port: DNS_PORT,
    });

    const error = parseError(resetResponse);
    if (error) {
      return res.status(400).json({ error, dns_response: resetResponse });
    }

    // Get updated board state
    const boardResponse = await queryTXT(`${sessionId}.json.${ZONE}`, {
      host: DNS_HOST,
      port: DNS_PORT,
    });
    const boardData = parseJSONResponse(boardResponse);

    return res.status(200).json({
      message: 'Game reset',
      board: boardData?.board || [['', '', ''], ['', '', ''], ['', '', '']],
      turn: boardData?.turn || 'X',
      status: boardData?.status || 'playing',
      dns_response: resetResponse,
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'DNS query failed' });
  }
}

