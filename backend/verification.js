const { pool } = require('./db');
const { sendMail } = require('./mailer');
const crypto = require('crypto');
const { assignRole } = require('./features/verification');

// Store OTPs temporarily (in production, use Redis or similar)
const otpStore = new Map();

// Generate a 6-digit OTP
function generateOTP() {
    return crypto.randomInt(100000, 999999).toString();
}

// Check if email exists in database
async function checkEmailExists(email) {
    try {
        const result = await pool.query(
            'SELECT * FROM users WHERE email = $1',
            [email]
        );
        return result.rows.length > 0;
    } catch (error) {
        console.error('Error checking email:', error);
        return false;
    }
}

// Check if user has premium
async function checkPremiumStatus(email) {
    try {
        const result = await pool.query(
            'SELECT is_premium FROM users WHERE email = $1',
            [email]
        );
        return result.rows[0]?.is_premium || false;
    } catch (error) {
        console.error('Error checking premium status:', error);
        return false;
    }
}

// Check if Discord ID is already associated with another email
async function checkDiscordIdExists(discordId) {
    try {
        const result = await pool.query(
            'SELECT email FROM users WHERE discord_id = $1',
            [discordId]
        );
        return result.rows.length > 0;
    } catch (error) {
        console.error('Error checking Discord ID:', error);
        throw error;
    }
}

// Handle verification request
async function handleVerification(email) {
    try {
        const exists = await checkEmailExists(email);
        if (!exists) {
            return {
                success: false,
                message: "This message is only available for AlgoPath premium users. Please purchase our premium version to enjoy this feature!"
            };
        }

        const isPremium = await checkPremiumStatus(email);
        if (!isPremium) {
            return {
                success: false,
                message: "This message is only available for AlgoPath premium users. Please upgrade to premium to continue!"
            };
        }

        // Generate and store OTP
        const otp = generateOTP();
        otpStore.set(email, {
            otp,
            timestamp: Date.now()
        });

        // Send OTP via email
        await sendMail(email, otp);

        return {
            success: true,
            message: "OTP has been sent to your email. Please check your inbox."
        };
    } catch (error) {
        console.error('Error in verification:', error);
        return {
            success: false,
            message: "An error occurred during verification. Please try again later."
        };
    }
}

// Verify OTP
async function verifyOTP(email, otp, discordId) {
    try {
        const storedData = otpStore.get(email);
        if (!storedData) {
            console.log('No OTP found for email:', email);
            return {
                success: false,
                message: "No OTP found for this email. Please request a new OTP."
            };
        }

        // Check if OTP is expired (10 minutes)
        if (Date.now() - storedData.timestamp > 10 * 60 * 1000) {
            console.log('OTP expired for email:', email);
            otpStore.delete(email);
            return {
                success: false,
                message: "OTP has expired. Please request a new one."
            };
        }

        if (storedData.otp !== otp) {
            console.log('Invalid OTP for email:', email);
            return {
                success: false,
                message: "Invalid OTP. Please try again."
            };
        }

        // Clear OTP after successful verification
        otpStore.delete(email);

        // First check if the user exists
        const userResult = await pool.query(
            'SELECT * FROM users WHERE email = $1',
            [email]
        );

        if (userResult.rows.length === 0) {
            console.log('User not found in database:', email);
            return {
                success: false,
                message: "User not found in database."
            };
        }

        // Store the Discord ID in the database
        console.log('Updating Discord ID for email:', email);
        await pool.query(
            'UPDATE users SET discord_id = $1 WHERE email = $2',
            [discordId, email]
        );

        // Assign role to the user
        console.log('Assigning role for Discord ID:', discordId);
        const roleResult = await assignRole(discordId);
        if (!roleResult.success) {
            console.log('Failed to assign role:', roleResult.message);
            return {
                success: false,
                message: roleResult.message
            };
        }

        console.log('Verification successful for:', email);
        return {
            success: true,
            message: "Email verified successfully and role assigned!"
        };
    } catch (error) {
        console.error('Error in verification:', error);
        return {
            success: false,
            message: "An error occurred during verification. Please try again later."
        };
    }
}

module.exports = {
    handleVerification,
    verifyOTP
}; 