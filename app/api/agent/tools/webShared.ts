import { chromium, type Browser, type Page } from 'playwright';

export async function getActiveChromePage(port = 9222): Promise<{
  browser: Browser;
  page: Page;
}> {
  const browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`);

  const contexts = browser.contexts();
  if (!contexts.length) {
    await browser.close();
    throw new Error('No browser contexts found.');
  }

  const pages = contexts[0].pages();
  if (!pages.length) {
    await browser.close();
    throw new Error('No tabs found.');
  }

  return {
    browser,
    page: pages[0],
  };
}

export function locate(page: Page, selector: string) {
  if (selector.startsWith('text=')) {
    return page.getByText(selector.slice(5), { exact: false }).first();
  }

  if (selector.startsWith('role=')) {
    const rest = selector.slice(5);

    if (rest.includes(':')) {
      const [role, ...nameParts] = rest.split(':');
      const name = nameParts.join(':');

      return page.getByRole(role as any, { name }).first();
    }

    return page.getByRole(rest as any).first();
  }

  if (selector.startsWith('label=')) {
    return page.getByLabel(selector.slice(6)).first();
  }

  if (selector.startsWith('placeholder=')) {
    return page.getByPlaceholder(selector.slice(12)).first();
  }

  return page.locator(selector).first();
}
