import type { Pool, PoolClient } from 'pg';

export class SerializableTransaction {
  private static readonly MAX_RETRIES = 3;

  constructor(private readonly pool: Pool) {}

  async execute(fn: (client: PoolClient) => Promise<void>): Promise<void> {
    const client = await this.pool.connect();
    try {
      for (let attempt = 1; attempt <= SerializableTransaction.MAX_RETRIES; attempt++) {
        try {
          await client.query('BEGIN TRANSACTION ISOLATION LEVEL SERIALIZABLE');
          await fn(client);
          await client.query('COMMIT');
          return;
        } catch (error) {
          await client.query('ROLLBACK').catch(() => {});
          if (!this.isSerializationError(error) || attempt === SerializableTransaction.MAX_RETRIES) {
            throw error;
          }
          await this.backoff(attempt);
        }
      }
    } finally {
      client.release();
    }
  }

  private static readonly BASE_DELAY_MS = 25;

  private backoff(attempt: number): Promise<void> {
    const delay = SerializableTransaction.BASE_DELAY_MS * Math.pow(2, attempt) + Math.random() * SerializableTransaction.BASE_DELAY_MS;
    return new Promise(resolve => setTimeout(resolve, delay));
  }

  private isSerializationError(error: unknown): boolean {
    return error != null
      && typeof error === 'object'
      && 'code' in error
      && (error as Record<string, unknown>).code === '40001';
  }
}
