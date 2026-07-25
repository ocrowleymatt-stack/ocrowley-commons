/**
 * Minimal SSE broadcaster for long-running job progress.
 * Source: Caspa caspa-studio SSEBroadcaster (simplified).
 */
export type SSEClient = {
  id: string;
  write: (chunk: string) => void;
  close?: () => void;
};

export class SSEBroadcaster {
  private clients = new Map<string, Set<SSEClient>>();

  subscribe(channel: string, client: SSEClient): () => void {
    if (!this.clients.has(channel)) this.clients.set(channel, new Set());
    this.clients.get(channel)!.add(client);
    return () => this.clients.get(channel)?.delete(client);
  }

  publish(channel: string, event: string, data: unknown): void {
    const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const client of this.clients.get(channel) ?? []) {
      try { client.write(payload); } catch { /* drop broken client */ }
    }
  }

  subscriberCount(channel: string): number {
    return this.clients.get(channel)?.size ?? 0;
  }
}

export const sseBroadcaster = new SSEBroadcaster();
