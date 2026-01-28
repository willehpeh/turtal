export type DomainEvent = {
  type: string,
  payload: unknown,
  tags: string[]
};
