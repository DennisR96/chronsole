import * as cheerio from 'cheerio';
import { NodeHtmlMarkdown } from 'node-html-markdown';
import type { AgentTool } from './types';
import { getActiveChromePage } from './webShared';

export const webReadTool: AgentTool = {
  definition: {
    type: 'function',
    function: {
      name: 'web_read',
      description:
        'Reads the active Chrome tab and returns clean Markdown that preserves links and structure.',
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
      const html = await page.evaluate(() => document.documentElement.outerHTML);

      const $ = cheerio.load(html);

      $('script, style, svg, noscript, nav, footer').remove();

      const cleanedHtml = $.html();

      const markdown = NodeHtmlMarkdown.translate(cleanedHtml, {
        headingStyle: 'atx',
      });

      return markdown.trim();
    } catch (err: any) {
      return `Error reading web tab: ${err.message}`;
    } finally {
      await browser?.close().catch(() => { });
    }
  },
};
