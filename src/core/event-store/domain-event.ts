export type DomainEvent<TType extends string = string, TPayload = unknown> = {
  id: string,
  type: TType,
  payload: TPayload,
  tags: string[]
};
