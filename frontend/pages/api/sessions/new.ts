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

  try {
    const dnsResponse = await queryTXT(`new.${ZONE}`, {
      ...(DNS_HOST && { host: DNS_HOST }),
      ...(DNS_PORT && { port: DNS_PORT }),
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

