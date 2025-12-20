import * as dns from 'node:dns';

export interface DNSQueryOptions {
  host?: string;
  port?: number;
  timeout?: number;
}

export interface DNSResponse {
  answer?: Array<{
    name: string;
    type: string;
    data: string | string[];
  }>;
  error?: string;
}

const DEFAULT_OPTIONS: Required<DNSQueryOptions> = {
  host: '127.0.0.1',
  port: 53,
  timeout: 5000,
};

// Set custom DNS server if provided
const DNS_HOST = process.env.DNS_HOST || '127.0.0.1';
const DNS_PORT = parseInt(process.env.DNS_PORT || '53', 10);

// Configure DNS servers if not using default
if (DNS_HOST !== '127.0.0.1' && DNS_HOST !== 'localhost') {
  // Format: host:port or just host (defaults to port 53)
  const dnsServer = DNS_PORT !== 53 ? `${DNS_HOST}:${DNS_PORT}` : DNS_HOST;
  dns.setServers([dnsServer]);
}

/**
 * Makes a DNS TXT query using Node.js dns module
 * Works with Cloudflare Workers when nodejs_compat flag is enabled
 */
export async function queryTXT(
  domain: string,
  options: DNSQueryOptions = {}
): Promise<string> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  
  // If custom host/port is provided, temporarily set DNS servers
  let originalServers: string[] = [];
  if (opts.host !== '127.0.0.1' && opts.host !== 'localhost') {
    originalServers = dns.getServers();
    const dnsServer = opts.port !== 53 ? `${opts.host}:${opts.port}` : opts.host;
    dns.setServers([dnsServer]);
  }

  try {
    // Use Node.js dns.promises.resolveTxt which is supported in Cloudflare Workers
    const records = await dns.promises.resolveTxt(domain);
    
    // TXT records are arrays of string arrays, join them
    if (records && records.length > 0) {
      // Each record is an array of strings (for long TXT records split across multiple strings)
      const txtData = records[0].join('');
      return txtData;
    }
    
    throw new Error('No TXT record in response');
  } catch (error: any) {
    // Check if it's a DNS error code
    if (error.code) {
      throw new Error(`DNS error: ${error.code} - ${error.message}`);
    }
    throw error;
  } finally {
    // Restore original DNS servers if we changed them
    if (opts.host !== '127.0.0.1' && opts.host !== 'localhost' && originalServers.length > 0) {
      dns.setServers(originalServers);
    }
  }
}

/**
 * Parses a DNS response that may contain JSON
 */
export function parseJSONResponse(response: string): any {
  try {
    // Try to extract JSON from the response
    // DNS responses might have extra text, so we look for JSON
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Parses error messages from DNS responses
 */
export function parseError(response: string): string | null {
  if (response.startsWith('ERROR:')) {
    return response.replace('ERROR:', '').trim();
  }
  return null;
}
