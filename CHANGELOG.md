# Changelog

## 0.1.0 - Initial Release (2025-11-19)

### Features
- Initial release of Cluster Code
- AI-powered CLI tool for Kubernetes and OpenShift cluster management
- Interactive chat mode
- Cluster diagnostics

## 1.3.0 - Phase 4+ Implementation: Complete Cluster Lifecycle Management (2025-10-31)

### Major Features

#### 🆕 Complete AWS Cluster Lifecycle
- **aws-cluster-delete**: Safe EKS/ROSA cluster deletion with multi-layer safety
  - Production detection with tag validation
  - Automatic pre-deletion backups
  - PV data loss warnings and LoadBalancer cleanup alerts
  - Dual confirmation (name + yes/no) with grace period
  - Complete VPC and networking resource cleanup
  - ~550 lines with comprehensive safety checks
- **aws-cluster-upgrade**: EKS/ROSA version upgrades with zero-downtime
  - Version validation and upgrade path checking
  - Automatic backup before upgrade
  - Staged upgrade (control plane → add-ons → node groups)
  - Health monitoring throughout upgrade process
  - Rollback procedures and troubleshooting guidance
  - ~480 lines with detailed workflow phases

#### 🆕 Complete GCP Cluster Lifecycle
- **gcp-cluster-create**: Full GKE cluster provisioning (Standard & Autopilot)
  - Regional and zonal cluster support
  - VPC-native networking with custom IP ranges
  - Workload Identity integration
  - Security policies and Pod Security Standards
  - Auto-scaling and node pool management
  - ~800 lines with comprehensive production setup
- **gcp-cluster-delete**: Safe GKE cluster deletion with verification
  - Production label detection
  - Resource analysis and conflict checking
  - Automatic backup with restore instructions
  - Orphaned disk cleanup detection
  - Network resource cleanup option
  - ~600 lines with safety-first approach
- **gcp-cluster-upgrade**: GKE version upgrades with release channel support
  - Automatic version selection from release channels
  - Kubernetes version compatibility validation
  - Control plane and node pool upgrades
  - Autopilot automatic node upgrade monitoring
  - ~550 lines with comprehensive verification

#### 🆕 Enhanced Node Management
- **node-cordon**: Mark nodes as unschedulable for maintenance
  - Single node or pattern-based selection (wildcards)
  - Label selector support for bulk operations
  - Node status and resource analysis
  - Cluster capacity impact assessment
  - ~220 lines with multi-node support
- **node-uncordon**: Return nodes to service after maintenance
  - Health verification before uncordoning
  - Pod scheduling impact analysis
  - Cluster capacity restoration tracking
  - Post-uncordon monitoring guidance
  - ~250 lines with health checks

#### 🆕 Backup and Restore with Velero
- **backup-cluster**: Comprehensive cluster backups using Velero
  - Full cluster or selective namespace backups
  - Persistent volume snapshot integration
  - Label selector and resource filtering
  - Configurable retention policies (TTL)
  - Multi-cloud storage backend support (S3, GCS, Azure Blob)
  - Scheduled backup setup guidance
  - ~450 lines with Velero integration
- **restore-cluster**: Cluster restoration from Velero backups
  - Full or selective namespace restore
  - Namespace remapping for migration scenarios
  - Resource conflict detection and handling
  - Volume restoration with storage class compatibility
  - Post-restore health verification
  - ~420 lines with comprehensive workflow

#### 🆕 Multi-Cluster Context Management
- **multi-cluster-context**: Enhanced kubectl context management
  - List all contexts with cluster details and versions
  - Quick context switching with connection testing
  - Current context information display
  - Context renaming for better organization
  - Safe context deletion with confirmations
  - ~280 lines with rich cluster information

#### 🆕 GitOps - Flux Integration
- **flux-reconcile**: Flux Kustomization and HelmRelease reconciliation
  - Git source synchronization
  - Resource reconciliation with health monitoring
  - Dry-run support for preview
  - Error detection and recovery
  - ~400 lines (from previous Phase 4 work)

### New Commands (13)
- **AWS Lifecycle**: aws-cluster-delete, aws-cluster-upgrade
- **GCP Lifecycle**: gcp-cluster-create, gcp-cluster-delete, gcp-cluster-upgrade
- **Azure Lifecycle**: azure-cluster-delete, azure-cluster-upgrade (from previous Phase 4 work)
- **Node Management**: node-cordon, node-uncordon, node-drain (from previous Phase 4 work)
- **Backup/Restore**: backup-cluster, restore-cluster
- **Multi-Cluster**: multi-cluster-context
- **GitOps**: flux-reconcile (from previous Phase 4 work)

### Enhancements
- **Multi-Cloud Parity**: All three cloud providers (AWS, Azure, GCP) now have complete lifecycle operations
  - Cluster creation ✅
  - Cluster deletion ✅
  - Cluster upgrades ✅
- **Safety-First Design**: Multi-layer safety checks across all destructive operations
  - Production detection (tags/labels)
  - Automatic backups before changes
  - Multiple confirmation prompts
  - Grace periods for cancellation
  - Comprehensive cleanup procedures
- **Disaster Recovery**: Full backup/restore capabilities with Velero
  - Cloud-native volume snapshots
  - Multi-cloud storage backends
  - Scheduled backups
  - Selective restoration
- **Node Lifecycle**: Complete node maintenance workflow
  - Cordon → Drain → Maintain → Uncordon
  - Health verification at each step
  - Multi-node operations support
- **Multi-Cluster Operations**: Enhanced context switching and management
  - Rich cluster information display
  - Connection verification
  - Organized naming conventions

