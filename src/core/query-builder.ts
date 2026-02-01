export interface QueryBuilder<T> {
  generate(types: string[], tags: string[], after?: number): T;
}
