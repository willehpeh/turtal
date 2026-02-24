import { EventCriteria } from './event-criteria';

export class AppendCondition {

  private constructor(
    readonly criteria: EventCriteria = EventCriteria.create()
  ) {}

  static empty(): AppendCondition {
    return new AppendCondition();
  }

  /**
   * If criteria is empty, position is ignored.
   */
  static forCriteria(criteria: EventCriteria, after = 0): AppendCondition {
    if (criteria.isEmpty()) {
      return AppendCondition.empty();
    }
    return new AppendCondition(after > 0 ? criteria.afterPosition(after) : criteria);
  }

  isEmpty(): boolean {
    return this.criteria.isEmpty();
  }
}
