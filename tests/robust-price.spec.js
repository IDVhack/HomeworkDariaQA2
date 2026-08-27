// qa-spec.md, раздел 3 «Устойчивость к чужим/кривым данным».
// 3.3 — отрицательная цена через обычный UI: в input[name=price]
//       (type=number min=0 step=1) вводится -500 и нажимается submit.
//       Ожидаемое и фиксируемое поведение в Chromium: нативная
//       constraint-валидation (min=0 → validity.rangeUnderflow) блокирует
//       отправку формы, объявление не создаётся, модалка #overlay-add
//       остаётся открытой.
// 3.5 — нечисловая / дробная / огромная цена, поданная в обход стрелок
//       (подмена .value + программный submit): доказать, что fmtPrice
//       (`Number(n) || 0` → toLocaleString('ru-RU')) не роняет рендер и
//       не ломает вёрстку. abc → «0 ₽», 1.5 → «1,5 ₽»,
//       99999999999999 → сгруппированное число без переполнения.
//
// 3.4 (обход валидации, значение уходит в state как есть) и 3.10 (гонки)
// покрыты в tests/bypass-ui.spec.js — здесь другой ракурс: целостность
// рендера и нативная валидация штатного UI.
const { test, expect } = require('@playwright/test');
const { clearState, register } = require('./helpers');

async function openAdd(page) {
  await page.getByRole('button', { name: '+ Разместить объявление' }).click();
  await page.locator('#form-add').waitFor();
  await page.locator('#form-add [name=title]').fill('Проверка цены');
  await page.locator('#form-add [name=description]').fill('Описание для проверки цены');
}

// ------------------------------------------------------------------
// 3.3 — отрицательная цена через штатный UI
// ------------------------------------------------------------------

test('3.3: -500 через обычный ввод блокируется нативной валидацией min=0', async ({ page }) => {
  await clearState(page);
  await register(page);

  await openAdd(page);
  await page.locator('#form-add [name=price]').fill('-500');

  // фактическое поведение Chromium: min="0" → rangeUnderflow, submit
  // не проходит
  const rangeUnderflow = await page
    .locator('#form-add [name=price]')
    .evaluate((el) => el.validity.rangeUnderflow);
  expect(rangeUnderflow).toBe(true);

  await page.locator('#form-add button[type=submit]').click();

  // форма не отправилась: модалка открыта, карточек нет, в state пусто
  await expect(page.locator('#overlay-add .modal')).toBeVisible();
  await expect(page.locator('.card')).toHaveCount(0);
  const listings = await page.evaluate(() => {
    try {
      return (JSON.parse(localStorage.getItem('sl_state')) || {}).listings || [];
    } catch (e) {
      return [];
    }
  });
  expect(listings.length).toBe(0);
});

// ------------------------------------------------------------------
// 3.5 — нечисловая / дробная / огромная цена в обход стрелок
// ------------------------------------------------------------------

// подменяем значение поля мимо constraint-валидации и шлём submit
// напрямую (обход стрелок/нативной проверки, как paste в qa-spec 3.5)
async function submitWithRawPrice(page, raw) {
  await openAdd(page);
  await page.locator('#form-add [name=price]').evaluate((el, v) => {
    el.type = 'text'; // чтобы в number-поле прошла произвольная строка
    el.value = v;
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }, raw);
  await page.locator('#form-add').dispatchEvent('submit');
  await page.locator('#overlay-add').waitFor({ state: 'hidden' });
}

test('3.5: нечисловая цена «abc» → «0 ₽», рендер не падает', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));

  await clearState(page);
  await register(page);
  await submitWithRawPrice(page, 'abc');

  await expect(page.locator('.card')).toHaveCount(1);
  await expect(page.locator('.card')).toBeVisible();
  await expect(page.locator('.card .price')).toHaveText('0 ₽');
  expect(errors).toEqual([]);
});

test('3.5: дробная цена «1.5» → «1,5 ₽», рендер не падает', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));

  await clearState(page);
  await register(page);
  await submitWithRawPrice(page, '1.5');

  await expect(page.locator('.card')).toHaveCount(1);
  await expect(page.locator('.card .price')).toHaveText('1,5 ₽');
  expect(errors).toEqual([]);
});

test('3.5: огромная цена «99999999999999» → сгруппированное число, без переполнения вёрстки', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));

  await clearState(page);
  await register(page);
  await submitWithRawPrice(page, '99999999999999');

  await expect(page.locator('.card')).toHaveCount(1);
  await expect(page.locator('.card .price')).toBeVisible();

  // toLocaleString('ru-RU') группирует разряды каким-то пробельным
  // символом (U+00A0 / U+202F в зависимости от ICU) — сверяем без пробелов
  const priceText = await page.locator('.card .price').textContent();
  expect(priceText.replace(/[\s  ]/g, '')).toBe('99999999999999₽');

  // вёрстка не разъезжается по горизонтали
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth <= window.innerWidth + 1
  );
  expect(overflow).toBe(true);
  expect(errors).toEqual([]);

  // значение переживает перезагрузку и по-прежнему не роняет рендер
  await page.reload();
  await expect(page.locator('.card .price')).toBeVisible();
  expect(errors).toEqual([]);
});