### Documentation
- All new commands include comprehensive documentation (6,300+ lines)
- Workflow phases with detailed bash scripts
- Safety best practices and common issues
- Real-world examples for each cloud provider
- Rollback and recovery procedures
- Integration with existing cluster-code commands

### Progress Metrics
- **Phase 1**: 100% Complete ✅
- **Phase 2**: 100% Complete ✅
- **Phase 3**: 100% Complete ✅
- **Phase 4+**: 100% Complete ✅
- **Cloud Coverage**: 100% (Azure ✅, AWS ✅, GCP ✅)
  - Cluster Creation: 3/3 ✅
  - Cluster Deletion: 3/3 ✅
  - Cluster Upgrades: 3/3 ✅
- **GitOps Integration**: 100% (Helm ✅, Kustomize ✅, ArgoCD ✅, Flux ✅)
- **Node Management**: 100% (Drain ✅, Cordon ✅, Uncordon ✅)
- **Backup/Restore**: 100% (Velero ✅, Multi-cloud storage ✅)

### Key Features Summary
| Feature | AWS | Azure | GCP |
|---------|-----|-------|-----|
| Cluster Create | ✅ EKS/ROSA | ✅ AKS/ARO | ✅ GKE/Autopilot |
| Cluster Delete | ✅ | ✅ | ✅ |
| Cluster Upgrade | ✅ | ✅ | ✅ |
| Node Management | ✅ | ✅ | ✅ |
| Backup/Restore | ✅ Velero with S3 | ✅ Velero with Azure Blob | ✅ Velero with GCS |
| GitOps | ✅ ArgoCD/Flux | ✅ ArgoCD/Flux | ✅ ArgoCD/Flux |

### Dependencies Added
- Velero CLI >= 1.12.0 (for backup/restore operations)
- eksctl >= 0.165.0 (for EKS operations)
- rosa CLI (for ROSA operations)
- gcloud >= 450.0.0 (for GKE operations)

### Breaking Changes
None - All additions are backward compatible

### Migration Guide
1. Update to latest version
2. Install new dependencies (velero, eksctl, rosa, gcloud)
3. Configure Velero for backup/restore (optional)
4. Start using new lifecycle commands
5. Review safety features and confirmation workflows

### Next Steps
- Advanced monitoring integration (Prometheus, Grafana)
- Security enhancements (Pod Security Standards, Network Policies)
- Cost optimization features
- Multi-cluster federation
- Advanced troubleshooting agents

---

## 1.2.0 - Phase 3 Implementation (2025-10-31)

### Major Features

#### 🆕 AWS Cloud Provider Integration (cloud-aws plugin)
- **EKS Cluster Management**: Full lifecycle support for Amazon Elastic Kubernetes Service
  - `aws-cluster-create`: Create production-ready EKS clusters
  - `aws-cluster-list`, `aws-cluster-connect`: List and connect to clusters
- **ROSA Support**: Red Hat OpenShift Service on AWS
  - Hosted Control Plane (HyperShift)
  - Classic ROSA deployment
  - STS authentication mode
- **AWS MCP Server**: 10 standardized cloud operations
- **Production Templates**: EKS and ROSA configurations

#### 🆕 GCP Cloud Provider Integration (cloud-gcp plugin)
- **GKE Cluster Management**: Google Kubernetes Engine support
  - Standard and Autopilot modes
  - Regional and zonal clusters
  - Node pool management
- **GCP MCP Server**: Google Cloud operations

#### 🆕 Enhanced GitOps Workflows
- **ArgoCD Integration** (`argocd-sync`): Application synchronization
  - Git-to-cluster sync with diff analysis
  - Resource pruning and rollback
  - Health monitoring

### GitHub Pages Documentation Site
- 📚 **Complete Documentation Website**: Jekyll-based site ready for GitHub Pages
  - Home page with feature showcase (700+ lines)
  - Getting Started guide (400+ lines)
  - API reference for all commands (500+ lines)
  - First Cluster tutorial (600+ lines)
  - Site configuration with full navigation

### New Plugins (2)
1. **cloud-aws**: AWS cloud provider (EKS/ROSA)
2. **cloud-gcp**: GCP cloud provider (GKE)

### New Commands (10+)
- **AWS**: aws-cluster-create, aws-cluster-list, aws-cluster-connect
- **GCP**: gcp-cluster-create, gcp-cluster-list, gcp-cluster-connect
- **GitOps**: argocd-sync

### Enhancements
- Multi-cloud coverage now 100% (Azure, AWS, GCP)
- MCP servers for all three cloud providers
- Unified cloud management experience
- Comprehensive documentation ready for GitHub Pages

### Progress Metrics
- **Phase 1**: 100% Complete
- **Phase 2**: 100% Complete
- **Phase 3**: 95% Complete
- **Cloud Coverage**: 100% (Azure ✅, AWS ✅, GCP ✅)
- **GitOps Integration**: 80% (Helm ✅, Kustomize ✅, ArgoCD ✅)

---

## 1.1.0 - Phase 2+ Implementation (2025-10-30)

### Major Features

#### 🆕 Azure Cloud Provider Integration (cloud-azure plugin)
- **AKS Cluster Management**: Full lifecycle support for Azure Kubernetes Service
  - `azure-cluster-create`: Create production-ready AKS clusters with best practices
  - `azure-cluster-list`: List and filter AKS/ARO clusters across subscriptions
  - `azure-cluster-connect`: Connect to clusters and configure kubectl context
- **ARO Support**: Azure Red Hat OpenShift cluster provisioning and management
  - Complete VNet, subnet, and network configuration
  - Red Hat pull secret integration
  - Custom domain and certificate support
- **Azure MCP Server**: Standardized cloud API integration with 10 tools
  - Cluster provisioning, scaling, upgrading
  - Credential management
  - Version discovery
