declare module 'dns-packet' {
  export interface Question {
    type: string;
    name: string;
    class?: number;
  }

  export interface Answer {
    type: string;
    name: string;
    class?: number;
    ttl?: number;
    data: Buffer | string | (Buffer | string)[];
  }

  export interface Packet {
    type?: 'query' | 'response';
    id?: number;
    flags?: number;
    questions?: Question[];
    answers?: Answer[];
    additionals?: Answer[];
    authorities?: Answer[];
    rcode?: string | number;
  }

  export const RECURSION_DESIRED: number;
  export const RECURSION_AVAILABLE: number;

  export function encode(packet: Packet): Buffer;
  export function decode(buffer: Buffer): Packet;
}

