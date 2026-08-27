// qa-spec.md, раздел 2.1 — клавиатурная навигация.
// Покрываются строки, которых нет в tests/keyboard-focus.spec.js (там 2.1.1
// и разделы 2.2/2.3):
//   2.1.2 — активация чипов категорий с клавиатуры (Enter и Space);
//   2.1.3 — кнопка «+ Разместить объявление» открывается с клавиатуры;
//   2.1.4 — регистрация проходится полностью с клавиатуры;
//   2.1.5 — видимый focus-outline на интерактивных элементах (поиск и чипы).
// Утверждения описывают ПРАВИЛЬНОЕ ожидаемое поведение. Где приложение ему
// не удовлетворяет — тест падает RED осознанно, с пояснением.
const { test, expect } = require('@playwright/test');
const { clearState, register, createListing, uniqueUsername } = require('./helpers');

test.describe('2.1.2 — чипы категорий активируются с клавиатуры', () => {
  test('Enter на сфокусированном чипе меняет активную категорию', async ({ page }) => {
    await clearState(page);
    await register(page);
    await createListing(page, { title: 'Чип-навигация Enter', category: 'food' });

    // «Все» активна по умолчанию; наводим фокус на чип «Еда» и жмём Enter.
    await page.locator('.chip[data-cat="food"]').focus();
    await page.keyboard.press('Enter');

    await expect(page.locator('.chip[data-cat="food"]')).toHaveClass(/active/);
    await expect(page.locator('.chip[data-cat="all"]')).not.toHaveClass(/active/);
    // доска перефильтровалась под категорию — объявление категории food видно
    await expect(page.locator('.card[data-open]')).toHaveCount(1);
  });

  test('Space на сфокусированном чипе меняет активную категорию', async ({ page }) => {
    await clearState(page);
    await register(page);
    await createListing(page, { title: 'Чип-навигация Space', category: 'repair' });

    await page.locator('.chip[data-cat="repair"]').focus();
    await page.keyboard.press('Space');

    await expect(page.locator('.chip[data-cat="repair"]')).toHaveClass(/active/);
    await expect(page.locator('.chip[data-cat="all"]')).not.toHaveClass(/active/);
  });
});

test.describe('2.1.3 — «+ Разместить объявление» открывается с клавиатуры', () => {
  test('фокус на #btn-add + Enter открывает модалку #overlay-add', async ({ page }) => {
    await clearState(page);
    await register(page);

    await page.locator('#btn-add').focus();
    await page.keyboard.press('Enter');

    await expect(page.locator('#overlay-add')).toBeVisible();
    await expect(page.locator('#overlay-add .modal')).toBeVisible();
  });
});

test.describe('2.1.4 — форму регистрации можно заполнить только клавиатурой', () => {
  test('переход по вкладке, Tab между полями, submit по Enter из последнего поля', async ({ page }) => {
    await clearState(page);

    const username = uniqueUsername('kbd');

    // 1. Клавиатурой добираемся до вкладки «Регистрация» и активируем её.
    await tabUntil(page, () => {
      const a = document.activeElement;
      return !!(a && a.dataset && a.dataset.tab === 'register');
    });
    await page.keyboard.press('Enter');

    // 2. Клавиатурой добираемся до первого поля формы регистрации.
    await tabUntil(page, () => {
      const a = document.activeElement;
      return !!(a && a.name === 'username' && a.closest && a.closest('#form-register'));
    });

    // 3. Заполняем поля, перемещаясь по Tab; проверяем, что фокус реально идёт по полям.
    await page.keyboard.type(username);
    await page.keyboard.press('Tab');
    await expect.poll(() => activeName(page)).toBe('password');
    await page.keyboard.type('goodpass1');
    await page.keyboard.press('Tab');
    await expect.poll(() => activeName(page)).toBe('password2');
    await page.keyboard.type('goodpass1');
    await page.keyboard.press('Tab');
    await expect.poll(() => activeName(page)).toBe('displayName');
    await page.keyboard.type('Клавиатурный Тест');
    await page.keyboard.press('Tab');
    await expect.poll(() => activeName(page)).toBe('apt'); // необязательное поле — пропускаем
    await page.keyboard.press('Tab');
    await expect.poll(() => activeName(page)).toBe('phone');
    await page.keyboard.type('+7 900 111-22-33');

    // 4. submit по Enter из последнего поля.
    await page.keyboard.press('Enter');

    // Аккаунт создан, автоматический вход, видна доска.
    await expect(page.getByRole('button', { name: '+ Разместить объявление' })).toBeVisible();
  });
});

test.describe('2.1.5 — видимый focus-outline на интерактивных элементах', () => {
  test('у поля поиска при фокусе есть видимый outline', async ({ page }) => {
    await clearState(page);
    await register(page);

    await page.locator('#search').focus();
    const width = await page.evaluate(() => getComputedStyle(document.querySelector('#search')).outlineWidth);

    // CSS-правило `.search:focus{outline:2px solid var(--accent)}` существует.
    expect(parseFloat(width), `outline-width поля поиска при фокусе = ${width}`).toBeGreaterThan(0);
  });

  test('у чипа категории при клавиатурном фокусе есть видимый индикатор фокуса', async ({ page }) => {
    await clearState(page);
    await register(page);
    await createListing(page, { title: 'Фокус на чипе' });

    // фокус приходит клавиатурой (важно для :focus-visible)
    await page.locator('#search').focus();
    await page.keyboard.press('Tab');
    await expect
      .poll(() => page.evaluate(() => document.activeElement && document.activeElement.getAttribute('data-cat')))
      .toBe('all');

    const styles = await page.evaluate(() => {
      const el = document.activeElement;
      const s = getComputedStyle(el);
      return {
        outlineStyle: s.outlineStyle,
        outlineWidth: s.outlineWidth,
        boxShadow: s.boxShadow,
      };
    });

    const hasIndicator =
      (styles.outlineStyle !== 'none' && parseFloat(styles.outlineWidth) > 0) ||
      (styles.boxShadow && styles.boxShadow !== 'none');

    // qa-spec 2.1.5 требует видимый focus-outline на КАЖДОМ интерактивном
    // элементе. У `.chip` в CSS приложения нет собственного `:focus`/`:focus-visible`
    // правила (в отличие от `.search` и `.field input/select/textarea`) — индикатор
    // держится только на дефолтном фокус-ринге браузера. Если он отсутствует или
    // нулевой — это реальный дефект доступности, тест падает RED.
    expect(
      hasIndicator,
      `qa-spec 2.1.5: у чипа-кнопки нет видимого индикатора фокуса, вычисленные стили: ${JSON.stringify(styles)}`,
    ).toBe(true);
  });
});

async function tabUntil(page, predicate, max = 25) {
  for (let i = 0; i < max; i++) {
    if (await page.evaluate(predicate)) return;
    await page.keyboard.press('Tab');
  }
  const reached = await page.evaluate(predicate);
  expect(reached, 'не удалось добраться до нужного элемента только клавишей Tab').toBe(true);
}

function activeName(page) {
  return page.evaluate(() => (document.activeElement ? document.activeElement.name : null));
}
