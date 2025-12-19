# Contributing to CSW Markets Integrator

Thank you for considering contributing to CSW Markets Integrator! This document provides guidelines for contributions.

## Code of Conduct

- Be respectful and inclusive
- Provide constructive feedback
- Focus on the code, not the person
- Help create a welcoming environment

## How to Contribute

### Reporting Bugs

1. Check if the bug has already been reported
2. Use the bug report template
3. Include:
   - Description of the bug
   - Steps to reproduce
   - Expected behavior
   - Actual behavior
   - Environment details (OS, Node version, etc.)
   - Screenshots if applicable

### Suggesting Enhancements

1. Check if the enhancement has already been suggested
2. Clearly describe the enhancement
3. Explain why it would be useful
4. Provide examples if possible

### Pull Requests

1. Fork the repository
2. Create a feature branch:
   ```bash
   git checkout -b feature/your-feature-name
   ```
3. Make your changes following our coding standards
4. Write or update tests
5. Run tests and ensure they pass:
   ```bash
   pnpm test
   ```
6. Run linting:
   ```bash
   pnpm lint:fix
   ```
7. Format your code:
   ```bash
   pnpm format
   ```
8. Commit your changes with a descriptive message:
   ```bash
   git commit -m "feat: add new feature"
   ```
9. Push to your fork:
   ```bash
   git push origin feature/your-feature-name
   ```
10. Open a Pull Request

## Commit Message Convention

We follow the Conventional Commits specification:

- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation changes
- `style:` - Code style changes (formatting, etc.)
- `refactor:` - Code refactoring
- `test:` - Adding or updating tests
- `chore:` - Maintenance tasks

Examples:
```
feat: add customer export functionality
fix: resolve authentication token expiration issue
docs: update API documentation for customers endpoint
```

## Coding Standards

### TypeScript

- Use TypeScript for all code
- Enable strict mode
- Avoid using `any` type
- Use interfaces for object structures
- Use enums for fixed values

### Code Style

- Follow the ESLint configuration
- Use Prettier for formatting
- Write self-documenting code
- Add comments for complex logic
- Keep functions small and focused

### Naming Conventions

- **Variables/Functions**: camelCase
- **Classes/Interfaces**: PascalCase
- **Constants**: UPPER_SNAKE_CASE
- **Files**: kebab-case or PascalCase (for classes)

### Architecture

- Follow MVC pattern
- Controllers handle HTTP requests/responses
- Services contain business logic
- Models define data structure (Prisma)
- Keep routes clean and organized

### Security

- Never commit sensitive data
- Validate all inputs
- Sanitize user inputs
- Use prepared statements (Prisma handles this)
- Follow OWASP guidelines

## Testing

- Write tests for new features
- Maintain test coverage
- Test edge cases
- Test error scenarios

## Documentation

- Update README if needed
- Document new API endpoints in Swagger
- Add JSDoc comments for public functions
- Update relevant documentation files

## Database Changes

1. Create migrations for schema changes:
   ```bash
   pnpm prisma migrate dev --name description
   ```
2. Update seed file if needed
3. Document breaking changes

## Review Process

1. All PRs require review
2. Address review comments
3. Ensure CI/CD passes
4. Maintain backwards compatibility when possible

## Questions?

Feel free to open an issue for questions or discussions.

## License

By contributing, you agree that your contributions will be licensed under the ISC License.

Thank you for contributing! 🎉