- **Infrastructure as Code**: Terraform template generation
- **Production Templates**: Ready-to-use AKS and ARO cluster configurations

#### 🆕 OpenShift Features (cluster-openshift plugin)
- **Routes Analysis** (`routes-analyze`): Comprehensive OpenShift Routes troubleshooting
  - Backend service validation and endpoint checking
  - TLS/SSL configuration analysis (edge, passthrough, re-encrypt)
  - Certificate expiration monitoring and validation
  - Routing rule conflict detection
  - External connectivity testing
  - K8sGPT-style intelligent recommendations
- **Operator Management** (`operator-install`): OpenShift Operator Lifecycle Management
  - OperatorHub search and discovery
  - Automatic OperatorGroup and Subscription creation
  - InstallPlan approval workflow (manual/automatic)
  - CSV monitoring and verification
  - Post-installation guidance for 20+ operators
  - Support for cluster-wide and namespace-scoped operators

#### 🆕 GitOps Workflows (gitops plugin)
- **Helm Deployment** (`helm-deploy`): Intelligent Helm chart deployment
  - Chart resolution (local, repository, search)
  - Values file merging and validation
  - Pre-deployment template validation
  - Resource health monitoring
  - Post-deployment verification
  - Automatic rollback on failure
- **Kustomize Support** (`kustomize-apply`): Overlay-based configuration management
  - Kustomization analysis (resources, patches, generators)
  - Server-side diff generation
  - Change categorization (new, modified, deleted)
  - Intelligent resource pruning
  - Post-deployment health checks
  - GitOps best practices recommendations

### New Plugins (3)
1. **cloud-azure**: Azure cloud provider integration
2. **cluster-openshift**: OpenShift-specific features
3. **gitops**: GitOps workflows and deployment automation

### New Commands (21)
- **Azure**: azure-cluster-create, azure-cluster-list, azure-cluster-connect (+ 4 planned)
- **OpenShift**: routes-analyze, operator-install (+ 5 planned)
- **GitOps**: helm-deploy, kustomize-apply (+ 5 planned)

### New Templates
- **AKS Production Cluster**: Comprehensive template with HA, monitoring, security
- **ARO Production Cluster**: Enterprise OpenShift template with operators, RBAC, backup

### Enhancements
- Extended cluster configuration schema for cloud providers
- MCP server framework for standardized cloud API integration
- Production-ready cluster templates with environment variable substitution
- Comprehensive documentation for all new commands (10,300+ lines)
- Best practices baked into all provisioning workflows

### Documentation
- **IMPROVEMENTS.md**: Comprehensive Phase 2+ implementation guide
- All commands include detailed workflows, examples, and error handling
- Production template documentation with usage instructions
- Official documentation references (Azure, OpenShift, Helm, Kustomize)

### Dependencies Added
- Azure CLI (`az`) >= 2.50.0 (for Azure operations)
- OpenShift CLI (`oc`) >= 4.15.0 (for OpenShift features)
- Helm >= 3.12.0 (for Helm deployments)
- Kustomize >= 5.0.0 (optional, for Kustomize overlays)

### Progress Metrics
- **Phase 1**: 100% Complete (Core diagnostics, K8sGPT)
- **Phase 2**: 85% Complete (Azure, OpenShift, GitOps)
- **Cloud Coverage**: 33% (Azure complete, AWS/GCP planned)
- **OpenShift Support**: 60% (Routes + Operators, BuildConfigs planned)
- **GitOps Integration**: 60% (Helm + Kustomize, ArgoCD/Flux planned)

### Breaking Changes
None - All additions are backward compatible

### Migration Guide
1. Update to latest version
2. Enable new plugins in cluster-config.local.json
3. Install dependencies (az CLI, oc CLI, helm)
4. Configure cloud provider credentials
5. Start using new commands

### Next Steps (Phase 3)
- AWS EKS/ROSA integration
- GCP GKE integration
- ArgoCD/Flux automation
- Multi-cluster management
- Advanced security features

---

## 2.0.27

- New UI for permission prompts
- Added current branch filtering and search to session resume screen for easier navigation
- Fixed directory @-mention causing "No assistant message found" error
- VSCode Extension: Add config setting to include .gitignored files in file searches
- VSCode Extension: Bug fixes for unrelated 'Warmup' conversations, and configuration/settings occasionally being reset to defaults

## 2.0.25

- Removed legacy SDK entrypoint. Please migrate to @anthropic-ai/claude-agent-sdk for future SDK updates: https://docs.claude.com/en/docs/claude-code/sdk/migration-guide

## 2.0.24

- Fixed a bug where project-level skills were not loading when --setting-sources 'project' was specified
- Claude Code Web: Support for Web -> CLI teleport
- Sandbox: Releasing a sandbox mode for the BashTool on Linux & Mac

## 2.0.22

- Fixed content layout shift when scrolling through slash commands
- IDE: Add toggle to enable/disable thinking.
- Fix bug causing duplicate permission prompts with parallel tool calls
- Add support for enterprise managed MCP allowlist and denylist

## 2.0.21

- Support MCP `structuredContent` field in tool responses
- Added an interactive question tool
- Claude will now ask you questions more often in plan mode
- Added Haiku 4.5 as a model option for Pro users
- Fixed an issue where queued commands don't have access to previous messages' output

## 2.0.20

- Added support for Claude Skills

## 2.0.19

- Auto-background long-running bash commands instead of killing them. Customize with BASH_DEFAULT_TIMEOUT_MS
- Fixed a bug where Haiku was unnecessarily called in print mode

## 2.0.17

