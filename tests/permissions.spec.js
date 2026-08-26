// qa-spec.md, раздел 1.5 — права на удаление/отмену брони строго по логину.
const { test, expect } = require('@playwright/test');
const {
  clearState,
  register,
  login,
  logout,
  createListing,
  openFirstListing,
  uniqueUsername,
} = require('./helpers');

test('автор может удалить своё объявление', async ({ page }) => {
  await clearState(page);
  await register(page);
  await createListing(page, { title: 'Моё объявление на удаление' });
  await openFirstListing(page);

  await expect(page.getByRole('button', { name: 'Удалить объявление' })).toBeVisible();
  await page.getByRole('button', { name: 'Удалить объявление' }).click();

  await expect(page.locator('.card')).toHaveCount(0);
});

test('чужой пользователь не видит кнопку удаления', async ({ page }) => {
  await clearState(page);
  await register(page);
  await createListing(page, { title: 'Чужое объявление' });
  await logout(page);

  await register(page);
  await openFirstListing(page);

  await expect(page.getByRole('button', { name: 'Удалить объявление' })).toHaveCount(0);
});

test('автор может отменить бронь на своём объявлении', async ({ page }) => {
  await clearState(page);
  const author = await register(page);
  await createListing(page, { title: 'Объявление для отмены брони автором' });
  await logout(page);

  await register(page);
  await openFirstListing(page);
  await page.getByRole('button', { name: 'Забронировать' }).click();
  await logout(page);

  await login(page, author);
  await openFirstListing(page);

  await expect(page.getByRole('button', { name: 'Отменить бронь' })).toBeVisible();
  await page.getByRole('button', { name: 'Отменить бронь' }).click();

  await page.reload();
  await expect(page.locator('.status.open')).toBeVisible();
});

test('забронировавший может отменить свою бронь', async ({ page }) => {
  await clearState(page);
  await register(page);
  await createListing(page, { title: 'Объявление для отмены брони бронирующим' });
  await logout(page);

  const booker = await register(page);
  await openFirstListing(page);
  await page.getByRole('button', { name: 'Забронировать' }).click();
  await logout(page);

  await login(page, booker);
  await openFirstListing(page);

  await expect(page.getByRole('button', { name: 'Отменить бронь' })).toBeVisible();
});

test('посторонний пользователь не видит кнопку отмены брони', async ({ page }) => {
  await clearState(page);
  await register(page);
  await createListing(page, { title: 'Объявление для проверки постороннего' });
  await logout(page);

  await register(page);
  await openFirstListing(page);
  await page.getByRole('button', { name: 'Забронировать' }).click();
  await logout(page);

  await register(page); // третий, посторонний пользователь
  await openFirstListing(page);

  await expect(page.getByRole('button', { name: 'Отменить бронь' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Удалить объявление' })).toHaveCount(0);
});

test('право проверяется по username, а не по отображаемому имени', async ({ page }) => {
  await clearState(page);
  await register(page);
  await createListing(page, { title: 'Проверка прав по логину, не по имени' });
  await logout(page);

  const sharedDisplayName = 'Клон-Тест';
  const twinA = { username: uniqueUsername('twina'), password: 'goodpass1', displayName: sharedDisplayName };
  await register(page, twinA);
  await openFirstListing(page);
  await page.getByRole('button', { name: 'Забронировать' }).click();
  await logout(page);

  const twinB = { username: uniqueUsername('twinb'), password: 'goodpass1', displayName: sharedDisplayName };
  await register(page, twinB);
  await openFirstListing(page);

  // twinB не бронировал — несмотря на совпадающее displayName с twinA,
  // кнопки отмены брони быть не должно
  await expect(page.getByRole('button', { name: 'Отменить бронь' })).toHaveCount(0);
});
