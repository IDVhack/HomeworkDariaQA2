// qa-spec.md, раздел 4 — регрессионные тесты на дефекты, найденные при
// нагрузочном тестировании (qa-report-volume.md):
//   1) поиск не имеет debounce и деградирует на большом списке —
//      всё ещё не исправлено, тест обязан падать;
//   2) переполнение localStorage (qa-spec.md 4.6-4.8) — исправлено в
//      qa-runs/2026-08-27_02-54-04/: тост больше не врёт об успехе,
//      данные при реально исчерпанной квоте честно не сохраняются, и
//      (после дополнительной находки независимого QA-ревью) на экране
//      больше не появляется фантомная карточка несохранённого
//      объявления. Тест теперь проверяет это ПРАВИЛЬНОЕ поведение как
//      регресс-тест, а не ловит баг.
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
  await seedListings(page, { users: 60, listings: 500 });

  await page.locator('#search').waitFor();
  // Один сэмпл шумит: на быстрой машине единичное нажатие случайно
  // проскакивает под порог (или ловит race с ранним выходом render()),
  // из-за чего npm test плавал 14/12 ↔ 15/11. Берём медиану из 10
  // нажатий по списку в 500 объявлений — систематическая стоимость
  // синхронного render() без debounce перекрывает разброс.
  // Важно: render() каждый раз пересоздаёт #search, поэтому ноду берём
  // из DOM заново на каждой итерации, а не держим старую ссылку.
  const median = await page.evaluate(() => {
    const CHARS = 'оеаниропдл'; // частые буквы: каждый запрос матчит почти всё → полная пересборка доски
    const samples = [];
    for (let i = 0; i < 10; i++) {
      const el = document.getElementById('search');
      const t0 = performance.now();
      el.value = CHARS[i % CHARS.length];
      el.dispatchEvent(new Event('input', { bubbles: true }));
      samples.push(performance.now() - t0);
    }
    samples.sort((a, b) => a - b);
    return (samples[4] + samples[5]) / 2;
  });

  // без debounce обработчик input пересобирает всю доску синхронно;
  // ожидаем, что нажатие обрабатывается быстро (порог ниже реально
  // наблюдавшихся 130-290 мс) — сейчас этот порог не соблюдается
  expect(median, `медианный рендер после нажатия занял ${median.toFixed(1)} мс`).toBeLessThan(50);
});

test('переполнение localStorage: честная ошибка, без фантомной карточки и без тихой потери данных', async ({ page }) => {
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
  const titleText = 'Quota overflow regression test';

  await page.getByRole('button', { name: '+ Разместить объявление' }).click();
  await page.locator('#form-add [name=title]').fill(titleText);
  await page.locator('#form-add [name=price]').fill('1');
  await page.locator('#form-add [name=description]').fill('desc');
  await page.locator('#form-add button[type=submit]').click();

  // 1) тост обязан честно сообщать об ошибке, а не врать об успехе —
  // квота реально исчерпана, localStorage.setItem бросает
  // QuotaExceededError, и это должно быть видно пользователю
  const toast = page.locator('#toast');
  await expect(toast).toHaveText('Не удалось сохранить: закончилось место в хранилище браузера');

  // 2) раз место реально кончилось, данные объективно не могли
  // сохраниться — это физическое ограничение (см. qa-spec.md, 4.8),
  // а не баг; ожидаем state в localStorage НЕИЗМЕННЫМ
  const stateAfter = await page.evaluate(() => localStorage.getItem('sl_state'));
  const actuallyPersisted = stateAfter !== stateBefore;
  expect(actuallyPersisted, 'состояние в localStorage изменилось при исчерпанной квоте — это невозможно физически, проверь мок квоты').toBe(false);

  // 3) честный тост должен сопровождаться честным экраном: раз данные
  // не сохранились, новой карточки в списке быть не должно (ни в
  // модалке — она уже закрыта отправкой формы, ни на доске позади неё).
  // Раньше здесь была найдена регрессия: state/render() вызывались
  // безусловно, до проверки результата saveLocalState(), из-за чего
  // на экране на мгновение появлялась карточка объявления, которого
  // на самом деле нет в хранилище (qa-runs/2026-08-27_02-54-04/04-independent-review.md)
  await expect(page.locator('.overlay:not(.hidden)')).toHaveCount(0);
  await expect(page.locator('.grid', { hasText: titleText })).toHaveCount(0);

  // 4) перезагрузка страницы не должна ничего "потерять" сверх того,
  // что уже не сохранилось — состояние после reload должно совпадать
  // с тем, что реально лежит в localStorage (никакой карточки не
  // появится и после F5)
  await page.reload();
  await expect(page.locator('.grid', { hasText: titleText })).toHaveCount(0);
});
