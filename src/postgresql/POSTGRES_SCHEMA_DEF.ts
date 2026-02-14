export const POSTGRES_SCHEMA_DEF = `
    CREATE TABLE IF NOT EXISTS events
    (
        id       TEXT      NOT NULL UNIQUE,
        position BIGSERIAL PRIMARY KEY,
        type     TEXT      NOT NULL,
        payload  JSONB     NOT NULL,
        tags     TEXT[]    NOT NULL DEFAULT '{}'
    );
    CREATE INDEX IF NOT EXISTS idx_events_type ON events (type);
    CREATE INDEX IF NOT EXISTS idx_events_tags ON events USING GIN (tags);
`;
