import { AppendCondition } from './append-condition';

export class AppendOptions {
  readonly condition: AppendCondition;
  readonly metadata: Record<string, string>;

  constructor(options: { condition?: AppendCondition; metadata?: Record<string, string> } = {}) {
    this.condition = options.condition ?? AppendCondition.empty();
    this.metadata = options.metadata ?? {};
  }
}
