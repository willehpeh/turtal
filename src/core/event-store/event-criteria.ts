export class EventCriteria {

  private constructor(
    private readonly _types: string[] = [],
    private readonly _tags: string[] = [],
    private readonly _after: number = 0
  ) {}

  static create(): EventCriteria {
    return new EventCriteria();
  }

  isEmpty(): boolean {
    return this._types.length === 0 && this._tags.length === 0;
  }

  types(): string[] {
    return this._types.slice();
  }

  tags(): string[] {
    return this._tags.slice();
  }

  after(): number {
    return this._after;
  }

  forTypes(...types: string[]): EventCriteria {
    return new EventCriteria([...this._types, ...types], this._tags, this._after);
  }

  forTags(...tags: string[]): EventCriteria {
    return new EventCriteria(this._types, [...this._tags, ...tags], this._after);
  }

  afterPosition(position: number): EventCriteria {
    return new EventCriteria(this._types, this._tags, position);
  }
}
