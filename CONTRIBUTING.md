# Contributing to Referral Bot

Thank you for considering contributing to the Referral Bot project! This document provides guidelines and information for contributors.

## 🤝 How to Contribute

### Reporting Bugs

1. **Check existing issues** - Search through existing issues to avoid duplicates
2. **Create a detailed bug report** - Include:
   - Clear description of the bug
   - Steps to reproduce
   - Expected vs actual behavior
   - Environment details (Node.js version, OS, etc.)
   - Screenshots if applicable

### Suggesting Features

1. **Check existing feature requests** - Avoid duplicates
2. **Create a detailed feature request** - Include:
   - Clear description of the feature
   - Use cases and benefits
   - Possible implementation approach
   - Any relevant examples

### Code Contributions

1. **Fork the repository**
2. **Create a feature branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```
3. **Make your changes**
4. **Add tests** for new functionality
5. **Run the test suite**
   ```bash
   npm test
   ```
6. **Run the linter**
   ```bash
   npm run lint
   ```
7. **Commit your changes**
   ```bash
   git commit -m "Add: your feature description"
   ```
8. **Push to your fork**
   ```bash
   git push origin feature/your-feature-name
   ```
9. **Create a Pull Request**

## 📝 Code Style Guidelines

### JavaScript Style
- Use ES6+ features
- Follow ESLint configuration
- Use meaningful variable names
- Add comments for complex logic
- Keep functions small and focused

### Commit Messages
Follow conventional commit format:
- `feat:` - New features
- `fix:` - Bug fixes
- `docs:` - Documentation changes
- `style:` - Code style changes
- `refactor:` - Code refactoring
- `test:` - Test additions/changes
- `chore:` - Maintenance tasks

### File Structure
- Keep files organized in appropriate directories
- Use descriptive file names
- Separate concerns (handlers, services, utils)
- Follow existing patterns

## 🧪 Testing

### Writing Tests
- Write tests for all new functionality
- Use descriptive test names
- Test both success and error cases
- Mock external dependencies
- Aim for high test coverage

### Running Tests
```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run with coverage
npm test -- --coverage
```

## 📚 Documentation

### Code Documentation
- Add JSDoc comments for functions
- Document complex algorithms
- Include usage examples
- Keep README.md updated

### API Documentation
- Document all API endpoints
- Include request/response examples
- Document error codes
- Keep OpenAPI spec updated

## 🔧 Development Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/referral-bot.git
   cd referral-bot
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Run setup script**
   ```bash
   npm run setup
   ```

5. **Start development server**
   ```bash
   npm run dev
   ```

## 🚀 Release Process

1. **Version Bump**
   - Update version in package.json
   - Update CHANGELOG.md
   - Create version tag

2. **Testing**
   - Run full test suite
   - Test in staging environment
   - Verify all features work

3. **Deployment**
   - Deploy to production
   - Monitor for issues
   - Update documentation

## 📋 Pull Request Checklist

Before submitting a PR, ensure:

- [ ] Code follows project style guidelines
- [ ] Tests are written and passing
- [ ] Documentation is updated
- [ ] Commit messages follow convention
- [ ] No merge conflicts
- [ ] PR description is clear and detailed

## 🆘 Getting Help

If you need help:
- Check existing documentation
- Search through issues
- Ask questions in discussions
- Contact maintainers

## 📄 License

By contributing, you agree that your contributions will be licensed under the MIT License.

## 🙏 Recognition

Contributors will be recognized in:
- README.md contributors section
- Release notes
- Project documentation

Thank you for contributing! 🎉
```

```markdown:CHANGELOG.md
# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Multi-language support planning
- Advanced analytics features
- Mobile app integration planning

### Changed
- Improved error handling
- Enhanced security measures

### Fixed
- Minor bug fixes

## [1.0.0] - 2024-01-15

### Added
- Initial release of Referral Bot
- Telegram bot with comprehensive command system
- User management and authentication
- Phone verification system
- Referral code generation and tracking
- Company registration and management
- Order processing and approval system
- Withdrawal system with multiple payment methods
- Admin panel with full platform control
- Real-time analytics and reporting
- Firebase Firestore integration
- REST API for external integrations
- Comprehensive logging system
- Rate limiting and security features
- Docker support
- CI/CD pipeline setup
- Comprehensive test suite
- Documentation and setup guides

### Features
#### User Features
- Account creation and profile management
- Phone number verification
- Referral code generation for multiple companies
- Earnings tracking and analytics
- Withdrawal requests (PayPal, Bank, Crypto, Wise)
- Product browsing and discovery
- Help and support system

#### Company Features
- Company registration and verification
- Dashboard with analytics
- Order management and approval
- Referrer performance tracking
- Billing and payment management
- Product/service management

#### Admin Features
- Complete platform oversight
- User and company management
- Withdrawal approval system
- System-wide analytics
- Broadcast messaging
- Platform configuration
- Security monitoring

#### Technical Features
- Scalable Node.js architecture
- Firebase Firestore database
- Telegraf bot framework
- Express.js REST API
- Winston logging
- Joi validation
- Security middleware (Helmet, CORS, Rate Limiting)
- Docker containerization
- GitHub Actions CI/CD
- Comprehensive test coverage
- ESLint code quality
- Environment-based configuration

### Security
- Input validation and sanitization
- Rate limiting on API endpoints
- Secure environment variable handling
- Firebase security rules
- HTTPS enforcement
- Security headers implementation

### Performance
- Efficient database queries
- Caching strategies
- Optimized bot response times
- Resource usage monitoring
- Error handling and recovery

### Documentation
- Complete README with setup instructions
- API documentation
- Code comments and JSDoc
- Contributing guidelines
- Deployment guides
- Environment configuration examples

## [0.1.0] - 2024-01-01

### Added
- Project initialization
- Basic project structure
- Development environment setup
- Initial planning and architecture

---

## Release Notes

### v1.0.0 Release Highlights

🎉 **Major Release**: Full-featured referral marketing platform

**Key Features:**
- Complete Telegram bot with intuitive commands
- Multi-role system (Users, Companies, Admins)
- Real-time analytics and reporting
- Secure withdrawal system
- Comprehensive admin controls

**Technical Improvements:**
- Production-ready architecture
- Comprehensive test coverage
- Security best practices
- Docker support
- CI/CD pipeline

**Getting Started:**
1. Clone the repository
2. Copy `.env.example` to `.env`
3. Configure your environment variables
4. Run `npm run setup`
5. Start with `npm start`

**Support:**
- Documentation: README.md
- Issues: GitHub Issues
- Contact: your-email@example.com

Thank you to all contributors who made this release possible! 🙏
```

```markdown:LICENSE
MIT License

Copyright (c) 2024 Referral Bot

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
