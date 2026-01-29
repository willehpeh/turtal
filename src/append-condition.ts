import { EventQuery } from './event-query';

export class AppendCondition {

  private readonly _types: string[];
  private readonly _tags: string[];

  private constructor(query: EventQuery = new EventQuery(),
                      private readonly _after = 0) {
    this._types = query.types();
    this._tags = query.tags();
  }

  static empty(): AppendCondition {
    return new AppendCondition();
  }

  static forQuery(query: EventQuery): AppendCondition {
    return new AppendCondition(query);
  }

  isEmpty(): boolean {
    return this._types.length === 0 && this._tags.length === 0;
  }

  typesAsString(): string {
    return this._types.map(type => `'${ type }'`).join(',');
  }

}
