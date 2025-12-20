import type { NextApiRequest, NextApiResponse } from 'next';
import { queryTXT, parseError } from '@/lib/dns-client';

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

  try {
    const response = await queryTXT(`list.${ZONE}`, {
      host: DNS_HOST,
      port: DNS_PORT,
    });

    const error = parseError(response);
    if (error) {
      return res.status(400).json({ error });
    }

    // Parse session list from response
    // Format: "Active sessions (2):\nabc12345\nxyz67890"
    const lines = response.split('\n');
    const sessions: string[] = [];
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('Active sessions')) {
        sessions.push(trimmed);
      }
    }

    return res.status(200).json({
      sessions,
      count: sessions.length,
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'DNS query failed' });
  }
}

