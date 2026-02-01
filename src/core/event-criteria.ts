import { QueryBuilder } from './query-builder';

export class EventCriteria {

  private _types: string[] = [];
  private _tags: string[] = [];

  types(): string[] {
    return this._types.slice();
  }

  tags(): string[] {
    return this._tags.slice();
  }

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

  buildQuery<T>(builder: QueryBuilder<T>): T {
    return builder.build(this._types, this._tags);
  }
}
