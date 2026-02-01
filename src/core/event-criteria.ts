import { QueryBuilder } from './query-builder';

export class EventCriteria {

  private _types: string[] = [];
  private _tags: string[] = [];

  isEmpty(): boolean {
    return this._types.length === 0 && this._tags.length === 0;
  }

  forTypes(...types: string[]): EventCriteria {
    this._types.push(...types);
    return this;
  }

  forTags(...tags: string[]): EventCriteria {
    this._tags.push(...tags);
    return this;
  }

  applyTo<T>(builder: QueryBuilder<T>): QueryBuilder<T> {
    return builder.withTypes(this._types).withTags(this._tags);
  }
}
