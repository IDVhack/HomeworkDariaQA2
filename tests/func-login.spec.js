// qa-spec.md, раздел 1.2 — вход. Закрыты «пробелы» покрытия:
// 1.2.1 успешный вход → доска видна, sl_session содержит канонический username
// 1.2.2 неверный пароль → «Неверный пароль.»
// 1.2.3 несуществующий логин → «Такого логина нет…»
// 1.2.4 выход → sl_session удалён, показан экран входа
// 1.2.5 персистентность сессии: вход → reload → всё ещё авторизован
//
// Все тесты проверяют КОРРЕКТНОЕ ожидаемое поведение из qa-spec.md.
const { test, expect } = require('@playwright/test');
const { clearState, register, login, logout, uniqueUsername } = require('./helpers');

// Открыть вкладку «Войти», заполнить и отправить форму — без ожидания успеха
// (для негативных сценариев доска не появится).
async function attemptLogin(page, { username, password }) {
  const tab = page.getByRole('button', { name: 'Войти', exact: true }).first();
  if (await tab.count()) await tab.click();
  await page.locator('#form-login').waitFor();
  await page.locator('#form-login [name=username]').fill(username);
  await page.locator('#form-login [name=password]').fill(password);
  await page.locator('#form-login button[type=submit]').click();
}

test('1.2.1: успешный вход → доска видна, sl_session хранит канонический username', async ({ page }) => {
  await clearState(page);
  // регистрируем с заглавной буквой в логине, входим строчным — сессия
  // должна получить КАНОНИЧЕСКОЕ (сохранённое у пользователя) написание
  const canonical = uniqueUsername('Canon');
  await register(page, { username: canonical, password: 'goodpass1' });
  await logout(page);

  await login(page, { username: canonical.toLowerCase(), password: 'goodpass1' });

  await expect(page.getByRole('button', { name: '+ Разместить объявление' })).toBeVisible();

  const session = await page.evaluate(() => JSON.parse(localStorage.getItem('sl_session')));
  expect(session.username).toBe(canonical);
});

test('1.2.2: верный логин + неверный пароль → «Неверный пароль.»', async ({ page }) => {
  await clearState(page);
  const creds = await register(page, { username: uniqueUsername('wp'), password: 'goodpass1' });
  await logout(page);

  await attemptLogin(page, { username: creds.username, password: 'wrongpass9' });

  await expect(page.locator('#login-error')).toHaveText('Неверный пароль.');
  await expect(page.locator('#form-login')).toBeVisible();
});

test('1.2.3: несуществующий логин → «Такого логина нет…»', async ({ page }) => {
  await clearState(page);

  await attemptLogin(page, { username: uniqueUsername('ghost'), password: 'whatever1' });

  await expect(page.locator('#login-error')).toContainText('Такого логина нет');
  await expect(page.locator('#form-login')).toBeVisible();
});

test('1.2.4: выход очищает sl_session и возвращает экран входа', async ({ page }) => {
  await clearState(page);
  await register(page, { username: uniqueUsername('out') });

  await logout(page);

  const session = await page.evaluate(() => localStorage.getItem('sl_session'));
  expect(session).toBeNull();
  await expect(page.locator('#form-login, #form-register').first()).toBeVisible();
  await expect(page.getByRole('button', { name: '+ Разместить объявление' })).toHaveCount(0);
});

test('1.2.5: сессия персистентна — вход → reload → пользователь всё ещё авторизован', async ({ page }) => {
  await clearState(page);
  const creds = await register(page, { username: uniqueUsername('persist') });

  await page.reload();

  await expect(page.getByRole('button', { name: '+ Разместить объявление' })).toBeVisible();
  const session = await page.evaluate(() => JSON.parse(localStorage.getItem('sl_session')));
  expect(session.username).toBe(creds.username);
});
