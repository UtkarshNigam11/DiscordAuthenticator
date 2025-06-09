const { pool } = require('./db');
const fs = require('fs');
const path = require('path');

async function setupDatabase() {
    try {
        // Read the migration file
        const migrationSQL = fs.readFileSync(
            path.join(__dirname, 'migrations.sql'),
            'utf8'
        );

        // Execute the migration
        await pool.query(migrationSQL);
        console.log('Database setup completed successfully');
    } catch (error) {
        console.error('Error setting up database:', error);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

setupDatabase(); 