// qa-spec.md, раздел 3 — устойчивость к чужим/кривым данным.
// 3.11 — HTML/JS-инъекция в текстовых полях не должна исполняться.
// 3.13 — подделка сессии в localStorage: известное архитектурное
// ограничение (нет пароля/токена в сессии), а не блокер — тест
// фиксирует это поведение как задокументированное, чтобы оно не
// разошлось молча с qa-spec.md при будущих изменениях кода.
const { test, expect } = require('@playwright/test');
const { clearState, register, logout, createListing, openFirstListing } = require('./helpers');

test('3.11: HTML/JS-инъекция в заголовке и описании не исполняется', async ({ page }) => {
  await clearState(page);

  // ловим alert() на случай, если инъекция всё-таки исполнится —
  // не полагаемся только на текстовое сравнение DOM
  let alertFired = false;
  page.on('dialog', async (dialog) => {
    alertFired = true;
    await dialog.dismiss();
  });

  const payloadTitle = '<script>window.__xss=1</script>';
  const payloadDescription = '"><img src=x onerror="window.__xss=1">';

  await register(page);
  await createListing(page, { title: payloadTitle, description: payloadDescription });

  // весь вывод должен идти через esc() — теги видны как текст, не как разметка
  await expect(page.locator('.card h3')).toHaveText(payloadTitle);
  await expect(page.locator('.card p')).toHaveText(payloadDescription);

  await openFirstListing(page);
  await expect(page.locator('#overlay-detail h2')).toHaveText(payloadTitle);
  await expect(page.locator('.detail-desc')).toHaveText(payloadDescription);

  const xssRan = await page.evaluate(() => window.__xss === 1);
  expect(alertFired, 'window.alert не должен был сработать').toBe(false);
  expect(xssRan, 'инъекция не должна была исполниться (onerror/script)').toBe(false);

  // и в самом DOM карточки не должно появиться настоящих исполняемых
  // элементов — только текстовые узлы с проэкранированным содержимым
  // (браузер сам нормализует "&quot;" обратно в текстовый "\"" при
  // сериализации innerHTML — это не инъекция, поэтому сравниваем DOM,
  // а не сырую строку разметки)
  await expect(page.locator('.card script')).toHaveCount(0);
  await expect(page.locator('.card img[onerror]')).toHaveCount(0);
});

test('3.13: подделка sl_session в localStorage авторизует под чужим именем без пароля', async ({ page }) => {
  await clearState(page);

  const victim = await register(page, { displayName: 'Жертва Подмены' });
  await logout(page);

  await register(page, { displayName: 'Атакующий' });

  // подменяем сессию на чужого пользователя напрямую через localStorage,
  // как описано в qa-spec.md 3.13 — без единого обращения к паролю
  await page.evaluate((username) => {
    localStorage.setItem('sl_session', JSON.stringify({ username }));
  }, victim.username);
  await page.reload();

  // задокументированное ограничение: приложение доверяет sl_session как
  // есть — вход происходит под именем жертвы без проверки пароля
  await expect(page.locator('.userbar b')).toHaveText(victim.displayName);
});
