const { pool } = require('./db');
require('dotenv').config();

async function addPremiumUser(email) {
    try {
        // First check if the user exists
        const checkResult = await pool.query(
            'SELECT * FROM users WHERE email = $1',
            [email]
        );

        if (checkResult.rows.length === 0) {
            // If user doesn't exist, create new user with premium status
            const result = await pool.query(
                `INSERT INTO users (email, is_premium) 
                 VALUES ($1, true) 
                 RETURNING *`,
                [email]
            );
            console.log('✅ New premium user added:', result.rows[0]);
        } else {
            // If user exists, update their premium status
            const result = await pool.query(
                `UPDATE users 
                 SET is_premium = true 
                 WHERE email = $1 
                 RETURNING *`,
                [email]
            );
            console.log('✅ User premium status updated:', result.rows[0]);
        }
    } catch (error) {
        console.error('❌ Error adding premium user:', error.message);
        throw error;
    }
}

// Example usage
const email = process.argv[2];
if (!email) {
    console.error('❌ Please provide an email address as an argument');
    process.exit(1);
}

addPremiumUser(email)
    .then(() => {
        console.log('✅ Premium user operation completed successfully');
        process.exit(0);
    })
    .catch(error => {
        console.error('❌ Operation failed:', error.message);
        process.exit(1);
    }); 