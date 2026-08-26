// Общие хелперы для Playwright-тестов «Свои люди».
// Все действия идут через реальный UI (клики/ввод), а не через прямые
// вызовы внутренних функций страницы — тесты проверяют то же, что видит
// живой пользователь.

let counter = 0;
function uniqueUsername(prefix) {
  counter += 1;
  return `${prefix}${Date.now().toString(36)}${counter}`;
}

async function clearState(page) {
  await page.goto('/index-local.html');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
}

async function register(page, { username, password = 'goodpass1', displayName, apt = '', phone } = {}) {
  const user = username || uniqueUsername('user');
  const name = displayName || `Тест ${user}`;
  const tel = phone || '+7 900 000-00-00';

  const registerTab = page.getByRole('button', { name: 'Регистрация' });
  if (await registerTab.count()) {
    await registerTab.click();
  }
  await page.locator('#form-register [name=username]').fill(user);
  await page.locator('#form-register [name=password]').fill(password);
  await page.locator('#form-register [name=password2]').fill(password);
  await page.locator('#form-register [name=displayName]').fill(name);
  if (apt) await page.locator('#form-register [name=apt]').fill(apt);
  await page.locator('#form-register [name=phone]').fill(tel);
  await page.locator('#form-register button[type=submit]').click();
  await page.getByRole('button', { name: '+ Разместить объявление' }).waitFor();

  return { username: user, password, displayName: name, phone: tel };
}

async function login(page, { username, password }) {
  const loginTab = page.getByRole('button', { name: 'Войти', exact: true }).first();
  if (await loginTab.count()) {
    await loginTab.click();
  }
  await page.locator('#form-login [name=username]').fill(username);
  await page.locator('#form-login [name=password]').fill(password);
  await page.locator('#form-login button[type=submit]').click();
  await page.getByRole('button', { name: '+ Разместить объявление' }).waitFor();
}

async function logout(page) {
  await page.getByRole('button', { name: 'Выйти' }).click();
  await page.locator('#form-login, #form-register').first().waitFor();
}

async function createListing(page, { title, price = '1000', description, category } = {}) {
  await page.getByRole('button', { name: '+ Разместить объявление' }).click();
  await page.locator('#form-add [name=title]').fill(title || `Объявление ${Date.now()}`);
  if (category) await page.locator('#form-add [name=category]').selectOption(category);
  await page.locator('#form-add [name=price]').fill(String(price));
  await page.locator('#form-add [name=description]').fill(description || 'Описание для теста');
  await page.locator('#form-add button[type=submit]').click();
  await page.locator('#overlay-add').waitFor({ state: 'hidden' });
}

async function openFirstListing(page) {
  await page.locator('[data-open]').first().click();
  await page.locator('#overlay-detail .modal').waitFor();
}

module.exports = {
  uniqueUsername,
  clearState,
  register,
  login,
  logout,
  createListing,
  openFirstListing,
};
