# CSW Markets Integrator - Installation Guide

## Quick Start

### Option 1: Local Development

1. **Install dependencies**
```powershell
pnpm install
```

2. **Setup PostgreSQL**
   - Install PostgreSQL 14+ or use Docker:
```powershell
docker run --name postgres -e POSTGRES_PASSWORD=postgres -p 5432:5432 -d postgres:16-alpine
```

3. **Configure environment**
```powershell
cp .env.example .env
```
   Edit `.env` with your database credentials.

4. **Initialize database**
```powershell
pnpm prisma:generate
pnpm prisma:migrate
```

5. **Start development server**
```powershell
pnpm dev
```

Access:
- API: http://localhost:3000
- Docs: http://localhost:3000/api/v1/docs

### Option 2: Docker (Recommended)

1. **Start all services**
```powershell
docker-compose --profile dev up
```

This will start:
- PostgreSQL database
- Redis cache
- Development server with hot reload

2. **Run migrations**
```powershell
docker-compose exec app-dev pnpm prisma:migrate
```

### Option 3: Production Docker

```powershell
docker-compose --profile prod up -d
```

## Database Management

### Using Prisma Studio
```powershell
pnpm prisma:studio
```

### Using pgAdmin
```powershell
docker-compose --profile tools up
```
Access pgAdmin at http://localhost:5050

## Troubleshooting

### Port already in use
```powershell
# Change PORT in .env file
PORT=3001
```

### Database connection errors
```powershell
# Verify PostgreSQL is running
docker ps

# Check logs
docker-compose logs postgres
```

### Module not found errors
```powershell
# Reinstall dependencies
rm -rf node_modules
pnpm install
```

## Next Steps

1. Create your first user via API or Prisma Studio
2. Test authentication endpoints
3. Explore Swagger documentation
4. Add your business modules

## Support

- Documentation: README.md
- API Docs: http://localhost:3000/api/v1/docs
- Issues: Open a GitHub issue
