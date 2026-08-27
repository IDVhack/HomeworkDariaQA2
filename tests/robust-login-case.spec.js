// qa-spec.md, раздел 3 «Устойчивость к чужим/кривым данным».
// 3.6 — совпадающий логин в разном регистре: регистрируем Ivan82,
//       выходим, пробуем зарегистрировать ivan82 и IVAN82 →
//       оба отклоняются с «Этот логин уже занят.» (findUser сравнивает
//       по toLowerCase()). Ожидание — GREEN.
// 3.7 — вход с другим регистром логина: регистрируем Ivan82, выходим,
//       входим как ivan82 → вход успешен, И sl_session.username содержит
//       КАНОНИЧЕСКИЙ Ivan82 (login-хендлер делает session =
//       {username: user.username}). Затем создаём объявление и
//       проверяем, что владение не сломано: автор === Ivan82, кнопка
//       «Удалить объявление» видна в своей карточке. Ожидание — GREEN.
const { test, expect } = require('@playwright/test');
const { clearState, register, login, logout, createListing } = require('./helpers');

const CANON = 'Ivan82';

async function usersInState(page) {
  return page.evaluate(() => {
    try {
      return (JSON.parse(localStorage.getItem('sl_state')) || {}).users || [];
    } catch (e) {
      return [];
    }
  });
}

// заполнить #form-register и отправить, НЕ дожидаясь доски (для отказных кейсов)
async function submitRegister(page, { username, password = 'goodpass1', displayName = 'Иван', phone = '+7 900 000-00-00' }) {
  const regTab = page.getByRole('button', { name: 'Регистрация' });
  if (await regTab.count()) await regTab.click();
  await page.locator('#form-register [name=username]').fill(username);
  await page.locator('#form-register [name=password]').fill(password);
  await page.locator('#form-register [name=password2]').fill(password);
  await page.locator('#form-register [name=displayName]').fill(displayName);
  await page.locator('#form-register [name=phone]').fill(phone);
  await page.locator('#form-register button[type=submit]').click();
}

// ------------------------------------------------------------------
// 3.6 — тот же логин в другом регистре при регистрации
// ------------------------------------------------------------------

test.describe('3.6 совпадающий логин в разном регистре — регистрация отклоняется', () => {
  test.beforeEach(async ({ page }) => {
    await clearState(page);
    await register(page, { username: CANON, displayName: 'Иван Первый', phone: '+7 900 100-20-30' });
    await logout(page);
  });

  test('регистрация «ivan82» (нижний регистр) → «Этот логин уже занят.»', async ({ page }) => {
    await submitRegister(page, { username: 'ivan82' });

    await expect(page.locator('#register-error')).toHaveText('Этот логин уже занят.');
    await expect(page.getByRole('button', { name: '+ Разместить объявление' })).toHaveCount(0);
    expect((await usersInState(page)).length).toBe(1);
  });

  test('регистрация «IVAN82» (верхний регистр) → «Этот логин уже занят.»', async ({ page }) => {
    await submitRegister(page, { username: 'IVAN82' });

    await expect(page.locator('#register-error')).toHaveText('Этот логин уже занят.');
    await expect(page.getByRole('button', { name: '+ Разместить объявление' })).toHaveCount(0);
    expect((await usersInState(page)).length).toBe(1);
  });
});

// ------------------------------------------------------------------
// 3.7 — вход другим регистром: сессия канонизируется, владение цело
// ------------------------------------------------------------------

test('3.7: вход как «ivan82» проходит, sl_session хранит канонический «Ivan82», владение не сломано', async ({ page }) => {
  await clearState(page);
  await register(page, { username: CANON, displayName: 'Иван Владелец', phone: '+7 900 111-22-33' });
  await logout(page);

  // вход введённым в другом регистре логином — helper login() дождётся
  // доски, т.е. вход должен быть успешным
  await login(page, { username: 'ivan82', password: 'goodpass1' });

  const session = await page.evaluate(() => {
    try {
      return JSON.parse(localStorage.getItem('sl_session'));
    } catch (e) {
      return null;
    }
  });
  expect(session).toEqual({ username: CANON });

  // создаём объявление и проверяем, что права владельца считаются по
  // каноническому username
  await createListing(page, { title: 'Объявление владельца Ivan82' });

  // в своей карточке есть бейдж «Вы»
  await expect(page.locator('.card .you-badge')).toBeVisible();

  // автор в состоянии — именно канонический Ivan82
  const authors = await page.evaluate(() => {
    try {
      return (JSON.parse(localStorage.getItem('sl_state')) || {}).listings.map((l) => l.authorUsername);
    } catch (e) {
      return [];
    }
  });
  expect(authors).toEqual([CANON]);

  // в детальной модалке своей карточки видна кнопка удаления
  await page.locator('.card[data-open]').first().click();
  await page.locator('#overlay-detail .modal').waitFor();
  await expect(page.locator('#delete-listing')).toBeVisible();
});
