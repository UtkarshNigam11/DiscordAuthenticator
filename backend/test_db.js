const { Pool } = require('pg');
require('dotenv').config();

async function testDatabase() {
    const pool = new Pool({
        host: process.env.PGHOST,
        user: process.env.PGUSER,
        password: process.env.PGPASSWORD,
        database: process.env.PGDATABASE,
        port: process.env.PGPORT,
    });

    try {
        // Test connection
        console.log('Testing database connection...');
        const client = await pool.connect();
        console.log('✅ Successfully connected to database!');

        // Check if users table exists, if not create it
        console.log('\nEnsuring users table exists...');
        await client.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                email VARCHAR(255) UNIQUE NOT NULL,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('✅ Users table exists!');

        // Check if is_premium column exists
        console.log('Checking for is_premium column...');
        const tableInfo = await client.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'users'
        `);
        const hasPremiumColumn = tableInfo.rows.some(col => col.column_name === 'is_premium');
        if (!hasPremiumColumn) {
            console.log('Adding is_premium column...');
            await client.query(`ALTER TABLE users ADD COLUMN is_premium BOOLEAN DEFAULT FALSE`);
            console.log('✅ Added is_premium column!');
        } else {
            console.log('✅ is_premium column already exists!');
        }

        // Add test user
        console.log('\nAdding test user...');
        const result = await client.query(
            `INSERT INTO users (email, is_premium) 
             VALUES ($1, true) 
             ON CONFLICT (email) 
             DO UPDATE SET is_premium = true
             RETURNING *`,
            ['utkarshnigamextra@gmail.com']
        );
        console.log('✅ Test user added/updated:', result.rows[0]);

        // Query all users
        console.log('\nQuerying all users...');
        const users = await client.query('SELECT * FROM users');
        console.log('✅ Current users in database:');
        console.table(users.rows);

    } catch (error) {
        console.error('❌ Error:', error.message);
        if (error.code === 'ECONNREFUSED') {
            console.log('\nPossible solutions:');
            console.log('1. Make sure PostgreSQL is running');
            console.log('2. Check if the port (5432) is correct');
            console.log('3. Verify your database credentials in .env file');
        } else if (error.code === '3D000') {
            console.log('\nDatabase does not exist. Please create it first.');
        }
    } finally {
        // Close the pool
        await pool.end();
    }
}

// Run the test
testDatabase(); 