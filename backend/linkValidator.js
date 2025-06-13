const axios = require('axios');

async function checkLinkExists(url) {
    console.log(`Starting link validation for: ${url}`);
    try {
        const response = await axios.get(url, { 
            timeout: 5000, // 5 second timeout
            validateStatus: function (status) {
                console.log(`Received status code: ${status} for ${url}`);
                return status >= 200 && status < 400; // Accept any successful status code
            }
        });
        console.log(`Successfully validated link: ${url}`);
        return true;
    } catch (error) {
        console.error(`Error checking link ${url}:`, {
            message: error.message,
            code: error.code,
            response: error.response ? {
                status: error.response.status,
                statusText: error.response.statusText
            } : 'No response'
        });
        return false;
    }
}

module.exports = { checkLinkExists }; 