import type { AgentTool } from './types';
import { getActiveChromePage } from './webShared';

export const webScreenTool: AgentTool = {
  definition: {
    type: 'function',
    function: {
      name: 'web_screen',
      description:
        'Captures a screenshot of the currently active Chrome tab and returns it as a base64 encoded data URI string.',
      parameters: {
        type: 'object',
        properties: {},
        required: [],
      },
    },
  },

  async execute() {
    let browser;

    try {
      const result = await getActiveChromePage();
      browser = result.browser;

      const page = result.page;

      const imageBuffer = await page.screenshot({
        fullPage: true,
        type: 'jpeg',
        quality: 60,
      });

      const imageBase64 = imageBuffer.toString('base64');

      return `data:image/jpeg;base64,${imageBase64}`;
    } catch (err: any) {
      return `Error capturing screenshot: ${err.message}`;
    } finally {
      await browser?.close().catch(() => { });
    }
  },
};
