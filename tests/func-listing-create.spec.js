// qa-spec.md, раздел 1.3 — размещение объявления. Закрыты «пробелы» покрытия:
// 1.3.2 пустой/пробельный заголовок или описание → объявление не создаётся,
//       модалка не закрывается
// 1.3.3 категория по умолчанию «Другое» (other) сохраняется, если select не трогали
// 1.3.4 отмена создания (кнопка «Отмена» / ✕ / клик по подложке) → модалка
//       закрыта, объявление не создано
// Успешное размещение (1.3.1) — в tests/functional-flow.spec.js, не дублируется.
//
// Все тесты проверяют КОРРЕКТНОЕ ожидаемое поведение из qa-spec.md.
// В обработчике #form-add проверка `if(!item.title||!item.description) return;`
// стоит ДО closeAddModal() — значит при пустом заголовке/описании модалка
// обязана остаться открытой.
const { test, expect } = require('@playwright/test');
const { clearState, register, createListing } = require('./helpers');

async function readState(page) {
  return page.evaluate(() => {
    const raw = localStorage.getItem('sl_state');
    return raw ? JSON.parse(raw) : null;
  });
}

async function openAddModal(page) {
  await page.getByRole('button', { name: '+ Разместить объявление' }).click();
  await page.locator('#form-add').waitFor();
}

test('1.3.2: пробельный заголовок → объявление не создаётся, модалка открыта', async ({ page }) => {
  await clearState(page);
  await register(page);

  await openAddModal(page);
  await page.locator('#form-add [name=title]').fill('   ');
  await page.locator('#form-add [name=price]').fill('100');
  await page.locator('#form-add [name=description]').fill('Нормальное описание услуги');
  await page.locator('#form-add button[type=submit]').click();

  // JS-проверка после trim() отсекает отправку до closeAddModal()
  await expect(page.locator('#overlay-add')).toBeVisible();
  await expect(page.locator('#form-add')).toBeVisible();
  await expect(page.locator('.card')).toHaveCount(0);
  const st = await readState(page);
  expect(st && st.listings ? st.listings : []).toHaveLength(0);
});

test('1.3.2: пробельное описание → объявление не создаётся, модалка открыта', async ({ page }) => {
  await clearState(page);
  await register(page);

  await openAddModal(page);
  await page.locator('#form-add [name=title]').fill('Реальный заголовок');
  await page.locator('#form-add [name=price]').fill('100');
  await page.locator('#form-add [name=description]').fill('   ');
  await page.locator('#form-add button[type=submit]').click();

  await expect(page.locator('#overlay-add')).toBeVisible();
  await expect(page.locator('#form-add')).toBeVisible();
  await expect(page.locator('.card')).toHaveCount(0);
  const st = await readState(page);
  expect(st && st.listings ? st.listings : []).toHaveLength(0);
});

test('1.3.3: категория по умолчанию «Другое» (other) сохраняется, если select не трогали', async ({ page }) => {
  await clearState(page);
  await register(page);

  // createListing() из helpers не передаёт category → select остаётся на
  // предвыбранном варианте other
  await createListing(page, { title: 'Без выбора категории', description: 'select не трогали' });

  const state = await readState(page);
  expect(state.listings).toHaveLength(1);
  expect(state.listings[0].category).toBe('other');
});

test('1.3.4: отмена создания (Отмена / ✕ / клик по подложке) закрывает модалку, объявление не создаётся', async ({ page }) => {
  await clearState(page);
  await register(page);

  // 1) кнопка «Отмена»
  await openAddModal(page);
  await expect(page.locator('#overlay-add')).toBeVisible();
  await page.getByRole('button', { name: 'Отмена' }).click();
  await expect(page.locator('#overlay-add')).toBeHidden();

  // 2) крестик ✕
  await openAddModal(page);
  await page.locator('#close-add').click();
  await expect(page.locator('#overlay-add')).toBeHidden();

  // 3) клик по подложке (по самому overlay, вне модалки)
  await openAddModal(page);
  await page.locator('#overlay-add').click({ position: { x: 5, y: 5 } });
  await expect(page.locator('#overlay-add')).toBeHidden();

  await expect(page.locator('.card')).toHaveCount(0);
  const st = await readState(page);
  expect(st && st.listings ? st.listings : []).toHaveLength(0);
});
