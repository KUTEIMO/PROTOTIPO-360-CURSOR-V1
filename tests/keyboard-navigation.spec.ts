import { test, expect } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:8080/index.html';

test.describe('Accesibilidad básica del tour 360°', () => {
  test('hotspots reciben foco y abren panel accesible', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForSelector('#panorama');
    await page.waitForSelector('#hotspotList');

    // Usamos el skip-link para saltar directamente a los hotspots
    await page.locator('#skipHotspots').evaluate((el: HTMLElement) => el.focus());
    await page.keyboard.press('Enter');

    const focused = await page.evaluate(() => document.activeElement?.getAttribute('data-hotspot-id'));
    expect(focused).toBeTruthy();

    // Abrimos el panel de hotspot
    await page.keyboard.press('Enter');
    const panel = page.locator('#hotspotPanel');
    await expect(panel).toBeVisible();
    await expect(panel).toHaveAttribute('aria-hidden', 'false');

    // Validamos que existan controles de audio accesibles
    await expect(page.locator('#hotspotAudio')).toHaveAttribute('src', /assets\/audio\/placeholder\.mp3/);
    await expect(page.locator('[data-audio-action="play"]')).toBeVisible();
  });
});

