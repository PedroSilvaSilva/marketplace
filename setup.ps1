# CSW Markets Integrator - Setup Script
# PowerShell script for Windows

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "CSW Markets Integrator - Setup" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check if pnpm is installed
Write-Host "Checking dependencies..." -ForegroundColor Yellow
try {
    $pnpmVersion = pnpm --version
    Write-Host "✓ pnpm installed: $pnpmVersion" -ForegroundColor Green
} catch {
    Write-Host "✗ pnpm not found. Installing pnpm..." -ForegroundColor Red
    npm install -g pnpm
}

# Check if Node.js version is sufficient
$nodeVersion = node --version
Write-Host "✓ Node.js version: $nodeVersion" -ForegroundColor Green
Write-Host ""

# Install dependencies
Write-Host "Installing dependencies..." -ForegroundColor Yellow
pnpm install

if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ Dependencies installed successfully" -ForegroundColor Green
} else {
    Write-Host "✗ Failed to install dependencies" -ForegroundColor Red
    exit 1
}
Write-Host ""

# Check if .env exists
if (-Not (Test-Path ".env")) {
    Write-Host "Creating .env file from .env.example..." -ForegroundColor Yellow
    Copy-Item ".env.example" ".env"
    Write-Host "✓ .env file created" -ForegroundColor Green
    Write-Host "⚠ Please update .env with your configuration!" -ForegroundColor Yellow
} else {
    Write-Host "✓ .env file already exists" -ForegroundColor Green
}
Write-Host ""

# Ask if user wants to setup database
$setupDb = Read-Host "Do you want to setup the database now? (y/n)"
if ($setupDb -eq "y" -or $setupDb -eq "Y") {
    Write-Host ""
    Write-Host "Setting up database..." -ForegroundColor Yellow
    
    # Generate Prisma Client
    Write-Host "Generating Prisma Client..." -ForegroundColor Yellow
    pnpm prisma:generate
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✓ Prisma Client generated" -ForegroundColor Green
    } else {
        Write-Host "✗ Failed to generate Prisma Client" -ForegroundColor Red
        Write-Host "Please check your DATABASE_URL in .env file" -ForegroundColor Yellow
    }
    
    # Run migrations
    Write-Host "Running database migrations..." -ForegroundColor Yellow
    pnpm prisma:migrate
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✓ Migrations completed" -ForegroundColor Green
        
        # Ask if user wants to seed database
        $seedDb = Read-Host "Do you want to seed the database with sample data? (y/n)"
        if ($seedDb -eq "y" -or $seedDb -eq "Y") {
            Write-Host "Seeding database..." -ForegroundColor Yellow
            pnpm prisma:seed
            
            if ($LASTEXITCODE -eq 0) {
                Write-Host "✓ Database seeded successfully" -ForegroundColor Green
            } else {
                Write-Host "✗ Failed to seed database" -ForegroundColor Red
            }
        }
    } else {
        Write-Host "✗ Failed to run migrations" -ForegroundColor Red
        Write-Host "Please check your DATABASE_URL in .env file" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Setup completed!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "1. Update .env with your configuration"
Write-Host "2. Run 'pnpm dev' to start development server"
Write-Host "3. Access API at http://localhost:3000"
Write-Host "4. View docs at http://localhost:3000/api/v1/docs"
Write-Host ""
Write-Host "Test credentials (if seeded):" -ForegroundColor Cyan
Write-Host "Admin: admin@cswmarkets.com / Admin@123456"
Write-Host "Manager: manager@cswmarkets.com / Manager@123456"
Write-Host "User: user@cswmarkets.com / User@123456"
Write-Host ""
