# CSW Markets Integrator - Security Guide

## Security Best Practices

### 1. Environment Variables
- **Never commit `.env` files** to version control
- Use strong, random secrets for JWT tokens (min 32 characters)
- Rotate secrets regularly in production
- Use different secrets for development and production

### 2. Authentication & Authorization

#### Password Requirements
- Minimum 8 characters
- Must contain: uppercase, lowercase, number, and special character
- Enforced via validation middleware

#### JWT Tokens
- Access tokens expire in 24 hours
- Refresh tokens expire in 7 days
- Tokens are signed with HS256 algorithm
- Include issuer and audience claims

#### Account Protection
- Maximum 5 failed login attempts
- 15-minute lockout after failed attempts
- Session tracking with IP and User-Agent
- Audit logging for all authentication events

### 3. API Security

#### Rate Limiting
- General API: 100 requests per 15 minutes
- Authentication endpoints: 5 requests per 15 minutes
- Configurable via environment variables

#### Input Validation
- All inputs validated using express-validator
- Sanitization against XSS attacks
- Protection against SQL injection via Prisma

#### HTTP Headers Security (Helmet)
- Content Security Policy (CSP)
- Strict Transport Security (HSTS)
- X-Frame-Options
- X-Content-Type-Options
- XSS Protection

### 4. Database Security

#### Prisma Best Practices
- Parameterized queries (automatic)
- Connection pooling
- Prepared statements
- Type-safe operations

#### Data Protection
- Passwords hashed with BCrypt (12 rounds)
- Soft deletes for data preservation
- Audit logs for all critical operations
- No sensitive data in logs

### 5. CORS Configuration
```typescript
// Whitelist specific origins
CORS_ORIGIN=https://yourdomain.com,https://admin.yourdomain.com

// Enable credentials
CORS_CREDENTIALS=true
```

### 6. Production Checklist

- [ ] Change all default passwords and secrets
- [ ] Enable HTTPS/TLS
- [ ] Configure proper CORS origins
- [ ] Set up proper logging and monitoring
- [ ] Enable database backups
- [ ] Use environment-specific configurations
- [ ] Implement IP whitelisting (if needed)
- [ ] Set up firewall rules
- [ ] Enable audit logging
- [ ] Regular security updates

### 7. Docker Security

#### Production Dockerfile
- Multi-stage builds to reduce image size
- Non-root user (nodejs)
- Minimal base image (alpine)
- Health checks enabled
- Signal handling with dumb-init

#### Docker Compose Security
- Isolated networks
- Volume permissions
- Resource limits (recommended)
- Secrets management

### 8. Monitoring & Logging

#### Winston Logger
- Structured logging format
- Multiple log levels (error, warn, info, debug)
- File rotation (5MB max, 5 files)
- Separate files for errors and exceptions

#### Audit Logging
- User actions tracked in database
- IP address and User-Agent captured
- Old and new values stored for updates
- Timestamps for all events

### 9. Common Vulnerabilities Prevention

#### SQL Injection
✅ Protected via Prisma ORM parameterized queries

#### XSS (Cross-Site Scripting)
✅ Input sanitization middleware
✅ Content Security Policy headers

#### CSRF (Cross-Site Request Forgery)
✅ Token-based authentication (stateless)
✅ Same-origin policy via CORS

#### Brute Force
✅ Rate limiting
✅ Account lockout mechanism

#### Session Hijacking
✅ Short-lived tokens
✅ HTTPS enforcement
✅ Secure and HttpOnly cookies (if using)

### 10. Secure Email Configuration

```env
# Use app-specific passwords for Gmail
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-specific-password
```

### 11. API Key Authentication (Optional)

For third-party integrations:

```typescript
// Add to request headers
'X-API-Key': 'your-api-key'
```

Store API keys securely in database with:
- Hashing
- Expiration dates
- Usage tracking
- IP restrictions

### 12. Emergency Response

#### Compromised Credentials
1. Revoke all refresh tokens
2. Force password reset
3. Review audit logs
4. Notify users

#### Suspected Attack
1. Enable IP blocking
2. Increase logging level
3. Review rate limit settings
4. Monitor error rates

## Security Contacts

Report security vulnerabilities to: security@cswmarkets.com

## Updates

Keep dependencies updated:
```bash
pnpm update --latest
pnpm audit
```

## Compliance

This application implements security practices aligned with:
- OWASP Top 10
- GDPR data protection requirements
- Zero Trust security model
