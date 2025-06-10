function verifyOTP() {
    const email = document.getElementById('email').value;
    const discordId = document.getElementById('discordId').value;
    const otp = document.getElementById('otp').value;

    try {
        // Make the actual API call to verify OTP
        fetch('/api/verify-otp', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ email, discordId, otp }),
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                // Hide the verification form
                document.getElementById('verificationForm').style.display = 'none';
                
                // Show success message
                const msgDiv = document.getElementById('successMessage');
                msgDiv.style.display = 'block';
                msgDiv.innerHTML = 'Verification successful! Redirecting to Discord...';
                msgDiv.className = 'p-4 rounded-md bg-green-100 text-green-700 mt-4';
                
                // Redirect to Discord after a short delay
                setTimeout(() => {
                    window.location.href = 'https://discord.gg/Ez9sqs5m';
                }, 2000);
            } else {
                showMessage(data.message || 'Verification failed. Please try again.', 'error');
            }
        })
        .catch(error => {
            console.error('Verification error:', error);
            showMessage('An error occurred. Please try again.', 'error');
        });
    } catch (error) {
        console.error('Verification error:', error);
        showMessage('An error occurred. Please try again.', 'error');
    }
}

// Keep showMessage function for displaying errors
function showMessage(message, type) {
    const messageDiv = document.createElement('div');
    messageDiv.innerHTML = message;
    messageDiv.style.padding = '10px';
    messageDiv.style.marginTop = '10px';
    messageDiv.style.borderRadius = '4px';
    
    if (type === 'success') {
        messageDiv.style.backgroundColor = '#dff0d8';
        messageDiv.style.color = '#3c763d';
        messageDiv.style.border = '1px solid #d6e9c6';
    } else {
        messageDiv.style.backgroundColor = '#f2dede';
        messageDiv.style.color = '#a94442';
        messageDiv.style.border = '1px solid #ebccd1';
    }
    
    // Remove any existing messages before adding a new one
    const existingMessage = document.querySelector('.message');
    if (existingMessage) {
        existingMessage.remove();
    }
    
    messageDiv.className = 'message';
    document.querySelector('.container').appendChild(messageDiv);
} 