// qa-spec.md, раздел 4 — регрессионные тесты на два дефекта, найденные
// при нагрузочном тестировании (qa-report-volume.md):
//   1) поиск не имеет debounce и деградирует на большом списке;
//   2) при переполнении localStorage тост врёт об успехе, а данные тихо
//      теряются.
// Эти тесты пишут ПРАВИЛЬНОЕ ожидаемое поведение. Если баги всё ещё
// в коде — тесты обязаны падать. Это ожидаемо, красный — не повод
// подгонять ассерт под текущее поведение.
const { test, expect } = require('@playwright/test');
const { clearState } = require('./helpers');

async function seedListings(page, { users = 60, listings = 350 } = {}) {
  await page.evaluate(
    ({ users, listings }) => {
      const CATS = ['food', 'cleaning', 'repair', 'transport', 'pets', 'other'];
      const usersArr = [];
      for (let i = 0; i < users; i++) {
        usersArr.push({
          username: 'user' + i,
          salt: 'fakesalt' + i,
          hash: 'fakehash' + i,
          displayName: 'Сосед №' + i,
          apt: String((i % 50) + 1),
          phone: '+7 900 ' + String(100 + i).padStart(3, '0') + '-00-00',
          createdAt: new Date(Date.now() - i * 60000).toISOString(),
        });
      }
      const listingsArr = [];
      for (let j = 0; j < listings; j++) {
        const author = usersArr[j % usersArr.length];
        listingsArr.push({
          id: 'l_seed_' + j,
          title: 'Объявление №' + j + ' - ' + CATS[j % CATS.length],
          category: CATS[j % CATS.length],
          price: (j % 50) * 37,
          description: 'Подробное описание объявления номер ' + j + '. '.repeat(3),
          authorUsername: author.username,
          status: 'open',
          bookedBy: null,
          createdAt: new Date(Date.now() - j * 1000).toISOString(),
        });
      }
      localStorage.setItem('sl_state', JSON.stringify({ users: usersArr, listings: listingsArr }));
      localStorage.setItem('sl_session', JSON.stringify({ username: 'user0' }));
    },
    { users, listings }
  );
  await page.reload();
}

test('поиск не деградирует на большом списке (debounce)', async ({ page }) => {
  await clearState(page);
  await seedListings(page, { users: 60, listings: 350 });

  const search = page.locator('#search');
  const elapsed = await search.evaluate((el) => {
    const t0 = performance.now();
    el.value = 'О';
    el.dispatchEvent(new Event('input', { bubbles: true }));
    return performance.now() - t0;
  });

  // без debounce обработчик input пересобирает всю доску синхронно;
  // ожидаем, что один символ обрабатывается быстро (порог ниже реально
  // наблюдавшихся 130-290 мс) — сейчас этот порог не соблюдается
  expect(elapsed, `рендер после одного нажатия занял ${elapsed.toFixed(1)} мс`).toBeLessThan(50);
});

test('переполнение localStorage: тост не должен врать об успехе', async ({ page }) => {
  await clearState(page);
  await seedListings(page, { users: 10, listings: 20 });

  // забиваем localStorage вплотную к реальной квоте origin'а
  await page.evaluate(() => {
    const chunk1MB = 'x'.repeat(1024 * 1024);
    for (let i = 0; i < 500; i++) {
      try {
        localStorage.setItem('__fillMB' + i, chunk1MB);
      } catch (e) {
        break;
      }
    }
    const chunk1KB = 'x'.repeat(1024);
    for (let i = 0; i < 5000; i++) {
      try {
        localStorage.setItem('__fillKB' + i, chunk1KB);
      } catch (e) {
        break;
      }
    }
    const chunk10B = 'x'.repeat(10);
    for (let i = 0; i < 200000; i++) {
      try {
        localStorage.setItem('__fillB' + i, chunk10B);
      } catch (e) {
        break;
      }
    }
  });

  const stateBefore = await page.evaluate(() => localStorage.getItem('sl_state'));

  await page.getByRole('button', { name: '+ Разместить объявление' }).click();
  await page.locator('#form-add [name=title]').fill('Quota overflow regression test');
  await page.locator('#form-add [name=price]').fill('1');
  await page.locator('#form-add [name=description]').fill('desc');
  await page.locator('#form-add button[type=submit]').click();

  const toast = page.locator('#toast');
  await expect(toast).toHaveText('Объявление размещено');

  const stateAfter = await page.evaluate(() => localStorage.getItem('sl_state'));
  const actuallyPersisted = stateAfter !== stateBefore;

  // если тост сказал "успех", данные обязаны реально сохраниться —
  // сейчас localStorage.setItem падает молча и это не так
  expect(actuallyPersisted, 'тост показал успех, но состояние в localStorage не изменилось').toBe(true);
});
