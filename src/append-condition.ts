import { EventQuery } from './event-query';

export class AppendCondition {

  private constructor(private readonly _types: string[] = [],
                      private readonly _tags: string[] = [],
                      private readonly _after = 0) {
  }

  static empty(): AppendCondition {
    return new AppendCondition();
  }

  static forQuery(query: EventQuery): AppendCondition {
    return new AppendCondition(query.types, query.tags);
  }

  isEmpty(): boolean {
    return this._types.length === 0 && this._tags.length === 0;
  }

  typesAsString(): string {
    return this._types.map(type => `'${ type }'`).join(',');
  }

}
