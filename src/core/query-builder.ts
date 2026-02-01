export interface QueryBuilder<T> {
  build(types: string[], tags: string[], after?: number): T;
}
