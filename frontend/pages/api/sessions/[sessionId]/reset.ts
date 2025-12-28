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

  if (!sessionId || typeof sessionId !== 'string') {
    return res.status(400).json({ error: 'Session ID is required' });
  }

  try {
    const queryOptions = {
      ...(DNS_HOST && { host: DNS_HOST }),
      ...(DNS_PORT && { port: DNS_PORT }),
    };
    const resetStartTime = Date.now();
    const resetResponse = await queryTXT(`${sessionId}.reset.${ZONE}`, queryOptions);
    const resetLatency = Date.now() - resetStartTime;

    const error = parseError(resetResponse);
    if (error) {
      return res.status(400).json({ error, dns_response: resetResponse, dns_latency: resetLatency });
    }

    // Get updated board state
    const boardStartTime = Date.now();
    const boardResponse = await queryTXT(`${sessionId}.json.${ZONE}`, queryOptions);
    const boardLatency = Date.now() - boardStartTime;
    const boardData = parseJSONResponse(boardResponse);

    return res.status(200).json({
      message: 'Game reset',
      board: boardData?.board || [['', '', ''], ['', '', ''], ['', '', '']],
      turn: boardData?.turn || 'X',
      status: boardData?.status || 'playing',
      dns_response: resetResponse,
      dns_latency: resetLatency,
      board_latency: boardLatency,
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'DNS query failed' });
  }
}