- Added Haiku 4.5 to model selector!
- Haiku 4.5 automatically uses Sonnet in plan mode, and Haiku for execution (i.e. SonnetPlan by default)
- 3P (Bedrock and Vertex) are not automatically upgraded yet. Manual upgrading can be done through setting `ANTHROPIC_DEFAULT_HAIKU_MODEL`
- Introducing the Explore subagent. Powered by Haiku it'll search through your codebase efficiently to save context!
- OTEL: support HTTP_PROXY and HTTPS_PROXY
- `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC` now disables release notes fetching

## 2.0.15

- Fixed bug with resuming where previously created files needed to be read again before writing
- Fixed bug with `-p` mode where @-mentioned files needed to be read again before writing

## 2.0.14

- Fix @-mentioning MCP servers to toggle them on/off
- Improve permission checks for bash with inline env vars
- Fix ultrathink + thinking toggle
- Reduce unnecessary logins
- Document --system-prompt
- Several improvements to rendering
- Plugins UI polish

## 2.0.13

- Fixed `/plugin` not working on native build

## 2.0.12

- **Plugin System Released**: Extend Claude Code with custom commands, agents, hooks, and MCP servers from marketplaces
- `/plugin install`, `/plugin enable/disable`, `/plugin marketplace` commands for plugin management
- Repository-level plugin configuration via `extraKnownMarketplaces` for team collaboration
- `/plugin validate` command for validating plugin structure and configuration
- Plugin announcement blog post at https://www.anthropic.com/news/claude-code-plugins
- Plugin documentation available at https://docs.claude.com/en/docs/claude-code/plugins
- Comprehensive error messages and diagnostics via `/doctor` command
- Avoid flickering in `/model` selector
- Improvements to `/help`
- Avoid mentioning hooks in `/resume` summaries
- Changes to the "verbose" setting in `/config` now persist across sessions

## 2.0.11

- Reduced system prompt size by 1.4k tokens
- IDE: Fixed keyboard shortcuts and focus issues for smoother interaction
- Fixed Opus fallback rate limit errors appearing incorrectly
- Fixed /add-dir command selecting wrong default tab

## 2.0.10

- Rewrote terminal renderer for buttery smooth UI
- Enable/disable MCP servers by @mentioning, or in /mcp
- Added tab completion for shell commands in bash mode
- PreToolUse hooks can now modify tool inputs
- Press Ctrl-G to edit your prompt in your system's configured text editor
- Fixes for bash permission checks with environment variables in the command

## 2.0.9

- Fix regression where bash backgrounding stopped working

## 2.0.8

- Update Bedrock default Sonnet model to `global.anthropic.claude-sonnet-4-5-20250929-v1:0`
- IDE: Add drag-and-drop support for files and folders in chat
- /context: Fix counting for thinking blocks
- Improve message rendering for users with light themes on dark terminals
- Remove deprecated .claude.json allowedTools, ignorePatterns, env, and todoFeatureEnabled config options (instead, configure these in your settings.json)

## 2.0.5

- IDE: Fix IME unintended message submission with Enter and Tab
- IDE: Add "Open in Terminal" link in login screen
- Fix unhandled OAuth expiration 401 API errors
- SDK: Added SDKUserMessageReplay.isReplay to prevent duplicate messages

## 2.0.1

- Skip Sonnet 4.5 default model setting change for Bedrock and Vertex
- Various bug fixes and presentation improvements

## 2.0.0

- New native VS Code extension
- Fresh coat of paint throughout the whole app
- /rewind a conversation to undo code changes
- /usage command to see plan limits
- Tab to toggle thinking (sticky across sessions)
- Ctrl-R to search history
- Unshipped claude config command
- Hooks: Reduced PostToolUse 'tool_use' ids were found without 'tool_result' blocks errors
- SDK: The Claude Code SDK is now the Claude Agent SDK
- Add subagents dynamically with `--agents` flag

## 1.0.126

- Enable /context command for Bedrock and Vertex
- Add mTLS support for HTTP-based OpenTelemetry exporters

## 1.0.124

- Set `CLAUDE_BASH_NO_LOGIN` environment variable to 1 or true to to skip login shell for BashTool
- Fix Bedrock and Vertex environment variables evaluating all strings as truthy
- No longer inform Claude of the list of allowed tools when permission is denied
- Fixed security vulnerability in Bash tool permission checks
- Improved VSCode extension performance for large files

## 1.0.123

- Bash permission rules now support output redirections when matching (e.g., `Bash(python:*)` matches `python script.py > output.txt`)
- Fixed thinking mode triggering on negation phrases like "don't think"
- Fixed rendering performance degradation during token streaming
- Added SlashCommand tool, which enables Claude to invoke your slash commands. https://docs.claude.com/en/docs/claude-code/slash-commands#SlashCommand-tool
- Enhanced BashTool environment snapshot logging
- Fixed a bug where resuming a conversation in headless mode would sometimes enable thinking unnecessarily
- Migrated --debug logging to a file, to enable easy tailing & filtering

## 1.0.120

- Fix input lag during typing, especially noticeable with large prompts
- Improved VSCode extension command registry and sessions dialog user experience
- Enhanced sessions dialog responsiveness and visual feedback
- Fixed IDE compatibility issue by removing worktree support check
- Fixed security vulnerability where Bash tool permission checks could be bypassed using prefix matching

## 1.0.119

- Fix Windows issue where process visually freezes on entering interactive mode
- Support dynamic headers for MCP servers via headersHelper configuration
- Fix thinking mode not working in headless sessions
- Fix slash commands now properly update allowed tools instead of replacing them

## 1.0.117

- Add Ctrl-R history search to recall previous commands like bash/zsh
- Fix input lag while typing, especially on Windows
- Add sed command to auto-allowed commands in acceptEdits mode
- Fix Windows PATH comparison to be case-insensitive for drive letters
- Add permissions management hint to /add-dir output

