// qa-spec.md, раздел 1.1 — регистрация. Здесь закрыты «пробелы» покрытия:
// 1.1.2 логин уже занят
// 1.1.3 недопустимый логин (кириллица/пробел/спецсимвол/<3/>20)
// 1.1.4 пароли не совпадают
// 1.1.5 короткий пароль (<4)
// 1.1.6 пустые/пробельные имя или телефон
// 1.1.7 квартира необязательна
// Успешная регистрация (1.1.1) и happy path — в tests/functional-flow.spec.js,
// здесь не дублируются.
//
// Все тесты проверяют КОРРЕКТНОЕ ожидаемое поведение из qa-spec.md.
// Порядок JS-проверок в обработчике #form-register:
//   regex логина → занят → пароль<4 → пароли не совпадают → !имя||!телефон.
const { test, expect } = require('@playwright/test');
const { clearState, register, logout, uniqueUsername } = require('./helpers');

// Заполнить и отправить форму регистрации. По умолчанию все поля валидны —
// в конкретном тесте переопределяется только проверяемое поле.
// bypassNative=true снимает нативную HTML5-валидацию (pattern/minlength),
// чтобы добраться до JS-проверки приложения, которую документирует qa-spec.
async function submitRegister(page, fields = {}, { bypassNative = false } = {}) {
  const f = {
    username: uniqueUsername('ok'),
    password: 'goodpass1',
    password2: 'goodpass1',
    displayName: 'Тест Имя',
    apt: '',
    phone: '+7 900 000-00-00',
    ...fields,
  };
  const tab = page.getByRole('button', { name: 'Регистрация' });
  if (await tab.count()) await tab.click();
  await page.locator('#form-register').waitFor();

  await page.locator('#form-register [name=username]').fill(f.username);
  await page.locator('#form-register [name=password]').fill(f.password);
  await page.locator('#form-register [name=password2]').fill(f.password2);
  await page.locator('#form-register [name=displayName]').fill(f.displayName);
  await page.locator('#form-register [name=apt]').fill(f.apt);
  await page.locator('#form-register [name=phone]').fill(f.phone);

  if (bypassNative) {
    await page.locator('#form-register').evaluate((el) => { el.noValidate = true; });
  }
  await page.locator('#form-register button[type=submit]').click();
}

async function readState(page) {
  return page.evaluate(() => {
    const raw = localStorage.getItem('sl_state');
    return raw ? JSON.parse(raw) : null;
  });
}

test('1.1.2: повторная регистрация с занятым логином → ошибка, аккаунт не создаётся', async ({ page }) => {
  await clearState(page);
  const login = uniqueUsername('ivan');

  await register(page, { username: login });
  await logout(page);

  await submitRegister(page, { username: login });

  await expect(page.locator('#register-error')).toHaveText('Этот логин уже занят.');
  await expect(page.locator('#form-register')).toBeVisible();

  // после первой (успешной) регистрации в sl_state ровно один пользователь —
  // вторая попытка ничего не добавила
  const state = await readState(page);
  expect(state.users).toHaveLength(1);
  expect(state.users[0].username).toBe(login);
});

test('1.1.3: недопустимый логин → ошибка валидации логина, аккаунт не создаётся', async ({ page }) => {
  // кириллица / пробел / спецсимвол / короче 3 / длиннее 20 символов —
  // JS-регэксп /^[A-Za-z0-9_]{3,20}$/ отклоняет каждый вариант.
  const badLogins = ['иванов', 'iv an', 'iv@n', 'ab', 'a'.repeat(21)];

  for (const bad of badLogins) {
    await clearState(page);
    await submitRegister(page, { username: bad }, { bypassNative: true });

    await expect(
      page.locator('#register-error'),
      `логин ${JSON.stringify(bad)} должен быть отклонён`
    ).toHaveText('Логин: 3–20 символов, латиница/цифры/подчёркивание.');

    // сохранения не было вообще
    expect(await readState(page)).toBeNull();
  }
});

test('1.1.4: пароль и повтор различаются → «Пароли не совпадают.»', async ({ page }) => {
  await clearState(page);
  // логин валиден, пароль ≥4 — нативную валидацию проходит, ловит JS-проверка
  await submitRegister(page, { password: 'goodpass1', password2: 'goodpass2' });

  await expect(page.locator('#register-error')).toHaveText('Пароли не совпадают.');
  expect(await readState(page)).toBeNull();
});

test('1.1.5: короткий пароль блокируется нативной валидацией minlength, аккаунт не создаётся', async ({ page }) => {
  await clearState(page);
  await submitRegister(page, { password: 'abc', password2: 'abc' });

  // minlength="4" не даёт форме отправиться — остаёмся на форме регистрации,
  // ничего не сохранено
  await expect(page.locator('#form-register')).toBeVisible();
  expect(await readState(page)).toBeNull();
});

test('1.1.5: короткий пароль в обход нативной валидации → «Пароль слишком короткий.»', async ({ page }) => {
  await clearState(page);
  await submitRegister(page, { password: 'abc', password2: 'abc' }, { bypassNative: true });

  await expect(page.locator('#register-error')).toHaveText('Пароль слишком короткий.');
  expect(await readState(page)).toBeNull();
});

test('1.1.6: пробельное имя → «Заполните имя и телефон.», аккаунт не создаётся', async ({ page }) => {
  await clearState(page);
  // только пробелы — нативный required проходит (значение непустое),
  // JS-проверка после trim() ловит
  await submitRegister(page, { displayName: '   ' });

  await expect(page.locator('#register-error')).toHaveText('Заполните имя и телефон.');
  expect(await readState(page)).toBeNull();
});

test('1.1.6: пробельный телефон → «Заполните имя и телефон.», аккаунт не создаётся', async ({ page }) => {
  await clearState(page);
  await submitRegister(page, { displayName: 'Нормальное Имя', phone: '   ' });

  await expect(page.locator('#register-error')).toHaveText('Заполните имя и телефон.');
  expect(await readState(page)).toBeNull();
});

test('1.1.7: регистрация без квартиры проходит успешно', async ({ page }) => {
  await clearState(page);
  const login = uniqueUsername('noapt');

  // register() из helpers не заполняет apt
  await register(page, { username: login });

  await expect(page.getByRole('button', { name: '+ Разместить объявление' })).toBeVisible();

  const state = await readState(page);
  expect(state.users).toHaveLength(1);
  expect(state.users[0].username).toBe(login);
  expect(state.users[0].apt).toBe('');
});
