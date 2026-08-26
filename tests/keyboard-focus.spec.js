// qa-spec.md, разделы 2.1–2.3 — клавиатурная навигация, фокус в модалках, Escape.
// Утверждения ниже описывают ПРАВИЛЬНОЕ ожидаемое поведение, а не то, что
// код делает сейчас. Известные подтверждённые дефекты (см. qa-report.md /
// qa-report-solo.md) должны здесь падать — это ожидаемо и не подгоняется
// под зелёный.
const { test, expect } = require('@playwright/test');
const { clearState, register, createListing, openFirstListing } = require('./helpers');

test.describe('Escape закрывает модалки', () => {
  test('Escape закрывает модалку «Новое объявление»', async ({ page }) => {
    await clearState(page);
    await register(page);
    await page.getByRole('button', { name: '+ Разместить объявление' }).click();
    await page.locator('#overlay-add .modal').waitFor();

    await page.keyboard.press('Escape');

    await expect(page.locator('#overlay-add')).toBeHidden();
  });

  test('Escape закрывает модалку деталей объявления', async ({ page }) => {
    await clearState(page);
    await register(page);
    await createListing(page, { title: 'Escape test listing' });
    await openFirstListing(page);

    await page.keyboard.press('Escape');

    await expect(page.locator('#overlay-detail')).toBeHidden();
  });
});

test.describe('Фокус в модалках', () => {
  test('фокус переходит внутрь модалки при открытии', async ({ page }) => {
    await clearState(page);
    await register(page);
    await page.getByRole('button', { name: '+ Разместить объявление' }).click();
    await page.locator('#overlay-add .modal').waitFor();

    const focusInsideModal = await page.evaluate(() => {
      const modal = document.querySelector('#overlay-add .modal');
      return modal.contains(document.activeElement);
    });

    expect(focusInsideModal).toBe(true);
  });

  test('Tab не выводит фокус за пределы открытой модалки (focus trap)', async ({ page }) => {
    await clearState(page);
    await register(page);
    await page.getByRole('button', { name: '+ Разместить объявление' }).click();
    await page.locator('#form-add [name=title]').focus();

    // полей и кнопок в форме добавления объявления — 6: title, category,
    // price, description, cancel, submit; 7-й Tab должен остаться внутри
    for (let i = 0; i < 7; i++) {
      await page.keyboard.press('Tab');
    }

    const focusInsideModal = await page.evaluate(() => {
      const modal = document.querySelector('#overlay-add .modal');
      return modal.contains(document.activeElement);
    });

    expect(focusInsideModal).toBe(true);
  });

  test('модалки объявлены экранным читалкам как диалог (role/aria)', async ({ page }) => {
    await clearState(page);
    await register(page);
    await page.getByRole('button', { name: '+ Разместить объявление' }).click();
    await page.locator('#overlay-add .modal').waitFor();

    const modal = page.locator('#overlay-add .modal');
    await expect(modal).toHaveAttribute('role', 'dialog');
    await expect(modal).toHaveAttribute('aria-modal', 'true');
  });
});

test.describe('Клавиатурная доступность карточек объявлений', () => {
  test('карточку объявления можно открыть с клавиатуры (Tab + Enter)', async ({ page }) => {
    await clearState(page);
    await register(page);
    await createListing(page, { title: 'Keyboard card test' });

    await page.locator('[data-open]').first().focus();
    await page.keyboard.press('Enter');

    await expect(page.locator('#overlay-detail')).toBeVisible();
  });
});