## 1.0.115

- Improve thinking mode display with enhanced visual effects
- Type /t to temporarily disable thinking mode in your prompt
- Improve path validation for glob and grep tools
- Show condensed output for post-tool hooks to reduce visual clutter
- Fix visual feedback when loading state completes
- Improve UI consistency for permission request dialogs

## 1.0.113

- Deprecated piped input in interactive mode
- Move Ctrl+R keybinding for toggling transcript to Ctrl+O

## 1.0.112

- Transcript mode (Ctrl+R): Added the model used to generate each assistant message
- Addressed issue where some Claude Max users were incorrectly recognized as Claude Pro users
- Hooks: Added systemMessage support for SessionEnd hooks
- Added `spinnerTipsEnabled` setting to disable spinner tips
- IDE: Various improvements and bug fixes

## 1.0.111

- /model now validates provided model names
- Fixed Bash tool crashes caused by malformed shell syntax parsing

## 1.0.110

- /terminal-setup command now supports WezTerm
- MCP: OAuth tokens now proactively refresh before expiration
- Fixed reliability issues with background Bash processes

## 1.0.109

- SDK: Added partial message streaming support via `--include-partial-messages` CLI flag

## 1.0.106

- Windows: Fixed path permission matching to consistently use POSIX format (e.g., `Read(//c/Users/...)`)

## 1.0.97

- Settings: /doctor now validates permission rule syntax and suggests corrections

## 1.0.94

- Vertex: add support for global endpoints for supported models
- /memory command now allows direct editing of all imported memory files
- SDK: Add custom tools as callbacks
- Added /todos command to list current todo items

## 1.0.93

- Windows: Add alt + v shortcut for pasting images from clipboard
- Support NO_PROXY environment variable to bypass proxy for specified hostnames and IPs

## 1.0.90

- Settings file changes take effect immediately - no restart required

## 1.0.88

- Fixed issue causing "OAuth authentication is currently not supported"
- Status line input now includes `exceeds_200k_tokens`
- Fixed incorrect usage tracking in /cost.
- Introduced `ANTHROPIC_DEFAULT_SONNET_MODEL` and `ANTHROPIC_DEFAULT_OPUS_MODEL` for controlling model aliases opusplan, opus, and sonnet.
- Bedrock: Updated default Sonnet model to Sonnet 4

## 1.0.86

- Added /context to help users self-serve debug context issues
- SDK: Added UUID support for all SDK messages
- SDK: Added `--replay-user-messages` to replay user messages back to stdout

## 1.0.85

- Status line input now includes session cost info
- Hooks: Introduced SessionEnd hook

## 1.0.84

- Fix tool_use/tool_result id mismatch error when network is unstable
- Fix Claude sometimes ignoring real-time steering when wrapping up a task
- @-mention: Add ~/.claude/\* files to suggestions for easier agent, output style, and slash command editing
- Use built-in ripgrep by default; to opt out of this behavior, set USE_BUILTIN_RIPGREP=0

## 1.0.83

- @-mention: Support files with spaces in path
- New shimmering spinner

## 1.0.82

- SDK: Add request cancellation support
- SDK: New additionalDirectories option to search custom paths, improved slash command processing
- Settings: Validation prevents invalid fields in .claude/settings.json files
- MCP: Improve tool name consistency
- Bash: Fix crash when Claude tries to automatically read large files

## 1.0.81

- Released output styles, including new built-in educational output styles "Explanatory" and "Learning". Docs: https://docs.claude.com/en/docs/claude-code/output-styles
- Agents: Fix custom agent loading when agent files are unparsable

## 1.0.80

- UI improvements: Fix text contrast for custom subagent colors and spinner rendering issues

## 1.0.77

- Bash tool: Fix heredoc and multiline string escaping, improve stderr redirection handling
- SDK: Add session support and permission denial tracking
- Fix token limit errors in conversation summarization
- Opus Plan Mode: New setting in `/model` to run Opus only in plan mode, Sonnet otherwise

## 1.0.73

- MCP: Support multiple config files with `--mcp-config file1.json file2.json`
- MCP: Press Esc to cancel OAuth authentication flows
- Bash: Improved command validation and reduced false security warnings
- UI: Enhanced spinner animations and status line visual hierarchy
- Linux: Added support for Alpine and musl-based distributions (requires separate ripgrep installation)

## 1.0.72

- Ask permissions: have Claude Code always ask for confirmation to use specific tools with /permissions

## 1.0.71

- Background commands: (Ctrl-b) to run any Bash command in the background so Claude can keep working (great for dev servers, tailing logs, etc.)
- Customizable status line: add your terminal prompt to Claude Code with /statusline

## 1.0.70

- Performance: Optimized message rendering for better performance with large contexts
- Windows: Fixed native file search, ripgrep, and subagent functionality
- Added support for @-mentions in slash command arguments

## 1.0.69

- Upgraded Opus to version 4.1

## 1.0.68

- Fix incorrect model names being used for certain commands like `/pr-comments`
- Windows: improve permissions checks for allow / deny tools and project trust. This may create a new project entry in `.claude.json` - manually merge the history field if desired.
- Windows: improve sub-process spawning to eliminate "No such file or directory" when running commands like pnpm
- Enhanced /doctor command with CLAUDE.md and MCP tool context for self-serve debugging
- SDK: Added canUseTool callback support for tool confirmation
- Added `disableAllHooks` setting
- Improved file suggestions performance in large repos

## 1.0.65

- IDE: Fixed connection stability issues and error handling for diagnostics
- Windows: Fixed shell environment setup for users without .bashrc files

## 1.0.64

