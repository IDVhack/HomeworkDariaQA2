// qa-spec.md, раздел 3 — обход клиентских проверок в приложении без сервера.
// 3.4  — обход валидации цены (отрицательное / нечисловое значение,
//        подставленное мимо нативной валидации поля);
// 3.9  — самобронирование в обход UI (кнопка брони автору не рендерится,
//        но прямая запись в state этим не защищена);
// 3.10 — гонка записи: два «одновременных» бронирования одного объявления
//        разрешаются последним успешным сохранением, ранняя бронь молча
//        теряется.
//
// Все три пункта в qa-spec.md отмечены как ПРИНЯТЫЕ архитектурные
// ограничения локального прототипа (нет сервера → все проверки прав
// в клиентском JS и обходимы; гонки разрешаются last-write-wins без
// блокировок/транзакций — см. «Известные ограничения архитектуры»).
// Поэтому тесты СТРОЯТСЯ ЗЕЛЁНЫМИ и фиксируют фактическое поведение —
// по образцу tests/security.spec.js для 3.13, а не как красный сигнал
// о баге и не в расчёте на «правильное» поведение, которого в коде нет.
const { test, expect } = require('@playwright/test');
const { clearState, register, createListing, openFirstListing } = require('./helpers');

// ------------------------------------------------------------------
// 3.4 — обход валидации цены
// ------------------------------------------------------------------

test('3.4: отрицательная цена мимо нативной валидации попадает в состояние как есть', async ({ page }) => {
  await clearState(page);
  await register(page);

  // поле price имеет type="number" min="0" — нативная валидация браузера
  // блокирует обычную отправку. Обходим ровно так, как описано в
  // qa-spec.md 3.4: подставляем значение и дёргаем submit напрямую
  // через dispatchEvent, минуя constraint validation.
  await page.getByRole('button', { name: '+ Разместить объявление' }).click();
  await page.locator('#form-add [name=title]').fill('Отрицательная цена в обход UI');
  await page.locator('#form-add [name=description]').fill('минус пятьсот рублей');
  await page.locator('#form-add [name=price]').evaluate((el) => { el.value = '-500'; });
  await page.locator('#form-add').dispatchEvent('submit');

  // задокументированное ограничение: save() берёт Number(fd.get('price'))
  // как есть, без Math.max(0, …) и без server-side проверки — карточка
  // создаётся с отрицательной ценой, приложение не падает и не
  // подрезает значение к нулю
  await expect(page.locator('.card')).toHaveCount(1);
  await expect(page.locator('.card .price')).toHaveText('-500 ₽');

  // и после перезагрузки (значение реально ушло в localStorage) цена
  // всё та же — никакой отложенной санитизации нет
  await page.reload();
  await expect(page.locator('.card .price')).toHaveText('-500 ₽');
});

test('3.4: нечисловая цена не отклоняется — молча становится NaN → «0 ₽»', async ({ page }) => {
  await clearState(page);
  await register(page);

  await page.getByRole('button', { name: '+ Разместить объявление' }).click();
  await page.locator('#form-add [name=title]').fill('Нечисловая цена в обход UI');
  await page.locator('#form-add [name=description]').fill('цена прописью');
  // снимаем type="number", чтобы в поле реально прошла нечисловая строка
  // (как paste в qa-spec.md 3.4), и отправляем мимо валидации
  await page.locator('#form-add [name=price]').evaluate((el) => { el.type = 'text'; el.value = 'abc'; });
  await page.locator('#form-add').dispatchEvent('submit');

  // задокументированное ограничение: Number('abc') === NaN, проверки
  // !item.title || !item.description это не ловит (цена в ней не
  // участвует) — объявление создаётся. fmtPrice() приводит NaN → 0,
  // после сохранения в localStorage NaN сериализуется в null.
  // Пользователю показывается «0 ₽», ошибки валидации нет.
  await expect(page.locator('.card')).toHaveCount(1);
  await expect(page.locator('.card .price')).toHaveText('0 ₽');

  await page.reload();
  await expect(page.locator('.card .price')).toHaveText('0 ₽');
});

