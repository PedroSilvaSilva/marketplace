# CSW Markets Integrator - Development Scripts
# PowerShell helper scripts

param(
    [Parameter(Position=0)]
    [string]$Command
)

function Show-Help {
    Write-Host ""
    Write-Host "CSW Markets Integrator - Helper Scripts" -ForegroundColor Cyan
    Write-Host "=======================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Usage: .\dev.ps1 <command>" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Available commands:" -ForegroundColor Yellow
    Write-Host "  dev              - Start development server"
    Write-Host "  build            - Build for production"
    Write-Host "  start            - Start production server"
    Write-Host "  db:migrate       - Run database migrations"
    Write-Host "  db:seed          - Seed database with sample data"
    Write-Host "  db:studio        - Open Prisma Studio"
    Write-Host "  db:reset         - Reset database (⚠ deletes all data)"
    Write-Host "  docker:dev       - Start Docker development environment"
    Write-Host "  docker:prod      - Start Docker production environment"
    Write-Host "  docker:down      - Stop Docker containers"
    Write-Host "  docker:logs      - View Docker logs"
    Write-Host "  test             - Run tests"
    Write-Host "  lint             - Lint code"
    Write-Host "  format           - Format code"
    Write-Host "  clean            - Clean build artifacts"
    Write-Host "  help             - Show this help"
    Write-Host ""
}

function Start-Dev {
    Write-Host "Starting development server..." -ForegroundColor Green
    pnpm dev
}

function Start-Build {
    Write-Host "Building for production..." -ForegroundColor Green
    pnpm build
}

function Start-Prod {
    Write-Host "Starting production server..." -ForegroundColor Green
    pnpm start
}

function Run-DbMigrate {
    Write-Host "Running database migrations..." -ForegroundColor Green
    pnpm prisma:migrate
}

function Run-DbSeed {
    Write-Host "Seeding database..." -ForegroundColor Green
    pnpm prisma:seed
}

function Open-DbStudio {
    Write-Host "Opening Prisma Studio..." -ForegroundColor Green
    pnpm prisma:studio
}

function Reset-Database {
    $confirm = Read-Host "⚠ This will delete all data. Are you sure? (yes/no)"
    if ($confirm -eq "yes") {
        Write-Host "Resetting database..." -ForegroundColor Red
        pnpm prisma migrate reset
    } else {
        Write-Host "Database reset cancelled" -ForegroundColor Yellow
    }
}

function Start-DockerDev {
    Write-Host "Starting Docker development environment..." -ForegroundColor Green
    docker-compose --profile dev up
}

function Start-DockerProd {
    Write-Host "Starting Docker production environment..." -ForegroundColor Green
    docker-compose --profile prod up -d
}

function Stop-Docker {
    Write-Host "Stopping Docker containers..." -ForegroundColor Yellow
    docker-compose down
}

function Show-DockerLogs {
    Write-Host "Viewing Docker logs..." -ForegroundColor Green
    docker-compose logs -f
}

function Run-Tests {
    Write-Host "Running tests..." -ForegroundColor Green
    pnpm test
}

function Run-Lint {
    Write-Host "Linting code..." -ForegroundColor Green
    pnpm lint
}

function Run-Format {
    Write-Host "Formatting code..." -ForegroundColor Green
    pnpm format
}

function Clean-Build {
    Write-Host "Cleaning build artifacts..." -ForegroundColor Yellow
    if (Test-Path "dist") {
        Remove-Item -Recurse -Force "dist"
        Write-Host "✓ Removed dist folder" -ForegroundColor Green
    }
    if (Test-Path "node_modules/.cache") {
        Remove-Item -Recurse -Force "node_modules/.cache"
        Write-Host "✓ Removed cache" -ForegroundColor Green
    }
    Write-Host "✓ Clean completed" -ForegroundColor Green
}

# Main script logic
switch ($Command) {
    "dev" { Start-Dev }
    "build" { Start-Build }
    "start" { Start-Prod }
    "db:migrate" { Run-DbMigrate }
    "db:seed" { Run-DbSeed }
    "db:studio" { Open-DbStudio }
    "db:reset" { Reset-Database }
    "docker:dev" { Start-DockerDev }
    "docker:prod" { Start-DockerProd }
    "docker:down" { Stop-Docker }
    "docker:logs" { Show-DockerLogs }
    "test" { Run-Tests }
    "lint" { Run-Lint }
    "format" { Run-Format }
    "clean" { Clean-Build }
    "help" { Show-Help }
    default {
        if ($Command) {
            Write-Host "Unknown command: $Command" -ForegroundColor Red
        }
        Show-Help
    }
}
