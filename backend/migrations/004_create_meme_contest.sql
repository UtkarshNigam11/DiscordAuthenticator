-- Create meme contest tables
CREATE TABLE IF NOT EXISTS meme_contests (
    id SERIAL PRIMARY KEY,
    channel_id VARCHAR(255) NOT NULL,
    start_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    end_date TIMESTAMP WITH TIME ZONE NOT NULL,
    status VARCHAR(50) DEFAULT 'active',
    winner_user_id VARCHAR(255),
    winner_message_id VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS meme_submissions (
    id SERIAL PRIMARY KEY,
    contest_id INTEGER REFERENCES meme_contests(id) ON DELETE CASCADE,
    user_id VARCHAR(255) NOT NULL,
    message_id VARCHAR(255) NOT NULL,
    reaction_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(contest_id, message_id)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_meme_contests_status ON meme_contests(status);
CREATE INDEX IF NOT EXISTS idx_meme_contests_end_date ON meme_contests(end_date);
CREATE INDEX IF NOT EXISTS idx_meme_submissions_contest_id ON meme_submissions(contest_id);
CREATE INDEX IF NOT EXISTS idx_meme_submissions_user_id ON meme_submissions(user_id); 