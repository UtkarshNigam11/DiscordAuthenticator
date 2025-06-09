# Discord AlgoPath Bot

A Discord bot designed to manage user verification through email OTP for the AlgoPath community.

## Features

- Email-based user verification system
- OTP generation and verification
- Role management for verified users
- Secure database integration
- Email notification system

## Setup Instructions

1. **Install Dependencies**
```bash
npm install
```

2. **Environment Configuration**
Create a `.env` file in the root directory with the following variables:

```
# Discord Bot Configuration
DISCORD_TOKEN=your_discord_bot_token

# Email Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_email_password

# Database Configuration
DB_HOST=localhost
DB_USER=postgres
DB_PASSWORD=your_password
DB_NAME=algopath_db
```

3. **Database Setup**
- Ensure PostgreSQL is installed and running
- Create a database named `algopath_db`
- Run the database migrations

4. **Run the Bot**
```bash
node backend/bot.js
```

## Commands

- `!verify <email>` - Request email verification
- `!otp <code>` - Verify OTP code received via email

## Project Structure

```
Discord_AlgoPath/
├── backend/
│   ├── bot.js            # Main bot file
│   ├── config.js         # Configuration
│   ├── otp.js            # OTP generation
│   └── mailer.js         # Email handling
├── frontend/             # Frontend components
├── .env                  # Environment variables
├── package.json          # Project dependencies
└── README.md             # Project documentation
```

## Usage

1. Users can verify their email by sending `!verify your.email@algouniversity.com`
2. The bot will send an OTP to the provided email
3. Users can verify by sending `!otp 123456` with their received code
4. Verified users will automatically receive the "Verified" role

## Security

- All sensitive information is stored in environment variables
- OTPs are time-limited for security
- Database connections are encrypted
- Email communication is secure

## Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

ISC License

## Support

For support, create an issue in the GitHub repository.