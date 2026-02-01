// language=SQLite
export const SQLITE_SCHEMA_DEF = `
    CREATE TABLE IF NOT EXISTS events
    (
        id       TEXT NOT NULL UNIQUE COLLATE NOCASE,
        position INTEGER PRIMARY KEY AUTOINCREMENT,
        type     TEXT NOT NULL,
        payload  JSON NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_events_type ON events (type);

    CREATE TABLE IF NOT EXISTS event_tags
    (
        event_position INTEGER NOT NULL,
        tag            TEXT    NOT NULL,
        PRIMARY KEY (event_position, tag),
        FOREIGN KEY (event_position) REFERENCES events (position)
    );
    CREATE INDEX IF NOT EXISTS idx_event_tags_tag ON event_tags (tag);
`;