// ------------------------------------------------------------------
// 3.9 — самобронирование в обход UI
// ------------------------------------------------------------------

test('3.9: автор бронирует своё же объявление прямой записью в state', async ({ page }) => {
  await clearState(page);
  const author = await register(page, { displayName: 'Автор И Букер', phone: '+7 900 555-11-22' });
  await createListing(page, { title: 'Самобронь в обход UI' });

  const id = await page.locator('.card').first().getAttribute('data-open');

  // в UI кнопки «Забронировать» для автора нет вовсе (renderDetail:
  // ветка isAuthor не рендерит #do-book). Но это единственная защита —
  // прямая запись брони с bookedBy.username === authorUsername ничем
  // не проверяется (нет server-side и нет повторной проверки в коде).
  await page.evaluate(({ id, author }) => {
    const s = JSON.parse(localStorage.getItem('sl_state'));
    s.listings = s.listings.map((x) =>
      x.id === id
        ? {
            ...x,
            status: 'booked',
            bookedBy: {
              username: author.username,
              displayName: author.displayName,
              apt: '',
              at: new Date().toISOString(),
            },
          }
        : x
    );
    localStorage.setItem('sl_state', JSON.stringify(s));
  }, { id, author });
  await page.reload();

  // задокументированное ограничение: приложение доверяет state как есть —
  // объявление отображается забронированным на самого автора, интерфейс
  // не падает и не «чинит» некорректную бронь
  await expect(page.locator('.status.booked')).toContainText(author.displayName);

  await openFirstListing(page);
  await expect(page.locator('.phone-reveal')).toBeVisible();
  // телефон автора «раскрыт» ему же — самобронь прошла полноценно
  await expect(page.locator('.phone-reveal .num')).toHaveText(author.phone);
});

// ------------------------------------------------------------------
// 3.10 — гонка записи (двойное бронирование)
// ------------------------------------------------------------------

test('3.10: два «одновременных» бронирования — побеждает последняя запись, ранняя молча теряется', async ({ page }) => {
  await clearState(page);
  await register(page, { displayName: 'Автор Объявления', phone: '+7 900 777-33-44' });
  await createListing(page, { title: 'Объявление под гонку брони' });

  const id = await page.locator('.card').first().getAttribute('data-open');

  // эмулируем две вкладки под разными пользователями: обе прочитали
  // ОДНО И ТО ЖЕ базовое состояние (свободное объявление) и сохраняют
  // свою бронь почти одновременно. Сервера нет → нет ни блокировки, ни
  // обнаружения конфликта, ни слияния — просто два setItem подряд.
  await page.evaluate((id) => {
    const base = JSON.parse(localStorage.getItem('sl_state'));
    const bookAs = (name) => {
      const s = JSON.parse(JSON.stringify(base));
      s.listings = s.listings.map((x) =>
        x.id === id
          ? { ...x, status: 'booked', bookedBy: { username: name, displayName: name, apt: '', at: new Date().toISOString() } }
          : x
      );
      return s;
    };
    localStorage.setItem('sl_state', JSON.stringify(bookAs('Букер Первый'))); // применилось первым
    localStorage.setItem('sl_state', JSON.stringify(bookAs('Букер Второй'))); // применилось последним — перезаписывает
  }, id);
  await page.reload();

  // задокументированное поведение (qa-spec.md 3.10 + «Известные
  // ограничения»): last-write-wins. В состоянии остаётся только вторая
  // бронь, первая исчезает без следа и без предупреждения.
  await expect(page.locator('.card')).toHaveCount(1);
  await expect(page.locator('.status.booked')).toContainText('Букер Второй');
  await expect(page.locator('.status.booked')).not.toContainText('Букер Первый');

  await openFirstListing(page);
  await expect(page.locator('.phone-reveal')).toContainText('Букер Второй');
  await expect(page.locator('.phone-reveal')).not.toContainText('Букер Первый');
});
