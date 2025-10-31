# Development Guide

This guide covers setting up cluster-code for local development and contribution.

## Prerequisites

- Node.js 18.0.0 or higher
- npm or yarn
- kubectl (for testing cluster operations)
- git

## Quick Start

1. **Clone the repository**:
   ```bash
   git clone https://github.com/kcns008/cluster-code.git
   cd cluster-code
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Build the project**:
   ```bash
   npm run build
   ```

4. **Link for local testing**:
   ```bash
   npm link
   ```

   Now you can use `cluster-code` command globally, and it will use your local development version.

## Development Workflow

### Project Structure

```
cluster-code/
├── src/                      # TypeScript source files
│   ├── cli.ts               # Main CLI entry point
│   ├── index.ts             # Library exports
│   ├── commands/            # Command implementations
│   │   ├── init.ts
│   │   ├── diagnose.ts
│   │   └── config.ts
│   ├── chat/                # Interactive chat mode
│   │   └── index.ts
│   ├── config/              # Configuration management
│   │   └── index.ts
│   ├── utils/               # Utility functions
│   │   ├── kubectl.ts
│   │   └── logger.ts
│   └── types/               # TypeScript type definitions
│       └── index.ts
├── bin/                      # Binary entry point
│   └── cluster-code.js
├── dist/                     # Compiled JavaScript (generated)
├── .claude/                  # Claude Code commands and agents
├── plugins/                  # Plugin implementations
├── docs/                     # Documentation
├── examples/                 # Example configurations
└── package.json
```

### Available Scripts

- `npm run build` - Compile TypeScript to JavaScript
- `npm run watch` - Watch mode for development
- `npm run dev` - Run CLI in development mode with ts-node
- `npm run clean` - Remove build artifacts
- `npm run lint` - Run ESLint
- `npm run format` - Format code with Prettier
- `npm test` - Run tests (when implemented)

### Making Changes

1. **Create a feature branch**:
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes** in the `src/` directory

3. **Build and test**:
   ```bash
   npm run build
   cluster-code --version  # Test your changes
   ```

4. **Run linting**:
   ```bash
   npm run lint
   npm run format
   ```

5. **Commit your changes**:
   ```bash
   git add .
   git commit -m "Description of your changes"
   ```

6. **Push and create PR**:
   ```bash
   git push origin feature/your-feature-name
   ```

## Adding New Commands

To add a new command to cluster-code:

1. **Create command file** in `src/commands/`:
   ```typescript
   // src/commands/my-command.ts
   import { logger } from '../utils/logger';

   export async function myCommand(options: any): Promise<void> {
     logger.info('Running my command...');
     // Implementation
   }
   ```

2. **Export from commands/index.ts**:
   ```typescript
   export { myCommand } from './my-command';
   ```

3. **Register in cli.ts**:
   ```typescript
   program
     .command('my-command')
     .description('Description of my command')
     .option('-f, --flag', 'Example flag')
     .action(async (options) => {
       await myCommand(options);
     });
   ```

4. **Build and test**:
   ```bash
   npm run build
   cluster-code my-command --help
   ```

## Adding New Utilities

Create utility functions in `src/utils/`:

```typescript
// src/utils/my-util.ts
export async function myUtility(): Promise<string> {
  // Implementation
  return 'result';
}
```

## TypeScript Configuration

The project uses strict TypeScript settings. Key configurations:

- Target: ES2020
- Module: CommonJS
- Strict mode enabled
- Source maps generated

See `tsconfig.json` for full configuration.

## Testing

### Manual Testing

1. **Link for testing**:
   ```bash
   npm link
   ```

2. **Test commands**:
   ```bash
   cluster-code --version
   cluster-code --help
   cluster-code init --help
   ```

3. **Test with kubectl** (requires cluster access):
   ```bash
   cluster-code init
   cluster-code diagnose
   ```

### Unlink after testing

```bash
npm unlink -g @cluster-code/cluster-code
```

## Debugging

### Using VS Code

Create `.vscode/launch.json`:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "launch",
      "name": "Debug CLI",
      "program": "${workspaceFolder}/bin/cluster-code.js",
      "args": ["--help"],
      "outFiles": ["${workspaceFolder}/dist/**/*.js"],
      "sourceMaps": true
    }
  ]
}
```

### Using Node Inspector

```bash
node --inspect-brk bin/cluster-code.js --help
```

Then open `chrome://inspect` in Chrome.

## Code Style

- Use TypeScript for all source files
- Follow ESLint rules (`.eslintrc.json`)
- Use Prettier for formatting (`.prettierrc.json`)
- Add JSDoc comments for public APIs
- Use descriptive variable and function names

## Git Workflow

1. Create feature branch from `main`
2. Make changes and commit with clear messages
3. Push to GitHub and create Pull Request
4. Ensure CI passes
5. Request review
6. Merge after approval

## Contribution Guidelines

- Follow existing code style
- Add tests for new features (when test framework is set up)
- Update documentation for user-facing changes
- Keep commits atomic and well-described
- Reference issues in commit messages

## Plugin Development

Cluster-code supports plugins via the `.claude-plugin` system. See existing plugins in the `plugins/` directory for examples.

### Creating a Plugin

1. Create plugin directory in `plugins/my-plugin/`
2. Add `.claude-plugin/plugin.json`
3. Create command files in `commands/`
4. Update marketplace.json

See [Plugin Development Guide](docs/plugin-development.md) for details.

## Environment Variables

- `ANTHROPIC_API_KEY` - API key for Claude integration
- `DEBUG` - Enable debug logging
- `VERBOSE` - Enable verbose output

## Troubleshooting Development Issues

### Build fails

```bash
# Clean and rebuild
npm run clean
rm -rf node_modules package-lock.json
npm install
npm run build
```

### TypeScript errors

Check `tsconfig.json` settings and ensure all dependencies have type definitions.

### Binary not working after npm link

```bash
chmod +x bin/cluster-code.js
npm unlink -g @cluster-code/cluster-code
npm link
```

## Resources

- [TypeScript Documentation](https://www.typescriptlang.org/docs/)
- [Commander.js](https://github.com/tj/commander.js)
- [Inquirer.js](https://github.com/SBoudrias/Inquirer.js)
- [Anthropic SDK](https://github.com/anthropics/anthropic-sdk-typescript)

## Getting Help

- GitHub Issues: https://github.com/kcns008/cluster-code/issues
- Discussions: https://github.com/kcns008/cluster-code/discussions

## License

MIT - See LICENSE.md for details
