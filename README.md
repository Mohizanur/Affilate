# Referral Bot - Telegram Marketing System

A comprehensive Telegram bot system for managing referral marketing campaigns with Firebase backend.

## 🚀 Features

### For Users
- 📱 Phone verification system
- 🔗 Generate referral codes for multiple companies
- 💰 Track earnings and referral statistics
- 💸 Withdraw earnings via multiple methods
- 📊 Detailed analytics dashboard

### For Companies
- 🏢 Company registration and verification
- 📦 Product/service management
- ✅ Order approval system
- 👥 Referrer management
- 📈 Analytics and reporting

### For Admins
- 🔧 Complete platform management
- 📊 System-wide analytics
- 💸 Withdrawal management
- 📢 Broadcast messaging
- 👥 User and company management

## 🛠️ Tech Stack

- **Backend**: Node.js, Express.js
- **Bot Framework**: Telegraf
- **Database**: Firebase Firestore
- **Authentication**: Firebase Auth
- **Logging**: Winston
- **Validation**: Joi
- **Security**: Helmet, CORS, Rate Limiting

## 📋 Prerequisites

- Node.js (v16 or higher)
- Firebase project with Firestore enabled
- Telegram Bot Token (from @BotFather)

## 🔧 Installation

1. **Clone the repository**
```bash
git clone https://github.com/yourusername/referral-bot.git
cd referral-bot
```

2. **Install dependencies**
```bash
npm install
```

3. **Set up environment variables**
```bash
cp .env.example .env
# Edit .env with your configuration
```

4. **Set up Firebase**
- Create a Firebase project
- Enable Firestore database
- Generate service account key
- Add Firebase credentials to .env

5. **Create Telegram Bot**
- Message @BotFather on Telegram
- Create new bot with /newbot
- Add bot token to .env

6. **Run setup script**
```bash
npm run setup
```

## 🚀 Usage

### Development
```bash
npm run dev
```

### Production
```bash
npm start
```

### Testing
```bash
npm test
```

## 📁 Project Structure

```
referral-bot/
├── api/                    # REST API routes
│   ├── controllers/        # API controllers
│   ├── middleware/         # API middleware
│   └── routes/            # API route definitions
├── bot/                   # Telegram bot logic
│   └── handlers/          # Bot command handlers
├── config/                # Configuration files
├── services/              # Business logic services
├── utils/                 # Utility functions
├── scripts/               # Setup and maintenance scripts
├── tests/                 # Test files
├── .env.example          # Environment variables template
├── package.json          # Dependencies and scripts
└── README.md             # This file
```

## 🔐 Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `BOT_TOKEN` | Telegram bot token | Yes |
| `FIREBASE_PROJECT_ID` | Firebase project ID | Yes |
| `FIREBASE_PRIVATE_KEY` | Firebase private key | Yes |
| `FIREBASE_CLIENT_EMAIL` | Firebase client email | Yes |
| `REFERRER_COMMISSION_PERCENTAGE` | Commission rate for referrers | Yes |
| `BUYER_DISCOUNT_PERCENTAGE` | Discount rate for buyers | Yes |
| `MIN_WITHDRAWAL_AMOUNT` | Minimum withdrawal amount | Yes |
| `ADMIN_TELEGRAM_IDS` | Comma-separated admin IDs | Yes |

## 🤖 Bot Commands

### User Commands
- `/start` - Start the bot and show main menu
- `/profile` - View user profile and stats
- `/earnings` - View earnings dashboard
- `/generate` - Generate referral codes
- `/withdraw` - Withdraw earnings
- `/help` - Show help information

### Company Commands
- `/register_company` - Register as a company
- `/company_dashboard` - Access company dashboard

### Admin Commands
- `/admin` - Access admin panel

## 📊 Database Schema

### Users Collection
```javascript
{
  telegramId: number,
  firstName: string,
  lastName: string,
  username: string,
  phoneNumber: string,
  phoneVerified: boolean,
  coinBalance: number,
  referralCount: number,
  role: 'user' | 'company' | 'admin',
  createdAt: timestamp,
  lastActive: timestamp
}
```

### Companies Collection
```javascript
{
  name: string,
  description: string,
  website: string,
  email: string,
  telegramId: number,
  active: boolean,
  billingBalance: number,
  createdAt: timestamp
}
```

### Referral Codes Collection
```javascript
{
  code: string,
  referrerTelegramId: number,
  companyId: string,
  usageCount: number,
  totalEarnings: number,
  active: boolean,
  createdAt: timestamp
}
```

## 🔄 API Endpoints

### Public Endpoints
- `GET /api/health` - Health check
- `POST /api/webhook` - Telegram webhook
- `GET /api/companies` - List active companies

### Protected Endpoints
- `GET /api/users/profile` - Get user profile
- `POST /api/orders` - Submit order
- `GET /api/analytics` - Get analytics data

## 🚀 Deployment

### Using PM2
```bash
npm install -g pm2
pm2 start server.js --name referral-bot
pm2 startup
pm2 save
```

### Using Docker
```bash
docker build -t referral-bot .
docker run -p 3000:3000 --env-file .env referral-bot
```

### Using Heroku
```bash
heroku create your-app-name
heroku config:set BOT_TOKEN=your_token
# Set other environment variables
git push heroku main
```

## 🧪 Testing

Run the test suite:
```bash
npm test
```

Run tests in watch mode:
```bash
npm run test:watch
```

## 📝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new features
5. Run the test suite
6. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

For support and questions:
- Create an issue on GitHub
- Contact: your-email@example.com
- Telegram: @yourusername

## 🔄 Changelog

### v1.0.0
- Initial release
- Basic referral system
- User management
- Company dashboard
- Admin panel
- Withdrawal system

## 🚧 Roadmap

- [ ] Multi-language support
- [ ] Advanced analytics
- [ ] Mobile app integration
- [ ] Payment gateway integration
- [ ] Automated marketing tools
- [ ] AI-powered recommendations

---

Made with ❤️ by [Your Name]
```

```javascript:scripts/setup.js
const admin = require('firebase-admin');
const logger = require('../utils/logger');

// Initialize Firebase Admin
const serviceAccount = {
  type: "service_account",
  project_id: process.env.FIREBASE_PROJECT_ID,
  private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
  private_key: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
  client_email: process.env.FIREBASE_CLIENT_EMAIL,
  client_id: process.env.FIREBASE_CLIENT_ID,
  auth_uri: process.env.FIREBASE_AUTH_URI,
  token_uri: process.env.FIREBASE_TOKEN_URI,
};

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: process.env.FIREBASE_PROJECT_ID
});

const db = admin.firestore();

async function setupDatabase() {
  try {
    logger.info('🔧 Setting up database...');
    
    // Create indexes
    logger.info('📊 Creating database indexes...');
    
    // Create collections with initial documents
    const collections = [
      'users',
      'companies', 
      'referralCodes',
      'orders',
      'withdrawals',
      'analytics'
    ];
    
    for (const collection of collections) {
      const ref = db.collection(collection);
      const snapshot = await ref.limit(1).get();
      
      if (snapshot.empty) {
        // Create initial document to establish collection
        await ref.doc('_init').set({
          created: admin.firestore.FieldValue.serverTimestamp(),
          purpose: 'Collection initialization'
