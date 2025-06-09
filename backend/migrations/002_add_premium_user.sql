-- First ensure the users table exists
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    is_premium BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Add the premium user
INSERT INTO users (email, is_premium) 
VALUES ('utkarshnigamextra@gmail.com', true) 
ON CONFLICT (email) 
DO UPDATE SET is_premium = true; 