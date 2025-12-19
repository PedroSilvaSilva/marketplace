# CSW Markets Integrator

Enterprise-grade API integrator for multiple business areas with zero trust security architecture.

## 🚀 Features

- **TypeScript** - Full type safety and modern JavaScript features
- **Express.js** - Fast, unopinionated web framework
- **Prisma ORM** - Type-safe database access with PostgreSQL
- **JWT + Passport** - Secure authentication and authorization
- **Zero Trust Security** - Multiple security layers (Helmet, Rate Limiting, Input Sanitization)
- **Email Service** - Nodemailer integration with templates
- **Swagger/OpenAPI** - Auto-generated API documentation
- **Docker** - Containerized development and production environments
- **MVC Architecture** - Clean, maintainable code structure
- **Audit Logging** - Complete activity tracking
- **Soft Deletes** - Data preservation with logical deletion

## 📋 Prerequisites

- Node.js >= 20.0.0
- pnpm >= 9.0.0
- PostgreSQL >= 14
- Docker & Docker Compose (optional)

## 🛠️ Installation

### 1. Clone the repository

```bash
git clone <repository-url>
cd cswmarkets
```

### 2. Install dependencies

```bash
pnpm install
```

### 3. Configure environment variables

```bash
cp .env.example .env
```

Edit `.env` with your configuration:

```env
DATABASE_URL="postgresql://user:password@localhost:5432/cswmarkets?schema=public"
JWT_SECRET=your-super-secret-jwt-key
# ... other configurations
```

### 4. Setup database

```bash
# Generate Prisma Client
pnpm prisma:generate

# Run migrations
pnpm prisma:migrate

# (Optional) Open Prisma Studio
pnpm prisma:studio
```

## 🚀 Running the Application

### Development Mode

```bash
pnpm dev
```

### Production Mode

```bash
# Build the application
pnpm build

# Start production server
pnpm start
```

### Using Docker

#### Development

```bash
docker-compose --profile dev up
```

#### Production

```bash
docker-compose --profile prod up -d
```

#### With Database Tools

```bash
docker-compose --profile tools up
```

Access:
- **API**: http://localhost:3000
- **Swagger Docs**: http://localhost:3000/api/v1/docs
- **pgAdmin**: http://localhost:5050

## 📁 Project Structure

```
cswmarkets/
├── prisma/
│   └── schema.prisma          # Database schema
├── src/
│   ├── config/                # Configuration files
│   │   ├── index.ts           # Environment config
│   │   ├── database.ts        # Prisma client
│   │   ├── logger.ts          # Winston logger
│   │   ├── passport.ts        # Passport JWT strategy
│   │   └── swagger.ts         # Swagger configuration
│   ├── middlewares/           # Express middlewares
│   │   ├── auth.ts            # Authentication & authorization
│   │   ├── errorHandler.ts   # Error handling
│   │   ├── security.ts        # Security middlewares
│   │   └── validator.ts       # Input validation
│   ├── modules/               # Business modules (MVC)
│   │   ├── auth/
│   │   │   ├── auth.controller.ts
│   │   │   ├── auth.service.ts
│   │   │   └── auth.routes.ts
│   │   └── customer/
│   │       ├── customer.controller.ts
│   │       ├── customer.service.ts
│   │       └── customer.routes.ts
│   ├── utils/                 # Utility functions
│   │   ├── crypto.ts          # Encryption & JWT
│   │   ├── email.ts           # Email service
│   │   ├── errors.ts          # Custom error classes
│   │   └── response.ts        # API response helpers
│   ├── app.ts                 # Express app setup
│   └── server.ts              # Server entry point
├── .env                       # Environment variables
├── .env.example               # Example environment variables
├── docker-compose.yml         # Docker compose configuration
├── Dockerfile                 # Docker configuration
├── package.json               # Dependencies and scripts
├── tsconfig.json              # TypeScript configuration
└── README.md                  # This file
```

## 🔐 Security Features

### Zero Trust Architecture

- **Helmet** - Secure HTTP headers
- **CORS** - Configurable Cross-Origin Resource Sharing
- **Rate Limiting** - Protection against brute force attacks
- **Input Sanitization** - XSS and injection prevention
- **JWT Authentication** - Stateless authentication
- **Password Hashing** - BCrypt with configurable rounds
- **Account Locking** - Automatic lockout after failed attempts
- **Audit Logging** - Complete activity tracking
- **Session Management** - Token-based session control

## 📚 API Documentation

Once the server is running, access the interactive API documentation at:

```
http://localhost:3000/api/v1/docs
```

### Available Endpoints

#### Authentication
- `POST /api/v1/auth/register` - Register new user
- `POST /api/v1/auth/login` - User login
- `POST /api/v1/auth/refresh` - Refresh access token
- `POST /api/v1/auth/logout` - User logout
- `POST /api/v1/auth/verify-email` - Verify email address
- `POST /api/v1/auth/forgot-password` - Request password reset
- `POST /api/v1/auth/reset-password` - Reset password
- `GET /api/v1/auth/me` - Get current user

#### Customers
- `GET /api/v1/customers` - List all customers (paginated)
- `GET /api/v1/customers/:id` - Get customer by ID
- `POST /api/v1/customers` - Create new customer
- `PUT /api/v1/customers/:id` - Update customer
- `DELETE /api/v1/customers/:id` - Delete customer

## 🧪 Testing

```bash
# Run tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Generate coverage report
pnpm test:coverage
```

## 🔧 Available Scripts

```bash
pnpm dev              # Start development server
pnpm build            # Build for production
pnpm start            # Start production server
pnpm lint             # Lint code
pnpm lint:fix         # Fix linting issues
pnpm format           # Format code with Prettier
pnpm prisma:generate  # Generate Prisma Client
pnpm prisma:migrate   # Run database migrations
pnpm prisma:studio    # Open Prisma Studio
pnpm test             # Run tests
```

## 🌍 Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `NODE_ENV` | Environment mode | `development` |
| `PORT` | Server port | `3000` |
| `DATABASE_URL` | PostgreSQL connection string | - |
| `JWT_SECRET` | JWT secret key (min 32 chars) | - |
| `JWT_EXPIRES_IN` | JWT expiration time | `24h` |
| `SMTP_HOST` | Email server host | - |
| `SMTP_PORT` | Email server port | `587` |
| `SMTP_USER` | Email account username | - |
| `SMTP_PASSWORD` | Email account password | - |
| `RATE_LIMIT_WINDOW_MS` | Rate limit window | `900000` |
| `RATE_LIMIT_MAX_REQUESTS` | Max requests per window | `100` |

## 📝 Database Migrations

```bash
# Create a new migration
pnpm prisma migrate dev --name migration_name

# Deploy migrations to production
pnpm prisma:deploy

# Reset database (WARNING: Deletes all data)
pnpm prisma migrate reset
```

## 🐳 Docker Commands

```bash
# Build and start all services
docker-compose up --build

# Start in detached mode
docker-compose up -d

# Stop all services
docker-compose down

# View logs
docker-compose logs -f

# Execute commands in container
docker-compose exec app sh
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the ISC License.

## 👥 Support

For support, email support@cswmarkets.com or open an issue in the repository.

## 🎯 Roadmap

- [ ] Redis integration for caching
- [ ] WebSocket support for real-time updates
- [ ] GraphQL API
- [ ] Multi-tenancy support
- [ ] Advanced analytics and reporting
- [ ] Integration with third-party services
- [ ] Mobile app
- [ ] Microservices architecture

---

**Made with ❤️ by the CSW Markets team**
