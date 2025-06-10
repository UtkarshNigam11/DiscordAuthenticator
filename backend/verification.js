const { pool } = require('./db');
const { sendMail } = require('./mailer');
const { assignRole } = require('./discord');
const crypto = require('crypto');

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

// Check if Discord username is already associated with another email
async function checkDiscordUsernameExists(discordUsername) {
    try {
        const result = await pool.query(
            'SELECT email FROM users WHERE discord_username = $1',
            [discordUsername]
        );
        return result.rows.length > 0;
    } catch (error) {
        console.error('Error checking Discord username:', error);
        return false;
    }
}

// Handle verification request
async function handleVerification(email, discordUsername) {
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

        // Check if this Discord username is already associated with another email
        const discordExists = await checkDiscordUsernameExists(discordUsername);
        if (discordExists) {
            return {
                success: false,
                message: "This Discord account is already associated with another email address."
            };
        }

        // Generate and store OTP
        const otp = generateOTP();
        otpStore.set(email, {
            otp,
            timestamp: Date.now(),
            discordUsername
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
async function verifyOTP(email, otp, discordUsername) {
    const storedData = otpStore.get(email);
    if (!storedData) {
        return {
            success: false,
            message: "No OTP found for this email. Please request a new OTP."
        };
    }

    // Check if OTP is expired (10 minutes)
    if (Date.now() - storedData.timestamp > 10 * 60 * 1000) {
        otpStore.delete(email);
        return {
            success: false,
            message: "OTP has expired. Please request a new one."
        };
    }

    if (storedData.otp !== otp) {
        return {
            success: false,
            message: "Invalid OTP. Please try again."
        };
    }

    // Verify Discord username matches
    if (storedData.discordUsername !== discordUsername) {
        return {
            success: false,
            message: "Discord username does not match the one used for verification."
        };
    }

    // Clear OTP after successful verification
    otpStore.delete(email);

    try {
        // Store the Discord username in the database
        await pool.query(
            'UPDATE users SET discord_username = $1 WHERE email = $2',
            [discordUsername, email]
        );

        // Assign role to the user
        const roleResult = await assignRole(discordUsername);
        if (!roleResult.success) {
            return {
                success: false,
                message: roleResult.message
            };
        }

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