- Agents: Added model customization support - you can now specify which model an agent should use
- Agents: Fixed unintended access to the recursive agent tool
- Hooks: Added systemMessage field to hook JSON output for displaying warnings and context
- SDK: Fixed user input tracking across multi-turn conversations
- Added hidden files to file search and @-mention suggestions

## 1.0.63

- Windows: Fixed file search, @agent mentions, and custom slash commands functionality

## 1.0.62

- Added @-mention support with typeahead for custom agents. @<your-custom-agent> to invoke it
- Hooks: Added SessionStart hook for new session initialization
- /add-dir command now supports typeahead for directory paths
- Improved network connectivity check reliability

## 1.0.61

- Transcript mode (Ctrl+R): Changed Esc to exit transcript mode rather than interrupt
- Settings: Added `--settings` flag to load settings from a JSON file
- Settings: Fixed resolution of settings files paths that are symlinks
- OTEL: Fixed reporting of wrong organization after authentication changes
- Slash commands: Fixed permissions checking for allowed-tools with Bash
- IDE: Added support for pasting images in VSCode MacOS using ⌘+V
- IDE: Added `CLAUDE_CODE_AUTO_CONNECT_IDE=false` for disabling IDE auto-connection
- Added `CLAUDE_CODE_SHELL_PREFIX` for wrapping Claude and user-provided shell commands run by Claude Code

## 1.0.60

- You can now create custom subagents for specialized tasks! Run /agents to get started

## 1.0.59

- SDK: Added tool confirmation support with canUseTool callback
- SDK: Allow specifying env for spawned process
- Hooks: Exposed PermissionDecision to hooks (including "ask")
- Hooks: UserPromptSubmit now supports additionalContext in advanced JSON output
- Fixed issue where some Max users that specified Opus would still see fallback to Sonnet

## 1.0.58

- Added support for reading PDFs
- MCP: Improved server health status display in 'claude mcp list'
- Hooks: Added CLAUDE_PROJECT_DIR env var for hook commands

## 1.0.57

- Added support for specifying a model in slash commands
- Improved permission messages to help Claude understand allowed tools
- Fix: Remove trailing newlines from bash output in terminal wrapping

## 1.0.56

- Windows: Enabled shift+tab for mode switching on versions of Node.js that support terminal VT mode
- Fixes for WSL IDE detection
- Fix an issue causing awsRefreshHelper changes to .aws directory not to be picked up

## 1.0.55

- Clarified knowledge cutoff for Opus 4 and Sonnet 4 models
- Windows: fixed Ctrl+Z crash
- SDK: Added ability to capture error logging
- Add --system-prompt-file option to override system prompt in print mode

## 1.0.54

- Hooks: Added UserPromptSubmit hook and the current working directory to hook inputs
- Custom slash commands: Added argument-hint to frontmatter
- Windows: OAuth uses port 45454 and properly constructs browser URL
- Windows: mode switching now uses alt + m, and plan mode renders properly
- Shell: Switch to in-memory shell snapshot to fix file-related errors

## 1.0.53

- Updated @-mention file truncation from 100 lines to 2000 lines
- Add helper script settings for AWS token refresh: awsAuthRefresh (for foreground operations like aws sso login) and awsCredentialExport (for background operation with STS-like response).

## 1.0.52

- Added support for MCP server instructions

## 1.0.51

- Added support for native Windows (requires Git for Windows)
- Added support for Bedrock API keys through environment variable AWS_BEARER_TOKEN_BEDROCK
- Settings: /doctor can now help you identify and fix invalid setting files
- `--append-system-prompt` can now be used in interactive mode, not just --print/-p.
- Increased auto-compact warning threshold from 60% to 80%
- Fixed an issue with handling user directories with spaces for shell snapshots
- OTEL resource now includes os.type, os.version, host.arch, and wsl.version (if running on Windows Subsystem for Linux)
- Custom slash commands: Fixed user-level commands in subdirectories
- Plan mode: Fixed issue where rejected plan from sub-task would get discarded

## 1.0.48

- Fixed a bug in v1.0.45 where the app would sometimes freeze on launch
- Added progress messages to Bash tool based on the last 5 lines of command output
- Added expanding variables support for MCP server configuration
- Moved shell snapshots from /tmp to ~/.claude for more reliable Bash tool calls
- Improved IDE extension path handling when Claude Code runs in WSL
- Hooks: Added a PreCompact hook
- Vim mode: Added c, f/F, t/T

## 1.0.45

- Redesigned Search (Grep) tool with new tool input parameters and features
- Disabled IDE diffs for notebook files, fixing "Timeout waiting after 1000ms" error
- Fixed config file corruption issue by enforcing atomic writes
- Updated prompt input undo to Ctrl+\_ to avoid breaking existing Ctrl+U behavior, matching zsh's undo shortcut
- Stop Hooks: Fixed transcript path after /clear and fixed triggering when loop ends with tool call
- Custom slash commands: Restored namespacing in command names based on subdirectories. For example, .claude/commands/frontend/component.md is now /frontend:component, not /component.

## 1.0.44

- New /export command lets you quickly export a conversation for sharing
- MCP: resource_link tool results are now supported
- MCP: tool annotations and tool titles now display in /mcp view
- Changed Ctrl+Z to suspend Claude Code. Resume by running `fg`. Prompt input undo is now Ctrl+U.

## 1.0.43

- Fixed a bug where the theme selector was saving excessively
- Hooks: Added EPIPE system error handling

## 1.0.42

- Added tilde (`~`) expansion support to `/add-dir` command

## 1.0.41

- Hooks: Split Stop hook triggering into Stop and SubagentStop
- Hooks: Enabled optional timeout configuration for each command
- Hooks: Added "hook_event_name" to hook input
- Fixed a bug where MCP tools would display twice in tool list
- New tool parameters JSON for Bash tool in `tool_decision` event

