// qa-spec.md, раздел 3 «Устойчивость к чужим/кривым данным».
// 3.1 — пустые/пробельные обязательные поля формы регистрации
//       (логин, пароль, имя, телефон — по одному и все сразу):
//       ни один вариант не создаёт пользователя. Пробельные имя/телефон
//       отсекает JS-проверка после .trim(); пробельный логин — нативный
//       pattern, короткий пробельный пароль — нативный minlength;
//       пустые поля — нативный required.
// 3.2 — пустой/пробельный заголовок и/или описание объявления:
//       объявление не создаётся (JS-проверка
//       `if(!item.title || !item.description) return;` ПОСЛЕ .trim(),
//       ДО closeAddModal()), модалка #overlay-add остаётся открытой.
//
// Ожидание по обоим рядам — GREEN: приложение уже фильтрует такие
// данные. Негативные формы регистрации заполняются напрямую (helper
// register() ждёт появления доски и на отказе завис бы).
const { test, expect } = require('@playwright/test');
const { clearState, register, logout, uniqueUsername } = require('./helpers');

// массив users из реально сохранённого состояния браузера
async function usersInState(page) {
  return page.evaluate(() => {
    try {
      const s = JSON.parse(localStorage.getItem('sl_state'));
      return (s && s.users) || [];
    } catch (e) {
      return [];
    }
  });
}
async function listingsInState(page) {
  return page.evaluate(() => {
    try {
      const s = JSON.parse(localStorage.getItem('sl_state'));
      return (s && s.listings) || [];
    } catch (e) {
      return [];
    }
  });
}

// заполнить #form-register по-полю и отправить, НЕ дожидаясь доски
async function submitRegister(page, fields) {
  const regTab = page.getByRole('button', { name: 'Регистрация' });
  if (await regTab.count()) await regTab.click();
  const set = async (name, value) => {
    const loc = page.locator(`#form-register [name=${name}]`);
    await loc.fill(value);
  };
  await set('username', fields.username ?? '');
  await set('password', fields.password ?? '');
  await set('password2', fields.password2 ?? fields.password ?? '');
  await set('displayName', fields.displayName ?? '');
  await set('phone', fields.phone ?? '');
  await page.locator('#form-register button[type=submit]').click();
}

const VALID = {
  username: 'goodlogin',
  password: 'goodpass1',
  displayName: 'Валидное Имя',
  phone: '+7 900 111-22-33',
};

// ------------------------------------------------------------------
// 3.1 — регистрация: пустые / пробельные обязательные поля
// ------------------------------------------------------------------

test.describe('3.1 пустые/пробельные обязательные поля регистрации', () => {
  test.beforeEach(async ({ page }) => {
    await clearState(page);
    // базовый валидный пользователь, чтобы проверять «users не вырос»
    await register(page, { username: uniqueUsername('base') });
    await logout(page);
  });

  test('все обязательные поля пустые → пользователь не создаётся', async ({ page }) => {
    const before = (await usersInState(page)).length;
    await submitRegister(page, { username: '', password: '', displayName: '', phone: '' });

    // остаёмся на экране авторизации, доски нет
    await expect(page.locator('#form-register')).toBeVisible();
    await expect(page.getByRole('button', { name: '+ Разместить объявление' })).toHaveCount(0);
    expect((await usersInState(page)).length).toBe(before);
  });

  test('все обязательные поля из пробелов → пользователь не создаётся', async ({ page }) => {
    const before = (await usersInState(page)).length;
    await submitRegister(page, { username: '   ', password: '    ', displayName: '   ', phone: '   ' });

    // пробельный username не проходит нативный pattern="[A-Za-z0-9_]{3,20}"
    // — constraint-валидация браузера блокирует отправку раньше JS-проверки
    await expect(page.locator('#form-register')).toBeVisible();
    await expect(page.getByRole('button', { name: '+ Разместить объявление' })).toHaveCount(0);
    expect((await usersInState(page)).length).toBe(before);
  });

  test('только логин из пробелов → отклонён, пользователь не создаётся', async ({ page }) => {
    const before = (await usersInState(page)).length;
    await submitRegister(page, { ...VALID, username: '   ' });

    // пробельный логин не проходит нативный pattern → форма не отправляется
    await expect(page.locator('#form-register')).toBeVisible();
    await expect(page.getByRole('button', { name: '+ Разместить объявление' })).toHaveCount(0);
    expect((await usersInState(page)).length).toBe(before);
  });

  test('только пароль из пробелов (короткий) → пользователь не создаётся', async ({ page }) => {
    const before = (await usersInState(page)).length;
    // 2 пробела: срабатывает нативный minlength="4" (или JS «Пароль слишком
    // короткий.»); в любом случае форма не сохраняется
    await submitRegister(page, { ...VALID, password: '  ', password2: '  ' });

    await expect(page.locator('#form-register')).toBeVisible();
    await expect(page.getByRole('button', { name: '+ Разместить объявление' })).toHaveCount(0);
    expect((await usersInState(page)).length).toBe(before);
  });

  test('только имя из пробелов → «Заполните имя и телефон.», пользователь не создаётся', async ({ page }) => {
    const before = (await usersInState(page)).length;
    await submitRegister(page, { ...VALID, username: 'namews', displayName: '   ' });

    await expect(page.locator('#register-error')).toHaveText('Заполните имя и телефон.');
    expect((await usersInState(page)).length).toBe(before);
  });

  test('только телефон из пробелов → «Заполните имя и телефон.», пользователь не создаётся', async ({ page }) => {
    const before = (await usersInState(page)).length;
    await submitRegister(page, { ...VALID, username: 'phonews', phone: '   ' });

    await expect(page.locator('#register-error')).toHaveText('Заполните имя и телефон.');
    expect((await usersInState(page)).length).toBe(before);
  });
});

