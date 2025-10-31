/**
 * Interactive chat mode for cluster troubleshooting
 */

import Anthropic from '@anthropic-ai/sdk';
import inquirer from 'inquirer';
import chalk from 'chalk';
import { configManager } from '../config';
import { logger } from '../utils/logger';
import { ChatMessage } from '../types';
import { kubectl } from '../utils/kubectl';

const SYSTEM_PROMPT = `You are Cluster Code, an AI assistant specialized in Kubernetes and OpenShift cluster troubleshooting and management.

You help users:
- Diagnose cluster issues
- Troubleshoot pod failures
- Analyze logs and events
- Provide recommendations for cluster optimization
- Explain Kubernetes concepts
- Guide users through cluster operations

When analyzing issues:
1. Ask clarifying questions if needed
2. Request relevant kubectl commands to gather information
3. Provide clear, actionable recommendations
4. Explain the root cause of issues
5. Suggest preventive measures

You have access to the user's cluster via kubectl. When you need information, ask the user to run specific kubectl commands and share the output.

Be concise, helpful, and focus on solving the user's problems efficiently.`;

export class ChatSession {
  private client: Anthropic;
  private messages: ChatMessage[] = [];
  private context: string;
  private namespace: string;

  constructor(apiKey: string, context: string, namespace: string) {
    this.client = new Anthropic({ apiKey });
    this.context = context;
    this.namespace = namespace;
  }

  async start(initialMessage?: string): Promise<void> {
    logger.section('Cluster Code Interactive Chat');
    logger.info(`Context: ${this.context}`);
    logger.info(`Namespace: ${this.namespace}`);
    logger.newline();
    logger.info('Type your questions or describe issues. Type "exit" or "quit" to end the session.');
    logger.info('Type "/kubectl <command>" to run kubectl commands directly.');
    logger.newline();

    if (initialMessage) {
      await this.processMessage(initialMessage);
    }

    await this.chatLoop();
  }

  private async chatLoop(): Promise<void> {
    while (true) {
      const { userInput } = await inquirer.prompt([
        {
          type: 'input',
          name: 'userInput',
          message: chalk.cyan('You:'),
          prefix: '',
        },
      ]);

      if (!userInput.trim()) {
        continue;
      }

      const input = userInput.trim();

      // Check for exit commands
      if (input.toLowerCase() === 'exit' || input.toLowerCase() === 'quit') {
        logger.info('Goodbye! 👋');
        break;
      }

      // Check for kubectl commands
      if (input.startsWith('/kubectl ')) {
        const command = input.replace('/kubectl ', '');
        await this.executeKubectl(command);
        continue;
      }

      // Process regular message
      await this.processMessage(input);
    }
  }

  private async processMessage(userMessage: string): Promise<void> {
    // Add user message to history
    this.messages.push({
      role: 'user',
      content: userMessage,
      timestamp: new Date(),
    });

    try {
      logger.startSpinner('Thinking...');

      // Call Claude API
      const response = await this.client.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 4096,
        system: SYSTEM_PROMPT,
        messages: this.messages.map(msg => ({
          role: msg.role as 'user' | 'assistant',
          content: msg.content,
        })),
      });

      logger.stopSpinner();

      const assistantMessage = response.content[0].type === 'text' ? response.content[0].text : '';

      // Add assistant message to history
      this.messages.push({
        role: 'assistant',
        content: assistantMessage,
        timestamp: new Date(),
      });

      // Display response
      console.log(chalk.green('Assistant:'), assistantMessage);
      logger.newline();
    } catch (error: any) {
      logger.stopSpinner();
      logger.error(`Failed to get response: ${error.message}`);
      logger.newline();
    }
  }

  private async executeKubectl(command: string): Promise<void> {
    try {
      logger.startSpinner(`Running: kubectl ${command}`);

      const output = await kubectl(command, {
        context: this.context,
        namespace: this.namespace,
      });

      logger.succeedSpinner('Command completed');
      console.log(chalk.gray(output));
      logger.newline();
    } catch (error: any) {
      logger.failSpinner('Command failed');
      logger.error(error.message);
      logger.newline();
    }
  }
}

export async function chatCommand(initialMessage?: string): Promise<void> {
  const cluster = configManager.getCluster();
  if (!cluster) {
    logger.error('Cluster not configured. Run "cluster-code init" first.');
    process.exit(1);
  }

  const apiKey = configManager.getApiKey();
  if (!apiKey) {
    logger.error('Anthropic API key not configured.');
    logger.info('Set it via environment variable: export ANTHROPIC_API_KEY="your-key"');
    logger.info('Or save it to config: cluster-code config set anthropicApiKey "your-key"');
    process.exit(1);
  }

  const session = new ChatSession(apiKey, cluster.context, cluster.namespace);
  await session.start(initialMessage);
}