## 1.0.40

- Fixed a bug causing API connection errors with UNABLE_TO_GET_ISSUER_CERT_LOCALLY if `NODE_EXTRA_CA_CERTS` was set

## 1.0.39

- New Active Time metric in OpenTelemetry logging

## 1.0.38

- Released hooks. Special thanks to community input in https://github.com/anthropics/claude-code/issues/712. Docs: https://docs.claude.com/en/docs/claude-code/hooks

## 1.0.37

- Remove ability to set `Proxy-Authorization` header via ANTHROPIC_AUTH_TOKEN or apiKeyHelper

## 1.0.36

- Web search now takes today's date into context
- Fixed a bug where stdio MCP servers were not terminating properly on exit

## 1.0.35

- Added support for MCP OAuth Authorization Server discovery

## 1.0.34

- Fixed a memory leak causing a MaxListenersExceededWarning message to appear

## 1.0.33

- Improved logging functionality with session ID support
- Added prompt input undo functionality (Ctrl+Z and vim 'u' command)
- Improvements to plan mode

## 1.0.32

- Updated loopback config for litellm
- Added forceLoginMethod setting to bypass login selection screen

## 1.0.31

- Fixed a bug where ~/.claude.json would get reset when file contained invalid JSON

## 1.0.30

- Custom slash commands: Run bash output, @-mention files, enable thinking with thinking keywords
- Improved file path autocomplete with filename matching
- Added timestamps in Ctrl-r mode and fixed Ctrl-c handling
- Enhanced jq regex support for complex filters with pipes and select

## 1.0.29

- Improved CJK character support in cursor navigation and rendering

## 1.0.28

- Slash commands: Fix selector display during history navigation
- Resizes images before upload to prevent API size limit errors
- Added XDG_CONFIG_HOME support to configuration directory
- Performance optimizations for memory usage
- New attributes (terminal.type, language) in OpenTelemetry logging

## 1.0.27

- Streamable HTTP MCP servers are now supported
- Remote MCP servers (SSE and HTTP) now support OAuth
- MCP resources can now be @-mentioned
- /resume slash command to switch conversations within Claude Code

## 1.0.25

- Slash commands: moved "project" and "user" prefixes to descriptions
- Slash commands: improved reliability for command discovery
- Improved support for Ghostty
- Improved web search reliability

## 1.0.24

- Improved /mcp output
- Fixed a bug where settings arrays got overwritten instead of merged

## 1.0.23

- Released TypeScript SDK: import @anthropic-ai/claude-code to get started
- Released Python SDK: pip install claude-code-sdk to get started

## 1.0.22

- SDK: Renamed `total_cost` to `total_cost_usd`

## 1.0.21

- Improved editing of files with tab-based indentation
- Fix for tool_use without matching tool_result errors
- Fixed a bug where stdio MCP server processes would linger after quitting Claude Code

## 1.0.18

- Added --add-dir CLI argument for specifying additional working directories
- Added streaming input support without require -p flag
- Improved startup performance and session storage performance
- Added CLAUDE_BASH_MAINTAIN_PROJECT_WORKING_DIR environment variable to freeze working directory for bash commands
- Added detailed MCP server tools display (/mcp)
- MCP authentication and permission improvements
- Added auto-reconnection for MCP SSE connections on disconnect
- Fixed issue where pasted content was lost when dialogs appeared

## 1.0.17

- We now emit messages from sub-tasks in -p mode (look for the parent_tool_use_id property)
- Fixed crashes when the VS Code diff tool is invoked multiple times quickly
- MCP server list UI improvements
- Update Claude Code process title to display "claude" instead of "node"

## 1.0.11

- Claude Code can now also be used with a Claude Pro subscription
- Added /upgrade for smoother switching to Claude Max plans
- Improved UI for authentication from API keys and Bedrock/Vertex/external auth tokens
- Improved shell configuration error handling
- Improved todo list handling during compaction

## 1.0.10

- Added markdown table support
- Improved streaming performance

## 1.0.8

- Fixed Vertex AI region fallback when using CLOUD_ML_REGION
- Increased default otel interval from 1s -> 5s
- Fixed edge cases where MCP_TIMEOUT and MCP_TOOL_TIMEOUT weren't being respected
- Fixed a regression where search tools unnecessarily asked for permissions
- Added support for triggering thinking non-English languages
- Improved compacting UI

## 1.0.7

- Renamed /allowed-tools -> /permissions
- Migrated allowedTools and ignorePatterns from .claude.json -> settings.json
- Deprecated claude config commands in favor of editing settings.json
- Fixed a bug where --dangerously-skip-permissions sometimes didn't work in --print mode
- Improved error handling for /install-github-app
- Bugfixes, UI polish, and tool reliability improvements

## 1.0.6

- Improved edit reliability for tab-indented files
- Respect CLAUDE_CONFIG_DIR everywhere
- Reduced unnecessary tool permission prompts
- Added support for symlinks in @file typeahead
- Bugfixes, UI polish, and tool reliability improvements

## 1.0.4

- Fixed a bug where MCP tool errors weren't being parsed correctly

## 1.0.1

- Added `DISABLE_INTERLEAVED_THINKING` to give users the option to opt out of interleaved thinking.
- Improved model references to show provider-specific names (Sonnet 3.7 for Bedrock, Sonnet 4 for Console)
- Updated documentation links and OAuth process descriptions

## 1.0.0

- Claude Code is now generally available
- Introducing Sonnet 4 and Opus 4 models

## 0.2.125

- Breaking change: Bedrock ARN passed to `ANTHROPIC_MODEL` or `ANTHROPIC_SMALL_FAST_MODEL` should no longer contain an escaped slash (specify `/` instead of `%2F`)
- Removed `DEBUG=true` in favor of `ANTHROPIC_LOG=debug`, to log all requests

