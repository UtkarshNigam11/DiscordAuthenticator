-- Add discord_username column to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS discord_username VARCHAR(255);

-- Create a unique index to ensure one email maps to one Discord username
CREATE UNIQUE INDEX IF NOT EXISTS idx_discord_username ON users(discord_username) WHERE discord_username IS NOT NULL; 