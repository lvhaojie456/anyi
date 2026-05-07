-- schema.sql
DROP TABLE IF EXISTS users;
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user',
  avatar TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

DROP TABLE IF EXISTS memorials;
CREATE TABLE memorials (
  id TEXT PRIMARY KEY,
  name TEXT,
  relation TEXT,
  birth_date TEXT,
  death_date TEXT,
  message TEXT,
  image_url TEXT,
  author_name TEXT,
  author_id TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  type TEXT NOT NULL,
  status TEXT NOT NULL,
  event_date TEXT,
  plan INTEGER,
  remarks TEXT,
  location TEXT,
  completion_time TEXT,
  completion_location TEXT,
  completion_images TEXT DEFAULT '[]',
  completion_remarks TEXT,
  progress_images TEXT DEFAULT '[]',
  completed_at TEXT
);

CREATE INDEX idx_memorials_author_id ON memorials(author_id);
CREATE INDEX idx_memorials_status_created_at ON memorials(status, created_at);

DROP TABLE IF EXISTS forum_posts;
CREATE TABLE forum_posts (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  content TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  user_name TEXT,
  user_role TEXT,
  user_avatar TEXT,
  image_url TEXT,
  flowers TEXT DEFAULT '[]',
  forum_comments TEXT DEFAULT '[]',
  deleted INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX idx_forum_posts_created_at ON forum_posts(created_at);

DROP TABLE IF EXISTS comments;
CREATE TABLE comments (
  id TEXT PRIMARY KEY,
  memorial_id TEXT,
  user_id TEXT,
  content TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  user_name TEXT
);

CREATE INDEX idx_comments_memorial_id ON comments(memorial_id);

DROP TABLE IF EXISTS messages;
CREATE TABLE messages (
  id TEXT PRIMARY KEY,
  memorial_id TEXT,
  sender_id TEXT,
  content TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_messages_memorial_id_created_at ON messages(memorial_id, created_at);

-- Admin users are no longer created by choosing the username "admin".
-- To bootstrap admin registration, set ADMIN_USERNAMES in Cloudflare, for example:
-- ADMIN_USERNAMES=admin
