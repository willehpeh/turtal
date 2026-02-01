export interface DbQueryGenerator<T> {
  generate(types: string[], tags: string[], after?: number): T;
}
