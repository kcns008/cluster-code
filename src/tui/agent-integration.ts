
import { AgentSession } from '../agent/agent-session';
import { tuiState } from './state';
import * as blessed from 'blessed';

export class TuiAgentIntegration {
    private agentSession: AgentSession;
    private chatLog: blessed.Widgets.BoxElement;
    private screen: blessed.Widgets.Screen;

    constructor(chatLog: blessed.Widgets.BoxElement, screen: blessed.Widgets.Screen) {
        this.chatLog = chatLog;
        this.screen = screen;

        // Initialize AgentSession with custom logger
        this.agentSession = new AgentSession({
            showWelcome: false,
            logger: (msg: string) => this.log(msg),
            autoExecute: true, // Maybe make this configurable via TUI?
            verbose: false
        });
    }

    async processInput(input: string) {
        if (!input.trim()) return;

        // Display User Message with styling
        this.log(`{bold}{cyan}You:{/cyan}{/bold} ${input}\n`);

        // Construct Prompt with Context
        let fullPrompt = input;
        if (tuiState.selectedResource) {
            fullPrompt += `\n\n[Context: User has selected the following ${tuiState.currentResourceType}]\n`;
            fullPrompt += `Name: ${tuiState.selectedResource.metadata.name}\n`;
            fullPrompt += `Namespace: ${tuiState.selectedResource.metadata.namespace || 'N/A'}\n`;

            // Add a summary of the resource
            // We strip some fields to avoid token limit issues if necessary, but for now pass full JSON
            // maybe truncated if too large.
            const jsonStr = JSON.stringify(tuiState.selectedResource, null, 2);
            if (jsonStr.length > 10000) {
                fullPrompt += `Content (truncated): ${jsonStr.substring(0, 10000)}...`;
            } else {
                fullPrompt += `Content: ${jsonStr}`;
            }
        }

        this.log(`{bold}{green}Agent:{/green}{/bold} Thinking...`);
        this.screen.render();

        // Run query
        // We use runSingle because we manage the loop in TUI
        // But runSingle is async and prints to logger. 
        // We don't await strictly if we want UI to remain responsive? 
        // Actually blessed is single threaded event loop, so we must await or promise chain.
        // runSingle usage of await might block if it does heavy sync work, but it should be async HTTP.

        try {
            await this.agentSession.runSingle(fullPrompt);
        } catch (error: any) {
            this.log(`{red}Error: ${error.message}{/red}`);
        }

        this.screen.render();
    }

    log(msg: string) {
        // Strip ANSI codes if blessed doesn't handle them well with tags, 
        // or ensure usage of tags=true in box.
        // Blessed handling of ANSI + tags can be tricky.
        // Generally simpler to just push strings.
        // But we want to preserve some structure.
        this.chatLog.pushLine(msg);
        this.chatLog.setScrollPerc(100);
        this.screen.render();
    }
}
