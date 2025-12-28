import type { NextApiRequest, NextApiResponse } from 'next';
import { queryTXT, parseError } from '@/lib/dns-client';

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
    const dnsResponse = await queryTXT(`${sessionId}.join.${ZONE}`, {
      ...(DNS_HOST && { host: DNS_HOST }),
      ...(DNS_PORT && { port: DNS_PORT }),
    });

    const error = parseError(dnsResponse);
    if (error) {
      return res.status(400).json({ error, dns_response: dnsResponse });
    }

    // Extract player token and player from response
    // Format: "Joined session: abc123\nPlayer Token: xyz78901\nYou are playing as: X\n..."
    const tokenMatch = dnsResponse.match(/Player Token: (\w+)/);
    const playerMatch = dnsResponse.match(/You are playing as: ([XO])/);

    if (!tokenMatch || !playerMatch) {
      return res.status(500).json({ error: 'Failed to parse join response', dns_response: dnsResponse });
    }

    return res.status(200).json({
      session_id: sessionId,
      player_token: tokenMatch[1],
      player: playerMatch[1],
      message: `Joined as ${playerMatch[1]}`,
      dns_response: dnsResponse,
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'DNS query failed' });
  }
}