// ------------------------------------------------------------------
// 3.2 — объявление: пустой / пробельный заголовок и/или описание
// ------------------------------------------------------------------

test.describe('3.2 пустые/пробельные обязательные поля объявления', () => {
  test.beforeEach(async ({ page }) => {
    await clearState(page);
    await register(page);
  });

  async function openAdd(page) {
    await page.getByRole('button', { name: '+ Разместить объявление' }).click();
    await page.locator('#form-add').waitFor();
    // цена обязательна нативно — заполняем валидным числом, чтобы дойти
    // до JS-проверки заголовка/описания
    await page.locator('#form-add [name=price]').fill('100');
  }

  test('заголовок и описание из пробелов → объявление не создаётся, модалка открыта', async ({ page }) => {
    await openAdd(page);
    await page.locator('#form-add [name=title]').fill('   ');
    await page.locator('#form-add [name=description]').fill('   ');
    await page.locator('#form-add button[type=submit]').click();

    await expect(page.locator('#overlay-add')).toBeVisible();
    await expect(page.locator('#overlay-add .modal')).toBeVisible();
    await expect(page.locator('.card')).toHaveCount(0);
    expect((await listingsInState(page)).length).toBe(0);
  });

  test('пробельный только заголовок → объявление не создаётся, модалка открыта', async ({ page }) => {
    await openAdd(page);
    await page.locator('#form-add [name=title]').fill('   ');
    await page.locator('#form-add [name=description]').fill('Нормальное описание');
    await page.locator('#form-add button[type=submit]').click();

    await expect(page.locator('#overlay-add .modal')).toBeVisible();
    await expect(page.locator('.card')).toHaveCount(0);
    expect((await listingsInState(page)).length).toBe(0);
  });

  test('пробельное только описание → объявление не создаётся, модалка открыта', async ({ page }) => {
    await openAdd(page);
    await page.locator('#form-add [name=title]').fill('Нормальный заголовок');
    await page.locator('#form-add [name=description]').fill('   ');
    await page.locator('#form-add button[type=submit]').click();

    await expect(page.locator('#overlay-add .modal')).toBeVisible();
    await expect(page.locator('.card')).toHaveCount(0);
    expect((await listingsInState(page)).length).toBe(0);
  });

  test('пустой заголовок (нативный required) → объявление не создаётся, модалка открыта', async ({ page }) => {
    await openAdd(page);
    await page.locator('#form-add [name=description]').fill('Описание без заголовка');
    await page.locator('#form-add button[type=submit]').click();

    await expect(page.locator('#overlay-add .modal')).toBeVisible();
    await expect(page.locator('.card')).toHaveCount(0);
    expect((await listingsInState(page)).length).toBe(0);
  });
});
