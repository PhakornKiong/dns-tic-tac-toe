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

const DEFAULT_OPTIONS: Required<DNSQueryOptions> = {
  host: '127.0.0.1',
  port: 53,
  timeout: 5000,
};

// Set custom DNS server if provided
const DNS_HOST = process.env.DNS_HOST || '127.0.0.1';
const DNS_PORT = parseInt(process.env.DNS_PORT || '53', 10);

/**
 * Makes a DNS TXT query by directly sending a UDP packet to the specified DNS server
 * This bypasses the system DNS resolver and queries the custom DNS server directly
 */
export async function queryTXT(
  domain: string,
  options: DNSQueryOptions = {}
): Promise<string> {
  // Use provided options, fall back to environment variables, then defaults
  const host = options.host ?? DNS_HOST;
  const port = options.port ?? DNS_PORT;
  const timeout = options.timeout ?? DEFAULT_OPTIONS.timeout;

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
