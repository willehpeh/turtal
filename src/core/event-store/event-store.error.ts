export class EventStoreError extends Error {
  readonly isEventStoreError = true;

  constructor(message: string, cause?: unknown) {
    super(message, { cause });
    this.name = 'EventStoreError';
  }
}
