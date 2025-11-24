-- Ensure usernames are unique and not null
WITH duplicate_users AS (
  SELECT id
  FROM (
    SELECT id, ROW_NUMBER() OVER (PARTITION BY username ORDER BY id) AS rn
    FROM users
    WHERE username IS NOT NULL
  ) ranked
  WHERE rn > 1
)
DELETE FROM users u
USING duplicate_users d
WHERE u.id = d.id;

UPDATE users u
SET username = COALESCE(u.username, u.twitch_login, CONCAT('user_', u.id))
WHERE u.username IS NULL;

ALTER TABLE users
  ALTER COLUMN username SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'users_username_key'
      AND conrelid = 'users'::regclass
  ) THEN
    ALTER TABLE users ADD CONSTRAINT users_username_key UNIQUE (username);
  END IF;
END $$;
