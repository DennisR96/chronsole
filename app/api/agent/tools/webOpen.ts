import type { AgentTool } from './types';
import { getActiveChromePage } from './webShared';

export const webOpenTool: AgentTool = {
  definition: {
    type: 'function',
    function: {
      name: 'web_open',
      description: 'Opens a specific URL in the currently active Chrome tab.',
      parameters: {
        type: 'object',
        properties: {
          url: {
            type: 'string',
            description: "The URL to open, e.g. 'https://www.google.com'.",
          },
        },
        required: ['url'],
      },
    },
  },

  async execute(args) {
    let browser;

    try {
      const result = await getActiveChromePage();
      browser = result.browser;

      const page = result.page;
      await page.goto(args.url, { waitUntil: 'domcontentloaded' });

      const title = await page.title();

      return `Successfully opened ${args.url}. Current page title: ${title}`;
    } catch (err: any) {
      return `Error opening URL: ${err.message}`;
    } finally {
      await browser?.close().catch(() => { });
    }
  },
};
