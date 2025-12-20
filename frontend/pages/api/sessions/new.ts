import type { NextApiRequest, NextApiResponse } from 'next';
import { queryTXT, parseError } from '@/lib/dns-client';

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

  try {
    const dnsResponse = await queryTXT(`new.${ZONE}`, {
      host: DNS_HOST,
      port: DNS_PORT,
    });

    const error = parseError(dnsResponse);
    if (error) {
      return res.status(400).json({ error, dns_response: dnsResponse });
    }

    // Extract session ID from response
    // Format: "New session created!\nSession ID: abc12345\n..."
    const sessionIdMatch = dnsResponse.match(/Session ID: (\w+)/);
    if (!sessionIdMatch) {
      return res.status(500).json({ error: 'Failed to parse session ID', dns_response: dnsResponse });
    }

    const sessionId = sessionIdMatch[1];

    return res.status(200).json({
      session_id: sessionId,
      message: 'Session created successfully',
      dns_response: dnsResponse,
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'DNS query failed' });
  }
}