## 0.2.117

- Breaking change: --print JSON output now returns nested message objects, for forwards-compatibility as we introduce new metadata fields
- Introduced settings.cleanupPeriodDays
- Introduced CLAUDE_CODE_API_KEY_HELPER_TTL_MS env var
- Introduced --debug mode

## 0.2.108

- You can now send messages to Claude while it works to steer Claude in real-time
- Introduced BASH_DEFAULT_TIMEOUT_MS and BASH_MAX_TIMEOUT_MS env vars
- Fixed a bug where thinking was not working in -p mode
- Fixed a regression in /cost reporting
- Deprecated MCP wizard interface in favor of other MCP commands
- Lots of other bugfixes and improvements

## 0.2.107

- CLAUDE.md files can now import other files. Add @path/to/file.md to ./CLAUDE.md to load additional files on launch

## 0.2.106

- MCP SSE server configs can now specify custom headers
- Fixed a bug where MCP permission prompt didn't always show correctly

## 0.2.105

- Claude can now search the web
- Moved system & account status to /status
- Added word movement keybindings for Vim
- Improved latency for startup, todo tool, and file edits

## 0.2.102

- Improved thinking triggering reliability
- Improved @mention reliability for images and folders
- You can now paste multiple large chunks into one prompt

## 0.2.100

- Fixed a crash caused by a stack overflow error
- Made db storage optional; missing db support disables --continue and --resume

## 0.2.98

- Fixed an issue where auto-compact was running twice

## 0.2.96

- Claude Code can now also be used with a Claude Max subscription (https://claude.ai/upgrade)

## 0.2.93

- Resume conversations from where you left off from with "claude --continue" and "claude --resume"
- Claude now has access to a Todo list that helps it stay on track and be more organized

## 0.2.82

- Added support for --disallowedTools
- Renamed tools for consistency: LSTool -> LS, View -> Read, etc.

## 0.2.75

- Hit Enter to queue up additional messages while Claude is working
- Drag in or copy/paste image files directly into the prompt
- @-mention files to directly add them to context
- Run one-off MCP servers with `claude --mcp-config <path-to-file>`
- Improved performance for filename auto-complete

## 0.2.74

- Added support for refreshing dynamically generated API keys (via apiKeyHelper), with a 5 minute TTL
- Task tool can now perform writes and run bash commands

## 0.2.72

- Updated spinner to indicate tokens loaded and tool usage

## 0.2.70

- Network commands like curl are now available for Claude to use
- Claude can now run multiple web queries in parallel
- Pressing ESC once immediately interrupts Claude in Auto-accept mode

## 0.2.69

- Fixed UI glitches with improved Select component behavior
- Enhanced terminal output display with better text truncation logic

## 0.2.67

- Shared project permission rules can be saved in .claude/settings.json

## 0.2.66

- Print mode (-p) now supports streaming output via --output-format=stream-json
- Fixed issue where pasting could trigger memory or bash mode unexpectedly

## 0.2.63

- Fixed an issue where MCP tools were loaded twice, which caused tool call errors

## 0.2.61

- Navigate menus with vim-style keys (j/k) or bash/emacs shortcuts (Ctrl+n/p) for faster interaction
- Enhanced image detection for more reliable clipboard paste functionality
- Fixed an issue where ESC key could crash the conversation history selector

## 0.2.59

- Copy+paste images directly into your prompt
- Improved progress indicators for bash and fetch tools
- Bugfixes for non-interactive mode (-p)

## 0.2.54

- Quickly add to Memory by starting your message with '#'
- Press ctrl+r to see full output for long tool results
- Added support for MCP SSE transport

## 0.2.53

- New web fetch tool lets Claude view URLs that you paste in
- Fixed a bug with JPEG detection

## 0.2.50

- New MCP "project" scope now allows you to add MCP servers to .mcp.json files and commit them to your repository

## 0.2.49

- Previous MCP server scopes have been renamed: previous "project" scope is now "local" and "global" scope is now "user"

## 0.2.47

- Press Tab to auto-complete file and folder names
- Press Shift + Tab to toggle auto-accept for file edits
- Automatic conversation compaction for infinite conversation length (toggle with /config)

## 0.2.44

- Ask Claude to make a plan with thinking mode: just say 'think' or 'think harder' or even 'ultrathink'

## 0.2.41

- MCP server startup timeout can now be configured via MCP_TIMEOUT environment variable
- MCP server startup no longer blocks the app from starting up

## 0.2.37

- New /release-notes command lets you view release notes at any time
- `claude config add/remove` commands now accept multiple values separated by commas or spaces

## 0.2.36

- Import MCP servers from Claude Desktop with `claude mcp add-from-claude-desktop`
- Add MCP servers as JSON strings with `claude mcp add-json <n> <json>`

## 0.2.34

- Vim bindings for text input - enable with /vim or /config

## 0.2.32

- Interactive MCP setup wizard: Run "claude mcp add" to add MCP servers with a step-by-step interface
- Fix for some PersistentShell issues

## 0.2.31

- Custom slash commands: Markdown files in .claude/commands/ directories now appear as custom slash commands to insert prompts into your conversation
- MCP debug mode: Run with --mcp-debug flag to get more information about MCP server errors

## 0.2.30

- Added ANSI color theme for better terminal compatibility
- Fixed issue where slash command arguments weren't being sent properly
- (Mac-only) API keys are now stored in macOS Keychain

## 0.2.26

- New /approved-tools command for managing tool permissions
- Word-level diff display for improved code readability
- Fuzzy matching for slash commands

## 0.2.21

- Fuzzy matching for /commands
