import { QueryBuilder } from './query-builder';

export class EventCriteria {

  private constructor(
    private readonly _types: string[] = [],
    private readonly _tags: string[] = []
  ) {}

  static create(): EventCriteria {
    return new EventCriteria();
  }

  isEmpty(): boolean {
    return this._types.length === 0 && this._tags.length === 0;
  }

  forTypes(...types: string[]): EventCriteria {
    return new EventCriteria([...this._types, ...types], this._tags);
  }

  forTags(...tags: string[]): EventCriteria {
    return new EventCriteria(this._types, [...this._tags, ...tags]);
  }

  appliedTo<T>(builder: QueryBuilder<T>): QueryBuilder<T> {
    return builder.withTypes(this._types).withTags(this._tags);
  }
}
