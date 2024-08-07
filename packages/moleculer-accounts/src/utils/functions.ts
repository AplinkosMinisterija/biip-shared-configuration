import { QueryObject } from '../constants';

export function parseToJsonIfNeeded(query?: QueryObject | string) {
  if (!query) return;

  if (typeof query === 'string') {
    try {
      query = JSON.parse(query);
    } catch (err) {}
  }

  return query as QueryObject;
}
