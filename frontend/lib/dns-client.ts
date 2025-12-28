import * as dns from 'node:dns';
import * as dgram from 'node:dgram';
import * as dnsPacket from 'dns-packet';

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

/**
 * Makes a DNS TXT query
 * - If host is provided, queries the specified DNS server directly (like `dig @host TXT domain`)
 * - If host is not provided, uses the system's default DNS resolver (like `dig TXT domain`)
 */
export async function queryTXT(
  domain: string,
  options: DNSQueryOptions = {}
): Promise<string> {
  const timeout = options.timeout ?? 5000;

  // If host is specified, use UDP to query that specific DNS server
  if (options.host) {
    return queryTXTDirect(domain, options.host, options.port ?? 53, timeout);
  }

  // Otherwise, use system DNS resolver
  return new Promise((resolve, reject) => {
    // Set timeout
    const timeoutId = setTimeout(() => {
      reject(new Error(`DNS error: ETIMEDOUT - queryTXT timeout after ${timeout}ms`));
    }, timeout);

    // Use Node.js built-in DNS resolver (uses system DNS like dig does)
    dns.resolveTxt(domain, (err, records) => {
      clearTimeout(timeoutId);
      
      if (err) {
        if (err.code) {
          reject(new Error(`DNS error: ${err.code} - ${err.message}`));
        } else {
          reject(err);
        }
        return;
      }
      
      // TXT records are arrays of string arrays (for long TXT records split across multiple strings)
      if (records && records.length > 0) {
        // Join all parts of the TXT record
        const result = records[0].join('');
        resolve(result);
        return;
      }
      
      reject(new Error('No TXT record in response'));
    });
  });
}

/**
 * Makes a DNS TXT query by directly sending a UDP packet to the specified DNS server
 * This bypasses the system DNS resolver and queries the custom DNS server directly
 */
function queryTXTDirect(
  domain: string,
  host: string,
  port: number,
  timeout: number
): Promise<string> {
  return new Promise((resolve, reject) => {
    // Create UDP socket
    const socket = dgram.createSocket('udp4');
    
    // Create DNS query packet
    const query = dnsPacket.encode({
      type: 'query',
      id: Math.floor(Math.random() * 65535),
      flags: dnsPacket.RECURSION_DESIRED,
      questions: [{
        type: 'TXT',
        name: domain,
      }],
    });

    // Set timeout
    const timeoutId = setTimeout(() => {
      socket.close();
      reject(new Error(`DNS error: ETIMEDOUT - queryTXT timeout after ${timeout}ms`));
    }, timeout);

    // Handle response
    socket.on('message', (msg) => {
      clearTimeout(timeoutId);
      socket.close();
      
      try {
        const response = dnsPacket.decode(msg);
        
        // Check for errors in response
        // rcode 0 or 'NOERROR' means success
        const rcode = response.rcode;
        if (rcode) {
          const isError = typeof rcode === 'string' 
            ? rcode !== 'NOERROR' 
            : rcode !== 0;
          if (isError) {
            reject(new Error(`DNS error: ${rcode} - queryTXT ${rcode}`));
            return;
          }
        }
        
        // Extract TXT records from answer section
        if (response.answers && response.answers.length > 0) {
          const txtAnswers = response.answers.filter((ans: any) => ans.type === 'TXT');
          if (txtAnswers.length > 0) {
            // TXT records are arrays of buffers/strings
            const txtData = txtAnswers[0].data;
            if (Array.isArray(txtData)) {
              // Join all parts of the TXT record
              const result = txtData.map((part: Buffer | string) => 
                Buffer.isBuffer(part) ? part.toString('utf8') : part
              ).join('');
              resolve(result);
              return;
            } else if (typeof txtData === 'string') {
              resolve(txtData);
              return;
            }
          }
        }
        
        reject(new Error('No TXT record in response'));
      } catch (error: any) {
        reject(new Error(`DNS error: Failed to parse response - ${error.message}`));
      }
    });

    // Handle errors
    socket.on('error', (error: any) => {
      clearTimeout(timeoutId);
      socket.close();
      if (error.code) {
        reject(new Error(`DNS error: ${error.code} - ${error.message}`));
      } else {
        reject(error);
      }
    });

    // Send query
    socket.send(query, 0, query.length, port, host, (err) => {
      if (err) {
        clearTimeout(timeoutId);
        socket.close();
        reject(new Error(`DNS error: Failed to send query - ${err.message}`));
      }
    });
  });
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
