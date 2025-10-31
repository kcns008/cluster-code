# Cluster Code Documentation

This directory contains the complete documentation website for Cluster Code, powered by Jekyll and hosted on GitHub Pages.

## 🌐 Live Documentation

Visit the live documentation at: **https://your-org.github.io/cluster-code**

## 📁 Structure

```
docs/
├── _config.yml                 # Jekyll site configuration
├── index.md                    # Home page
├── guides/                     # User guides
│   ├── getting-started.md     # Getting started guide
│   ├── installation.md        # Installation instructions
│   ├── configuration.md       # Configuration reference
│   ├── cloud-providers.md     # Cloud provider setup
│   └── ...
├── api/                        # API reference
│   ├── commands.md            # Command reference
│   ├── agents.md              # Agents documentation
│   ├── mcp-servers.md         # MCP server reference
│   └── configuration.md       # Config schema
├── tutorials/                  # Step-by-step tutorials
│   ├── first-cluster.md       # Create first cluster
│   ├── helm-deployment.md     # Deploy with Helm
│   └── ...
├── plugins/                    # Plugin documentation
│   ├── cluster-core.md
│   ├── cloud-azure.md
│   ├── cloud-aws.md
│   └── ...
└── assets/                     # Static assets
    ├── css/
    ├── js/
    └── images/
```

## 🚀 Local Development

### Prerequisites

- Ruby 2.7+
- Bundler
- Jekyll

### Setup

1. **Install dependencies:**
   ```bash
   cd docs
   gem install bundler jekyll
   bundle install
   ```

2. **Run local server:**
   ```bash
   bundle exec jekyll serve
   ```

3. **View site:**
   Open http://localhost:4000/cluster-code

### Build Site

```bash
bundle exec jekyll build
```

Output will be in `_site/` directory.

## 📝 Writing Documentation

### Adding a New Guide

1. Create a new markdown file in `guides/`:
   ```markdown
   ---
   layout: guide
   title: Your Guide Title
   nav_order: 5
   description: "Brief description"
   permalink: /guides/your-guide
   ---

   # Your Guide Title

   Content here...
   ```

2. Add to navigation in `_config.yml` if needed.

### Adding a Tutorial

1. Create markdown file in `tutorials/`:
   ```markdown
   ---
   layout: tutorial
   title: Tutorial Title
   parent: Tutorials
   nav_order: 1
   description: "Tutorial description"
   permalink: /tutorials/your-tutorial
   ---

   # Tutorial Title
   {: .no_toc }

   Description
   {: .fs-6 .fw-300 }

   **Estimated time:** 30 minutes
   {: .label .label-purple }

   **Difficulty:** Beginner
   {: .label .label-green }

   ## Table of Contents
   {: .no_toc .text-delta }

   1. TOC
   {:toc}

   ---

   Content here...
   ```

### Adding Plugin Documentation

Create `plugins/plugin-name.md`:
```markdown
---
layout: plugin
title: Plugin Name
parent: Plugins
nav_order: 1
description: "Plugin description"
permalink: /plugins/plugin-name
---

# Plugin Name

Description and usage...
```

## 🎨 Styling

The site uses Jekyll's default theme with custom styling in `assets/css/`.

### Labels

```markdown
{: .label .label-green }      <!-- Green label -->
{: .label .label-blue }       <!-- Blue label -->
{: .label .label-purple }     <!-- Purple label -->
{: .label .label-yellow }     <!-- Yellow label -->
{: .label .label-red }        <!-- Red label -->
```

### Callouts

```markdown
{: .note }
> Note content

{: .warning }
> Warning content

{: .important }
> Important content
```

### Code Blocks

````markdown
```bash
# Command example
cluster-code diagnose
```

```yaml
# YAML example
apiVersion: v1
kind: Pod
```
````

## 🔧 Configuration

Key configuration in `_config.yml`:

- **Site settings**: Title, description, URLs
- **Navigation**: Menu structure
- **Collections**: Guides, API docs, tutorials
- **Theme settings**: Colors, layouts

## 📦 Deployment

### GitHub Pages (Automatic)

1. **Enable GitHub Pages** in repository settings
2. **Set source** to `docs/` directory
3. **Custom domain** (optional): Add CNAME file

GitHub will automatically build and deploy on push to main branch.

### Manual Deployment

```bash
# Build site
bundle exec jekyll build

# Deploy _site/ directory to your hosting
```

## 🔍 Search

Search functionality is built-in with Jekyll themes. Configuration in `_config.yml`:

```yaml
features:
  search: true
```

## 📊 Analytics

Add Google Analytics in `_config.yml`:

```yaml
google_analytics: UA-XXXXXXXXX-X
```

## 🤝 Contributing

To contribute to documentation:

1. Fork repository
2. Create feature branch
3. Add/edit documentation
4. Test locally with Jekyll
5. Submit pull request

### Documentation Guidelines

- Use clear, concise language
- Include code examples
- Add screenshots where helpful
- Keep consistent formatting
- Link to related pages
- Update navigation in `_config.yml`

## 📖 Resources

- [Jekyll Documentation](https://jekyllrb.com/docs/)
- [GitHub Pages](https://pages.github.com/)
- [Markdown Guide](https://www.markdownguide.org/)
- [Just the Docs Theme](https://just-the-docs.github.io/just-the-docs/)

## 🐛 Issues

Report documentation issues at: https://github.com/your-org/cluster-code/issues

## 📜 License

Documentation is licensed under CC BY 4.0.
Code examples are licensed under MIT (same as Cluster Code).

---

## Quick Links

- [Live Documentation](https://your-org.github.io/cluster-code)
- [Main Repository](https://github.com/your-org/cluster-code)
- [Getting Started](/guides/getting-started)
- [API Reference](/api/commands)
- [Tutorials](/tutorials/first-cluster)
