// qa-spec.md, раздел 2.4 — axe-core на основных экранах.
// Тесты фиксируют реальное состояние доступности: если критичные/серьёзные
// нарушения есть в коде, тест должен упасть — это не подгоняется под зелёный.
const { test, expect } = require('@playwright/test');
const AxeBuilder = require('@axe-core/playwright').default;
const { clearState, register, createListing, openFirstListing } = require('./helpers');

function seriousOrWorse(violations) {
  return violations.filter((v) => v.impact === 'critical' || v.impact === 'serious');
}

test.describe('axe-core: основные экраны', () => {
  test('экран входа', async ({ page }) => {
    await clearState(page);
    const results = await new AxeBuilder({ page }).analyze();
    expect(seriousOrWorse(results.violations), JSON.stringify(results.violations.map((v) => v.id))).toEqual([]);
  });

  test('экран регистрации', async ({ page }) => {
    await clearState(page);
    await page.getByRole('button', { name: 'Регистрация' }).click();
    const results = await new AxeBuilder({ page }).analyze();
    expect(seriousOrWorse(results.violations), JSON.stringify(results.violations.map((v) => v.id))).toEqual([]);
  });

  test('доска объявлений', async ({ page }) => {
    await clearState(page);
    await register(page);
    await createListing(page, { title: 'Проверка доступности доски' });
    const results = await new AxeBuilder({ page }).analyze();
    expect(seriousOrWorse(results.violations), JSON.stringify(results.violations.map((v) => v.id))).toEqual([]);
  });

  test('модалка «Новое объявление»', async ({ page }) => {
    await clearState(page);
    await register(page);
    await page.getByRole('button', { name: '+ Разместить объявление' }).click();
    await page.locator('#overlay-add .modal').waitFor();
    const results = await new AxeBuilder({ page }).analyze();
    expect(seriousOrWorse(results.violations), JSON.stringify(results.violations.map((v) => v.id))).toEqual([]);
  });

  test('модалка деталей объявления', async ({ page }) => {
    await clearState(page);
    await register(page);
    await createListing(page, { title: 'Проверка доступности деталей' });
    await openFirstListing(page);
    const results = await new AxeBuilder({ page }).analyze();
    expect(seriousOrWorse(results.violations), JSON.stringify(results.violations.map((v) => v.id))).toEqual([]);
  });
});
