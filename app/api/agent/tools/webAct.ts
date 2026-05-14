import type { AgentTool } from './types';
import { getActiveChromePage, locate } from './webShared';

export const webActTool: AgentTool = {
  definition: {
    type: 'function',
    function: {
      name: 'web_act',
      description:
        'Performs an interactive action on the currently active Chrome tab: click, fill an input, press a key, hover, select a dropdown option, scroll, or wait. Call web_read or web_screen first to identify targets.',
      parameters: {
        type: 'object',
        properties: {
          action: {
            type: 'string',
            enum: ['click', 'fill', 'press', 'hover', 'select', 'scroll', 'wait'],
            description: 'The action to perform.',
          },
          selector: {
            type: 'string',
            description:
              "Target element. Either a raw CSS/XPath selector, or one of: 'text=<visible text>', 'role=<role>:<accessible name>', 'label=<label>', 'placeholder=<placeholder>'. Required for click/fill/hover/select; optional for press.",
          },
          text: {
            type: 'string',
            description:
              "For fill: text to type. For select: option value or label. For scroll: 'up', 'down', 'top', 'bottom', or a signed pixel amount. For wait: milliseconds, default 1500.",
          },
          key: {
            type: 'string',
            description:
              "Key for press, e.g. 'Enter', 'Tab', 'Escape', 'ArrowDown', 'Control+a'.",
          },
        },
        required: ['action'],
      },
    },
  },

  async execute(args) {
    let browser;

    try {
      const result = await getActiveChromePage();
      browser = result.browser;

      const page = result.page;
      const action = args.action as string;

      let message: string;

      if (action === 'click') {
        if (!args.selector) return "Error: 'selector' is required for click.";

        await locate(page, args.selector).click();
        message = `Clicked: ${args.selector}`;
      } else if (action === 'fill') {
        if (!args.selector || args.text === undefined) {
          return "Error: 'selector' and 'text' are required for fill.";
        }

        const loc = locate(page, args.selector);
        await loc.click();
        await loc.fill(String(args.text));

        message = `Filled ${JSON.stringify(args.selector)} with ${String(args.text).length} chars.`;
      } else if (action === 'press') {
        if (!args.key) return "Error: 'key' is required for press.";

        if (args.selector) {
          await locate(page, args.selector).press(args.key);
        } else {
          await page.keyboard.press(args.key);
        }

        message = `Pressed key: ${args.key}`;
      } else if (action === 'hover') {
        if (!args.selector) return "Error: 'selector' is required for hover.";

        await locate(page, args.selector).hover();
        message = `Hovered: ${args.selector}`;
      } else if (action === 'select') {
        if (!args.selector || args.text === undefined) {
          return "Error: 'selector' and 'text' are required for select.";
        }

        await locate(page, args.selector).selectOption(String(args.text));
        message = `Selected ${JSON.stringify(args.text)} in ${args.selector}`;
      } else if (action === 'scroll') {
        const amount = String(args.text ?? 'down').trim().toLowerCase();

        let dy = 0;

        if (amount === 'down') {
          dy = 600;
        } else if (amount === 'up') {
          dy = -600;
        } else if (amount === 'top' || amount === 'home') {
          await page.evaluate(() => window.scrollTo(0, 0));
        } else if (amount === 'bottom' || amount === 'end') {
          await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
        } else {
          const parsed = Number.parseInt(amount, 10);

          if (Number.isNaN(parsed)) {
            return `Error: invalid scroll amount ${JSON.stringify(amount)}.`;
          }

          dy = parsed;
        }

        if (dy) {
          await page.mouse.wheel(0, dy);
        }

        message = `Scrolled: ${amount}`;
      } else if (action === 'wait') {
        let ms = 1500;

        if (args.text) {
          const parsed = Number.parseInt(String(args.text), 10);
          if (!Number.isNaN(parsed)) ms = parsed;
        }

        await page.waitForTimeout(ms);
        message = `Waited ${ms}ms`;
      } else {
        return `Error: unknown action ${JSON.stringify(action)}.`;
      }

      try {
        await page.waitForLoadState('domcontentloaded', { timeout: 3000 });
      } catch {
        // Ignore timeout; many UI actions do not trigger navigation.
      }

      return `${message}. URL: ${page.url()}`;
    } catch (err: any) {
      return `Error performing action: ${err.message}`;
    } finally {
      await browser?.close().catch(() => { });
    }
  },
};
