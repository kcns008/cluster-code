# NPM Publishing Guide for cluster-code

This guide explains how to publish `@cluster-code/cluster-code` to npm so users can install it globally.

## Prerequisites

1. **npm account**: You need an npm account. Create one at https://www.npmjs.com/signup
2. **npm login**: Log in to npm on your command line:
   ```bash
   npm login
   ```
3. **Organization (optional)**: If you want to publish under `@cluster-code` scope, you'll need to create an organization on npm or use your own username scope.

## Pre-Publishing Checklist

- [x] TypeScript builds successfully (`npm run build`)
- [x] Binary entry point is executable
- [x] package.json has correct metadata
- [x] README.md is up to date
- [x] .npmignore excludes development files
- [x] Version number is set correctly

## Publishing Steps

### 1. Test Local Installation

Before publishing, test the package locally:

```bash
# Link the package globally for testing
npm link

# Test the CLI
cluster-code --version
cluster-code --help

# Unlink when done testing
npm unlink -g @cluster-code/cluster-code
```

### 2. Build the Package

```bash
# Clean previous builds
npm run clean

# Install dependencies
npm install

# Build TypeScript
npm run build

# Verify dist/ directory exists and contains compiled files
ls -la dist/
```

### 3. Test Package Contents

See what files will be published:

```bash
npm pack --dry-run
```

This shows you exactly what files will be included in the published package.

### 4. Publish to npm

#### For First Time Publishing

If using a scoped package name (`@cluster-code/cluster-code`), you need to specify access:

```bash
# Publish as public package (required for scoped packages)
npm publish --access public
```

#### For Updates

For subsequent releases:

```bash
# Update version number first (choose one):
npm version patch  # 1.0.0 -> 1.0.1
npm version minor  # 1.0.0 -> 1.1.0
npm version major  # 1.0.0 -> 2.0.0

# Then publish
npm publish
```

### 5. Verify Publication

After publishing, verify your package:

```bash
# Install your package globally
npm install -g @cluster-code/cluster-code

# Test it works
cluster-code --version
cluster-code --help
```

## Alternative: Using a Different Scope

If you don't have access to the `@cluster-code` organization, you can:

1. **Use your own scope**:
   ```json
   {
     "name": "@your-username/cluster-code"
   }
   ```

2. **Use no scope** (unscoped package):
   ```json
   {
     "name": "cluster-code-cli"
   }
   ```

   Note: Unscoped names must be unique across all of npm.

## Publishing to GitHub Packages (Alternative)

If you prefer GitHub Packages:

1. Create `.npmrc` in your project:
   ```
   @cluster-code:registry=https://npm.pkg.github.com
   ```

2. Update package.json:
   ```json
   {
     "name": "@kcns008/cluster-code",
     "repository": "https://github.com/kcns008/cluster-code"
   }
   ```

3. Authenticate with GitHub:
   ```bash
   npm login --registry=https://npm.pkg.github.com
   ```

4. Publish:
   ```bash
   npm publish --registry=https://npm.pkg.github.com
   ```

## Continuous Deployment

For automated publishing via GitHub Actions, see `.github/workflows/npm-publish.yml`.

## Version Management

Follow semantic versioning (semver):

- **PATCH** (1.0.x): Bug fixes and minor changes
- **MINOR** (1.x.0): New features, backward compatible
- **MAJOR** (x.0.0): Breaking changes

## Troubleshooting

### "Package already exists"

The package name is taken. Choose a different name or scope.

### "You must be logged in to publish packages"

Run `npm login` first.

### "You do not have permission to publish"

For scoped packages, use `--access public` or ensure you have access to the organization.

### Binary not executable after installation

Ensure `bin/cluster-code.js` has:
```javascript
#!/usr/bin/env node
```
at the top and is executable (`chmod +x bin/cluster-code.js`).

## Post-Publishing

1. **Tag the release in git**:
   ```bash
   git tag v1.0.0
   git push origin v1.0.0
   ```

2. **Update documentation**:
   - Update README with installation instructions
   - Create GitHub release with changelog

3. **Announce**:
   - Share on social media
   - Update project website
   - Notify users in Discord/Slack

## Testing User Installation

Test as a real user would:

```bash
# Create a test directory
mkdir /tmp/test-cluster-code
cd /tmp/test-cluster-code

# Install globally
npm install -g @cluster-code/cluster-code

# Test commands
cluster-code --version
cluster-code --help

# Clean up
npm uninstall -g @cluster-code/cluster-code
```

## Support

- Report issues: https://github.com/kcns008/cluster-code/issues
- Documentation: https://github.com/kcns008/cluster-code#readme
