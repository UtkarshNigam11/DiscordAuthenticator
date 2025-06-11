-- Add discord_username column to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS discord_username VARCHAR(255); 