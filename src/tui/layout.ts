
import * as blessed from 'blessed';
import * as contrib from 'blessed-contrib';

export interface TuiWidgets {
    screen: blessed.Widgets.Screen;
    grid: any;
    // Header panels
    contextBox: blessed.Widgets.BoxElement;
    shortcutsBox: blessed.Widgets.BoxElement;
    logoBox: blessed.Widgets.BoxElement;
    // Input between header and data
    input: blessed.Widgets.TextboxElement;
    // Main data table
    resourceTable: any;
    // Agent log at bottom
    chatLog: blessed.Widgets.BoxElement;
}

// ASCII art CC logo  
const CC_LOGO = [
    '   _____ _____ ',
    '  / ____/ ____|',
    ' | |   | |     ',
    ' | |   | |     ',
    ' | |___| |____ ',
    '  \\_____\\_____| '
].join('\n');

export function createLayout(screen: blessed.Widgets.Screen): TuiWidgets {
    const grid = new contrib.grid({ rows: 12, cols: 12, screen: screen });

    // ═══════════════════════════════════════════════════════════════════════
    // HEADER SECTION (Rows 0-2) - 3 columns like K9s
    // ═══════════════════════════════════════════════════════════════════════

    // LEFT PANEL: Context/Cluster/User Info (Rows 0-2, Cols 0-4)
    const contextBox = grid.set(0, 0, 2, 4, blessed.box, {
        tags: true,
        style: {
            fg: 'white',
            bg: 'black'
        },
        border: { type: 'line', fg: 'blue' },
        padding: { left: 1 }
    });

    // MIDDLE PANEL: Keyboard Shortcuts (Rows 0-2, Cols 4-8)
    const shortcutsBox = grid.set(0, 4, 2, 4, blessed.box, {
        tags: true,
        style: {
            fg: 'white',
            bg: 'black'
        },
        border: { type: 'line', fg: 'blue' },
        padding: { left: 1 }
    });

    // RIGHT PANEL: CC Logo + Alerts (Rows 0-2, Cols 8-12)
    const logoBox = grid.set(0, 8, 2, 4, blessed.box, {
        tags: true,
        style: {
            fg: 'magenta',
            bg: 'black'
        },
        border: { type: 'line', fg: 'blue' },
        align: 'center'
    });

    // ═══════════════════════════════════════════════════════════════════════
    // INPUT BAR (Row 2) - Between header and data panel
    // ═══════════════════════════════════════════════════════════════════════
    const input = grid.set(2, 0, 1, 12, blessed.textbox, {
        label: ' 🔍 Filter/Command > ',
        keys: true,
        inputOnFocus: true,
        style: {
            fg: 'white',
            bg: 'black',
            focus: {
                border: { fg: 'yellow' },
                fg: 'yellow'
            }
        },
        border: { type: 'line', fg: 'yellow' }
    });

    // ═══════════════════════════════════════════════════════════════════════
    // MAIN DATA TABLE (Rows 3-10) - Full width resource list
    // ═══════════════════════════════════════════════════════════════════════
    const resourceTable = grid.set(3, 0, 7, 12, contrib.table, {
        keys: true,
        fg: 'white',
        selectedFg: 'black',
        selectedBg: 'cyan',
        interactive: true,
        label: ' Pods(all)[0] ',
        border: { type: 'line', fg: 'cyan' },
        columnSpacing: 2,
        columnWidth: [35, 10, 10, 8, 6, 6, 6, 8],
        style: {
            fg: 'white',
            bg: 'black',
            header: {
                fg: 'cyan',
                bold: true
            }
        }
    });

    // ═══════════════════════════════════════════════════════════════════════
    // AGENT LOG (Rows 10-12) - Bottom panel for AI responses
    // ═══════════════════════════════════════════════════════════════════════
    const chatLog = grid.set(10, 0, 2, 12, blessed.box, {
        label: ' 🤖 Agent ',
        tags: true,
        style: {
            fg: 'green',
            bg: 'black'
        },
        border: { type: 'line', fg: 'green' },
        scrollable: true,
        alwaysScroll: true,
        scrollbar: {
            ch: '█',
            bg: 'black',
            fg: 'green'
        }
    });

    return {
        screen,
        grid,
        contextBox,
        shortcutsBox,
        logoBox,
        input,
        resourceTable,
        chatLog
    };
}

// Helper function to format context panel
export function formatContextPanel(info: {
    context: string;
    cluster: string;
    user: string;
    ccVersion: string;
    k8sVersion: string;
    cpu?: string;
    mem?: string;
}): string {
    return [
        `{cyan-fg}Context:{/cyan-fg}  {bold}${info.context}{/bold}`,
        `{cyan-fg}Cluster:{/cyan-fg}  {bold}${info.cluster}{/bold}`,
        `{cyan-fg}User:{/cyan-fg}     {bold}${info.user}{/bold}`,
        `{cyan-fg}CC Rev:{/cyan-fg}   {bold}${info.ccVersion}{/bold}`,
        `{cyan-fg}K8s Rev:{/cyan-fg}  {bold}${info.k8sVersion}{/bold}`,
        info.cpu ? `{cyan-fg}CPU:{/cyan-fg}      {bold}${info.cpu}{/bold}` : '',
        info.mem ? `{cyan-fg}MEM:{/cyan-fg}      {bold}${info.mem}{/bold}` : ''
    ].filter(Boolean).join('\n');
}

// Helper function to format shortcuts panel
export function formatShortcutsPanel(): string {
    return [
        '{yellow-fg}<:>{/yellow-fg} Command Mode',
        '{yellow-fg}<1>{/yellow-fg} Pods  {yellow-fg}<2>{/yellow-fg} Nodes',
        '{yellow-fg}<3>{/yellow-fg} Deploy {yellow-fg}<4>{/yellow-fg} Svc',
        '{yellow-fg}<d>{/yellow-fg} Describe {yellow-fg}<y>{/yellow-fg} YAML',
        '{yellow-fg}<r>{/yellow-fg} Refresh  {yellow-fg}<q>{/yellow-fg} Quit'
    ].join('\n');
}

// Helper function to format logo panel with optional warning
export function formatLogoPanel(warning?: string): string {
    const logo = `{magenta-fg}${CC_LOGO}{/magenta-fg}`;
    if (warning) {
        return logo + `\n{yellow-bg}{black-fg} ${warning} {/black-fg}{/yellow-bg}`;
    }
    return logo;
}
