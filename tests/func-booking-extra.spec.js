// qa-spec.md, раздел 1.4 — бронирование и раскрытие телефона. Закрыты
// «пробелы» покрытия:
// 1.4.3 «Скопировать номер»: клик по #copy-phone → номер в буфере обмена
//       (или, при недоступности Clipboard API, показывается тостом)
// 1.4.5 видимость телефона третьему лицу (посторонний открывает
//       забронированное объявление)
// Успешная бронь, tel:-ссылка, бейдж «Забронировано» после reload (1.4.1/1.4.2/
// 1.4.4) — в tests/functional-flow.spec.js, не дублируются.
//
// Про Ф-1: сразу после клика «Забронировать» render() пересобирает разметку и
// #overlay-detail снова получает класс hidden (задокументированный дефект,
// красный тест на него — в functional-flow.spec.js). Здесь мы сознательно
// переоткрываем модалку по карточке, чтобы проверить назначенную строку.
const { test, expect } = require('@playwright/test');
const { clearState, register, logout, createListing, openFirstListing } = require('./helpers');

test('1.4.3: «Скопировать номер» кладёт номер в буфер обмена (или показывает тостом)', async ({ page, context }) => {
  // в headless Chromium доступ к буферу возможен только с явно выданными
  // разрешениями; если writeText всё же недоступен/отклонён — приложение
  // обязано показать номер тостом. Тест зелёный на обоих путях.
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await clearState(page);

  const author = await register(page, { displayName: 'Автор Копир', phone: '+7 900 123-45-67' });
  await createListing(page, { title: 'Копирование номера', description: 'проверка #copy-phone' });
  await logout(page);

  await register(page, { displayName: 'Букер Копир' });
  await openFirstListing(page);
  await page.getByRole('button', { name: 'Забронировать' }).click();

  // обход Ф-1: переоткрываем модалку деталей
  await openFirstListing(page);
  await expect(page.locator('.phone-reveal .num')).toHaveText(author.phone);

  await page.locator('#copy-phone').click();
  await expect(page.locator('#toast')).toHaveClass(/show/);
  const toastText = (await page.locator('#toast').textContent()).trim();

  if (toastText === 'Номер скопирован') {
    // путь A: Clipboard API сработал — номер реально в буфере
    const clip = await page.evaluate(() => navigator.clipboard.readText());
    expect(clip).toBe(author.phone);
  } else {
    // путь B: Clipboard API недоступен/отклонён — номер показан прямо тостом
    expect(toastText).toBe(author.phone);
  }
});

test('1.4.5: посторонний видит телефон автора у забронированного объявления', async ({ page }) => {
  await clearState(page);

  const author = await register(page, { displayName: 'Автор Третий', phone: '+7 900 999-88-77' });
  await createListing(page, { title: 'Видимость телефона третьему', description: 'проверка 1.4.5' });
  await logout(page);

  await register(page, { displayName: 'Букер' });
  await openFirstListing(page);
  await page.getByRole('button', { name: 'Забронировать' }).click();
  await logout(page);

  // третий пользователь — НЕ автор и НЕ бронировавший
  await register(page, { displayName: 'Посторонний Зритель' });
  await openFirstListing(page);

  // qa-spec.md 1.4.5: renderDetail() рендерит блок .phone-reveal ВСЕМ, как
  // только item.status === 'booked', без проверки isAuthor/isBooker для
  // самого блока (проверка есть только у кнопки «Отменить бронь» внутри).
  // Тест ФИКСИРУЕТ этот факт — «телефон виден всем». Это открытый вопрос
  // приватности к продукту (задокументирован в qa-spec.md как нерешённый),
  // а НЕ баг с зелёным/красным сигналом: решение «дефект это или задумано»
  // не принято, тест лишь не даёт поведению молча измениться.
  await expect(page.locator('.phone-reveal')).toBeVisible();
  await expect(page.locator('.phone-reveal .num')).toHaveText(author.phone);

  // при этом отменить чужую бронь посторонний не может (это уже 1.5.5)
  await expect(page.getByRole('button', { name: 'Отменить бронь' })).toHaveCount(0);
});
