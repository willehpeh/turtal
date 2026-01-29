export class EventQuery {

  private _types: string[] = [];
  private _tags: string[] = [];

  constructor() {
  }

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
}
