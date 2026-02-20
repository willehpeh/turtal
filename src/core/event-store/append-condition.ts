import { EventCriteria } from './event-criteria';

export class AppendCondition {

  private constructor(
    readonly criteria: EventCriteria = new EventCriteria(),
    readonly after = 0
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
    return new AppendCondition(criteria, after);
  }

  isEmpty(): boolean {
    return this.criteria.isEmpty();
  }
}
