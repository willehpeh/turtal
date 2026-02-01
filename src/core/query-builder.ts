export interface QueryBuilder<T> {
  withTypes(types: string[]): QueryBuilder<T>;
  withTags(tags: string[]): QueryBuilder<T>;
  afterPosition(position: number): QueryBuilder<T>;
  build(): T;
}
