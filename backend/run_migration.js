const { pool } = require('./db');
const fs = require('fs');
const path = require('path');

async function runMigration() {
    try {
        // List of migrations in order
        const migrations = [
            '001_create_users_table.sql',
            '002_add_premium_user.sql',
            '003_add_discord_mapping.sql',
            '004_create_meme_contest.sql'
        ];

        for (const migrationFile of migrations) {
            console.log(`Running migration: ${migrationFile}`);
            const migrationPath = path.join(__dirname, 'migrations', migrationFile);
            
            if (fs.existsSync(migrationPath)) {
                const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
                await pool.query(migrationSQL);
                console.log(`Migration ${migrationFile} completed successfully`);
            } else {
                console.log(`Migration file ${migrationFile} not found, skipping...`);
            }
        }
        
        console.log('All migrations completed successfully');
        process.exit(0);
    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    }
}

runMigration(); 