export type SqliteEvent = {
  position: number;
  type: string;
  payload: string;
  tags: string | null;
};
