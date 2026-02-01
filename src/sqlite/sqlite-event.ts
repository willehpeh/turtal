export type SqliteEvent = {
  id: string;
  position: number;
  type: string;
  payload: string;
  tags: string | null;
};
