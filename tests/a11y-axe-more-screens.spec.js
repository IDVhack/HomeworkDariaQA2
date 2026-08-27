// qa-spec.md, раздел 2.4 — axe-core на экранах, которых нет в
// tests/accessibility.spec.js (там 2.4.1, 2.4.2, 2.4.4, 2.4.5, 2.4.6):
//   2.4.3 — доска объявлений ПУСТАЯ (пользователь без объявлений);
//   2.4.7 — модалка деталей: ЧУЖОЕ объявление, свободно;
//   2.4.8 — модалка деталей: ЧУЖОЕ, ЗАБРОНИРОВАНО, с раскрытым телефоном;
//   2.4.9 — toast виден на экране во время сканирования.
// Паттерн тот же, что в accessibility.spec.js: считаем только нарушения
// уровня critical/serious; при их наличии тест падает RED со списком id.
const { test, expect } = require('@playwright/test');
const AxeBuilder = require('@axe-core/playwright').default;
const { clearState, register, logout, createListing, openFirstListing } = require('./helpers');

// копия хелпера из accessibility.spec.js (импортировать оттуда нельзя по условиям задачи)
function seriousOrWorse(violations) {
  return violations.filter((v) => v.impact === 'critical' || v.impact === 'serious');
}

async function expectNoSeriousViolations(page) {
  const results = await new AxeBuilder({ page }).analyze();
  expect(
    seriousOrWorse(results.violations),
    JSON.stringify(results.violations.map((v) => v.id)),
  ).toEqual([]);
}

test.describe('axe-core: остальные экраны из раздела 2.4', () => {
  test('2.4.3 — доска объявлений (пусто)', async ({ page }) => {
    await clearState(page);
    await register(page);
    // ни одного объявления не создаём — на доске состояние «Пока пусто»
    await expect(page.locator('.empty')).toBeVisible();
    await expectNoSeriousViolations(page);
  });

  test('2.4.7 — модалка деталей: чужое объявление, свободно', async ({ page }) => {
    await clearState(page);
    const author = await register(page);
    await createListing(page, { title: 'Чужое свободное объявление' });
    await logout(page);

    await register(page); // пользователь B — не автор
    await openFirstListing(page);

    // именно чужое и свободное: видна кнопка «Забронировать», нет блока телефона
    await expect(page.locator('#overlay-detail #do-book')).toBeVisible();
    await expect(page.locator('#overlay-detail .phone-reveal')).toHaveCount(0);
    expect(author.username).toBeTruthy();

    await expectNoSeriousViolations(page);
  });

  test('2.4.8 — модалка деталей: чужое, забронировано, телефон раскрыт', async ({ page }) => {
    await clearState(page);
    await register(page);
    await createListing(page, { title: 'Чужое объявление под бронь' });
    await logout(page);

    await register(page); // пользователь B — забронирует
    await openFirstListing(page);
    await page.locator('#overlay-detail #do-book').click();

    // после сохранения брони модалка перерисовывается — открываем карточку заново
    await page.locator('#overlay-detail').waitFor({ state: 'hidden' }).catch(() => {});
    if (!(await page.locator('#overlay-detail .phone-reveal').isVisible().catch(() => false))) {
      await openFirstListing(page);
    }

    await expect(page.locator('#overlay-detail .phone-reveal')).toBeVisible();
    await expect(page.locator('#overlay-detail .phone-reveal .num')).toBeVisible();

    await expectNoSeriousViolations(page);
  });

  test('2.4.9 — toast виден на экране во время скана', async ({ page }) => {
    await clearState(page);
    await register(page);

    // реальное действие с тостом: создаём объявление → «Объявление размещено»
    await page.getByRole('button', { name: '+ Разместить объявление' }).click();
    await page.locator('#form-add [name=title]').fill('Объявление ради тоста');
    await page.locator('#form-add [name=price]').fill('1000');
    await page.locator('#form-add [name=description]').fill('Описание ради тоста');
    await page.locator('#form-add button[type=submit]').click();
    await expect(page.locator('#overlay-add')).toBeHidden();

    const toast = page.locator('#toast');
    await expect(toast).toHaveClass(/show/);
    await expect(toast).toHaveText('Объявление размещено');

    // сканируем, пока тост в DOM и видим (он остаётся в DOM и после авто-скрытия)
    await expectNoSeriousViolations(page);
  });
});
