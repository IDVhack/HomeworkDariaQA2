// qa-spec.md, раздел 1 — сквозной сценарий: регистрация → объявление →
// бронь → раскрытие телефона.
const { test, expect } = require('@playwright/test');
const { clearState, register, login, logout, createListing, openFirstListing } = require('./helpers');

test('happy path: регистрация → объявление → бронь → раскрытие телефона (в обход Ф-1)', async ({ page }) => {
  await clearState(page);

  const author = await register(page, { displayName: 'Автор Тестов', phone: '+7 900 111-22-33' });
  await createListing(page, { title: 'Приготовлю борщ', price: '900', description: 'Вкусный борщ за 900 рублей' });

  await expect(page.locator('.card')).toHaveCount(1);
  await expect(page.locator('.status.open')).toBeVisible();

  await logout(page);

  const booker = await register(page, { displayName: 'Бронирующий Тест' });
  await openFirstListing(page);

  // до брони телефон не должен быть виден
  await expect(page.locator('.phone-reveal')).toHaveCount(0);

  await page.getByRole('button', { name: 'Забронировать' }).click();

  // Известный дефект Ф-1: сразу после брони render() пересобирает разметку
  // и overlay-detail снова получает класс hidden — модалка закрывается сама.
  // Здесь мы сознательно обходим Ф-1 (переоткрываем модалку по карточке),
  // чтобы проверить остальную часть сценария. Честный красный сигнал на
  // сам баг Ф-1 — в отдельном тесте ниже, его трогать нельзя.
  await openFirstListing(page);

  await expect(page.locator('.phone-reveal .num')).toHaveText(author.phone);
  await expect(page.getByRole('link', { name: 'Позвонить' })).toHaveAttribute(
    'href',
    `tel:${author.phone.replace(/[^+\d]/g, '')}`
  );

  await page.reload();
  await expect(page.locator('.status.booked')).toContainText(booker.displayName);
});

// Выделенный красный тест под сам баг Ф-1. Документирует НЕ исправленный в
// коде приложения дефект: overlay-detail получает класс hidden сам сразу
// после клика «Забронировать» вместо того, чтобы остаться открытым с
// раскрытым телефоном. Тест ОБЯЗАН честно падать на проверке видимости
// #overlay-detail — это регрессионный сигнал на нефикшеный баг. Его нельзя
// «чинить» переоткрытием модалки в обход бага: как только Ф-1 будет
// исправлен в приложении, этот тест позеленеет сам.
test('Ф-1: модалка деталей остаётся открытой после брони (баг, ожидаемо красный)', async ({ page }) => {
  await clearState(page);

  await register(page, { displayName: 'Автор Ф1', phone: '+7 900 111-22-33' });
  await createListing(page, { title: 'Объявление Ф-1', price: '500', description: 'Проверка Ф-1' });

  await logout(page);

  await register(page, { displayName: 'Бронирующий Ф1' });
  await openFirstListing(page);

  await page.getByRole('button', { name: 'Забронировать' }).click();

  await expect(page.locator('#overlay-detail')).toBeVisible();
});
