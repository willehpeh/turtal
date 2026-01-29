export class EventQuery {

  private _types: string[] = [];
  private _tags: string[] = [];

  types(): string[] {
    return this._types.slice();
  }

  tags(): string[] {
    return this._tags.slice();
  }

  forTypes(...types: string[]): EventQuery {
    this._types.push(...types);
    return this;
  }

  forTags(...tags: string[]): EventQuery {
    this._tags.push(...tags);
    return this;
  }
}
