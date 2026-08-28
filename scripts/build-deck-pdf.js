'use strict';

/**
 * REPORT.md -> presentation deck PDF.
 *
 * Renders a landscape 16:9 slide deck summarising REPORT.md to
 * submission/REPORT-deck.pdf using headless Chromium driven by Playwright.
 * The deck markup is generated inline and wrapped in a fully self-contained
 * HTML document (system fonts only, no external resources), so it renders
 * correctly offline. One slide == one printed page (1280x720 px).
 *
 * Structure: cover + blocks 01-05 of the report (block 04 spans two slides,
 * it is the largest section) + a closing "how to verify" slide.
 */

const fs = require('fs');
const path = require('path');
const { chromium } = require('@playwright/test');

const ROOT = path.join(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'submission');
const OUT_FILE = path.join(OUT_DIR, 'REPORT-deck.pdf');

// ---- test tape: 73 cells, 16 fails distributed evenly ----
function tape(extraClass = '') {
  const N = 73;
  const F = 16;
  let out = '';
  let drawn = 0;
  for (let i = 0; i < N; i += 1) {
    const wantFail = Math.floor(((i + 1) * F) / N) > Math.floor((i * F) / N);
    if (wantFail && drawn < F) {
      out += '<i class="f"></i>';
      drawn += 1;
    } else {
      out += '<i></i>';
    }
  }
  return `<div class="tape ${extraClass}">${out}</div>`;
}

const bullet = (items) => `<ul>${items.map((t) => `<li>${t}</li>`).join('')}</ul>`;

const slides = [];

// ---------- COVER ----------
slides.push(`
<section class="slide cover">
  <div class="stamp">ЧЕСТНО</div>
  <div class="cover-head">СВОИ ЛЮДИ · QA-ОТЧЁТ · СЕССИЯ 18 · 2026</div>
  <h1 class="cover-title">Приложение «Свои люди»<br><span>честный QA-прогон</span></h1>
  <p class="cover-sub">Локальные объявления между соседями по дому. Проверка по четырём разделам
  <code>qa-spec</code>: функционал, доступность, устойчивость к кривым данным, нагрузка и объём.</p>
  ${tape('big')}
  <div class="cover-legend">
    <span><b class="dot p"></b> 57 зелёных</span>
    <span><b class="dot f"></b> 16 красных</span>
    <span>73 теста — все через реальный UI</span>
  </div>
  <div class="runbox">npm install&nbsp;&nbsp;·&nbsp;&nbsp;npx playwright install chromium&nbsp;&nbsp;·&nbsp;&nbsp;npm test</div>
  <div class="cover-foot">Каждое утверждение — со ссылкой на файл и коммит. Красное падение = задокументированный дефект, не брак.</div>
</section>`);

// ---------- 01 ----------
slides.push(`
<section class="slide">
  <div class="ghost">01</div>
  <header><span>БЛОК 01 / 05 — РАБОТАЮЩИЙ РЕЗУЛЬТАТ</span><span>СВОИ ЛЮДИ · QA</span></header>
  <h1>Что протестировано и как это запустить</h1>
  <p class="summary">73 автотеста Playwright, каждый идёт через реальный интерфейс — клики и ввод в поля,
  а не вызовы внутренних функций страницы. Прогон стабилен при повторах: <b>57 passed / 16 failed</b>.</p>
  <div class="body two-col">
    ${bullet([
      '<b>Функционал:</b> регистрация, вход, права по логину, размещение и бронирование объявлений',
      '<b>Доступность:</b> клавиатурная навигация, фокус в модалках, <code>Escape</code>, <code>axe-core</code>',
      '<b>Кривые / чужие данные:</b> инъекции, обход валидации, подделка сессии, гонки записи',
      '<b>Нагрузка:</b> 50–500 записей, квота <code>localStorage</code>, отклик поиска',
    ])}
    <div class="panel">
      <div class="panel-label">ДИНАМИКА ПРОГОНА</div>
      <div class="progression">9/13 → 10/12 → 14/12 → 15/12 → <b>57/16</b></div>
      <p class="panel-note">Рост покрытия: переписан volume-bugs, +4 теста bypass-ui, разбит functional-flow,
      в сессии 18 влиты <code>func-*</code> / <code>a11y-*</code> / <code>robust-*</code> из трёх параллельных веток.</p>
    </div>
  </div>
  <footer><span>Тесты — в tests/ · HTML-отчёт прогона: npm run test:report</span><span>стр. 2</span></footer>
</section>`);

// ---------- 02 ----------
slides.push(`
<section class="slide">
  <div class="ghost">02</div>
  <header><span>БЛОК 02 / 05 — АГЕНТЫ</span><span>СВОИ ЛЮДИ · QA</span></header>
  <h1>Три режима работы и два эксперимента</h1>
  <p class="summary">Одна и та же задача прогнана тремя способами намеренно — чтобы сравнить подходы,
  а не потому что один не справился. Плюс две побочные проверки безопасности агента.</p>
  <div class="body">
    <table>
      <thead><tr><th>Режим</th><th>Результат</th></tr></thead>
      <tbody>
        <tr><td>Параллельно — 3 независимых субагента</td><td>~11 мин · 290k токенов на троих · находки те же</td></tr>
        <tr><td>Последовательно — 1 поток</td><td>~16 мин (+45%) · 85k токенов (×3,4 меньше) · те же находки</td></tr>
        <tr><td>Независимый ревьюер «с чистого листа»</td><td>нашёл крэш вне платформы Claude и тест, маскировавший баг — теперь это шаг воркфлоу</td></tr>
        <tr><td>Устойчивость к prompt-injection</td><td>скрытая инструкция в файле проекта — ни Haiku, ни Sonnet не выполнили</td></tr>
        <tr><td>Изоляция песочницы Claude Code</td><td>жёсткой ФС-границы «только папка проекта» нет; сработал лишь классификатор auto-режима</td></tr>
      </tbody>
    </table>
  </div>
  <footer><span>qa-report.md · qa-report-solo.md · qa-review-independent.md · security-injection-test.md · sandbox-isolation-test.md</span><span>стр. 3</span></footer>
</section>`);

// ---------- 03 ----------
slides.push(`
<section class="slide">
  <div class="ghost">03</div>
  <header><span>БЛОК 03 / 05 — WORKFLOW</span><span>СВОИ ЛЮДИ · QA</span></header>
  <h1>qa-release-check — процедура перед каждым релизом</h1>
  <p class="summary">Повторяемый прогон перед любым изменением <code>app-under-test/</code>, не разовый скрипт.
  Пять шагов, каждый оставляет файл-доказательство в <code>qa-runs/&lt;дата-время&gt;/</code>.</p>
  <div class="body two-col">
    <ol class="steps">
      <li>Диф <code>app-under-test/</code> с последнего коммита → <code>01-diff.md</code></li>
      <li>Сопоставление дифа с пунктами <code>qa-spec</code> → <code>02-spec-impact.md</code></li>
      <li><code>npx playwright test</code> → <code>03-test-run.md</code></li>
      <li>Независимая проверка свежим субагентом без памяти о тестах → <code>04-independent-review.md</code> (пишет сам агент)</li>
      <li>Итоговый честный отчёт → <code>05-final-report.md</code></li>
    </ol>
    <div class="panel warn">
      <div class="panel-label">ПОЧЕМУ ШАГ 4 ≠ ШАГ 3</div>
      <p class="panel-note">Третий прогон впервые сопровождал правку кода. Независимая проверка нашла
      Critical-баг <b>в самой правке</b> уже после того, как playwright-тесты позеленели и были
      задокументированы. Зелёный набор его бы не поймал.</p>
    </div>
  </div>
  <footer><span>Запуск: /qa-release-check или «прогони QA-check перед релизом» · qa-runs/ в .gitignore</span><span>стр. 4</span></footer>
</section>`);

// ---------- 04a ----------
slides.push(`
<section class="slide">
  <div class="ghost">04</div>
  <header><span>БЛОК 04 / 05 — ЧЕСТНО · НЕ ИСПРАВЛЕНО</span><span>СВОИ ЛЮДИ · QA</span></header>
  <h1>Что осознанно оставлено как есть</h1>
  <p class="summary">Эти дефекты не спрятаны — они зафиксированы красными тестами, которые позеленеют сами,
  когда баг починят в приложении.</p>
  <div class="body">
    ${bullet([
      '<b>Баг Ф-1:</b> модалка деталей закрывается сама сразу после «Забронировать». Сквозной тест разбит на зелёный happy-path и отдельный красный тест на Ф-1',
      '<b>Поиск без debounce:</b> 130–290 мс на каждое нажатие при 350–500 записях, полная пересборка <code>innerHTML</code>',
      '<b>Доступность:</b> 4 нарушения <code>axe</code> critical/serious, нет фокус-трапа, <code>role="dialog"</code>, <code>Escape</code>; карточки недоступны с клавиатуры',
      '<b>3.4 / 3.9 / 3.10</b> (обход цены, самобронь, гонка брони): приняты как ограничения локального прототипа без сервера — зелёные тесты фиксируют факт, а не растут красным сигналом',
    ])}
  </div>
  <footer><span>qa-report-volume.md · tests/volume-bugs.spec.js · tests/bypass-ui.spec.js · accessibility.spec.js</span><span>стр. 5</span></footer>
</section>`);

// ---------- 04b ----------
slides.push(`
<section class="slide">
  <div class="ghost">04</div>
  <header><span>БЛОК 04 / 05 — ЧЕСТНО · ИСПРАВЛЕНО В ПРОЦЕССЕ</span><span>СВОИ ЛЮДИ · QA</span></header>
  <h1>Единственная правка кода — и как именно она шла</h1>
  <p class="summary">Потеря данных при переполнении <code>localStorage</code>: <code>saveLocalState()</code> глотала
  <code>QuotaExceededError</code> в пустой <code>catch{}</code>, а тост всё равно врал об успехе.</p>
  <div class="body">
    ${bullet([
      '<b>Итерация 1</b> починила только текст тоста → независимый субагент на шаге 4 нашёл Critical <b>в самой правке</b>: фантомная карточка в DOM при провале сохранения',
      '<b>Итерация 2:</b> <code>state</code> / <code>render()</code> выполняются только при успешном сохранении. Правка идентична в трёх HTML-файлах',
      '<b>Тест переписан</b> под честное поведение: <code>actuallyPersisted === false</code>, нет фантомной карточки, проверка после <code>reload()</code> — заодно закрыт п. 4.8',
      '<b>Непокрытый риск:</b> <code>helpers.js</code> привязаны к <code>index-local.html</code> — идентичность двух других файлов подтверждена только побайтовым diff\'ом, не прогоном',
    ])}
  </div>
  <footer><span>qa-runs/2026-08-27_02-54-04/ · tests/volume-bugs.spec.js · 04-independent-review.md</span><span>стр. 6</span></footer>
</section>`);

// ---------- 05 ----------
slides.push(`
<section class="slide">
  <div class="ghost">05</div>
  <header><span>БЛОК 05 / 05 — ОТКРЫТЫЙ ВОПРОС · ЗАКРЫТ</span><span>СВОИ ЛЮДИ · QA</span></header>
  <h1>Видимость телефона третьим лицам</h1>
  <p class="summary">qa-spec 1.4.5: после чужой брони номер телефона автора и кнопки связи видны
  <b>любому</b> авторизованному пользователю, открывшему объявление — не только автору и тому, кто забронировал.</p>
  <div class="body">
    ${bullet([
      '<b>Причина:</b> <code>renderDetail()</code> не проверяет <code>isAuthor</code> / <code>isBooker</code> для блока <code>phone-reveal</code> — только для кнопки «Отменить бронь» внутри него',
      '<b>Решение принято: оставить как есть.</b> Закрытый круг соседей по одному дому — телефон и так не секрет внутри этого круга. Не блокер, правок в коде не требуется',
      '<b>Автотеста нет.</b> При желании зафиксировать решение — зелёный регресс-тест по образцу 3.13 и 3.4 / 3.9 / 3.10',
    ])}
  </div>
  <footer><span>qa-spec.md п. 1.4.5 · qa-report.md · qa-report-solo.md</span><span>стр. 7</span></footer>
</section>`);

// ---------- CLOSING ----------
slides.push(`
<section class="slide closing">
  <div class="close-head">КАК ПРОВЕРИТЬ САМОМУ</div>
  <div class="bignum"><span class="p">57</span> <span class="sep">/</span> <span class="f">16</span></div>
  ${tape('big')}
  <div class="close-grid">
    <div><b>npm test</b><br>полный прогон, 57 / 16, стабильно при повторах</div>
    <div><b>npm run test:report</b><br>HTML-отчёт по каждому тесту</div>
    <div><b>qa-spec.md + git log</b><br>каждый пункт — со ссылкой на файл и коммит</div>
  </div>
  <div class="close-foot">Ничего не приукрашено. 16 красных — честные ассерты на реальных дефектах приложения.</div>
</section>`);

const CSS = `
*{margin:0;padding:0;box-sizing:border-box}
:root{
  --paper:#ECEEEA; --paper-2:#E2E5DE; --ink:#191D1B; --ink-soft:#4C524C;
  --rule:#C6CAC1; --pass:#1F7A4D; --fail:#A6322E; --accent:#243F58;
  --serif:"Palatino Linotype","Book Antiqua","URW Palladio L",P052,Georgia,serif;
  --sans:"Segoe UI",Roboto,system-ui,-apple-system,sans-serif;
  --mono:"Consolas","Cascadia Mono","DejaVu Sans Mono",monospace;
}
html,body{background:#fff}
body{font-family:var(--sans);color:var(--ink);-webkit-print-color-adjust:exact;print-color-adjust:exact}
.slide{
  position:relative;width:1280px;height:720px;background:var(--paper);
  padding:56px 76px 68px;overflow:hidden;break-after:page;
}
.slide:last-child{break-after:auto}

.ghost{
  position:absolute;top:74px;right:70px;font-family:var(--serif);
  font-size:150px;line-height:1;color:rgba(25,29,27,.055);font-weight:700;letter-spacing:-.02em;
}

header{
  display:flex;justify-content:space-between;align-items:baseline;
  font-family:var(--mono);font-size:11px;letter-spacing:.17em;text-transform:uppercase;
  color:var(--ink-soft);border-bottom:1px solid var(--rule);padding-bottom:14px;
}
h1{
  font-family:var(--serif);font-weight:700;font-size:43px;line-height:1.1;
  letter-spacing:-.01em;margin-top:44px;max-width:24ch;
}
.summary{
  font-size:17.5px;line-height:1.55;color:var(--ink-soft);max-width:84ch;
  margin-top:20px;border-left:3px solid var(--accent);padding-left:18px;
}
.summary b{color:var(--ink);font-weight:600}
.body{margin-top:34px}
.two-col{display:grid;grid-template-columns:1.15fr .85fr;gap:44px;align-items:start}

ul{list-style:none}
li{
  position:relative;padding-left:24px;font-size:15px;line-height:1.5;
  color:var(--ink-soft);margin-bottom:13px;max-width:70ch;
}
li::before{content:"";position:absolute;left:0;top:8px;width:7px;height:7px;background:var(--accent)}
li b{color:var(--ink);font-weight:600}

ol.steps{list-style:none;counter-reset:s}
ol.steps li{
  counter-increment:s;position:relative;padding-left:40px;font-size:14.5px;
  line-height:1.45;color:var(--ink-soft);margin-bottom:15px;max-width:52ch;
}
ol.steps li::before{
  content:counter(s);position:absolute;left:0;top:-2px;width:24px;height:24px;
  background:var(--ink);color:var(--paper);font-family:var(--mono);font-size:12px;
  display:flex;align-items:center;justify-content:center;font-weight:700;
}
ol.steps li b{color:var(--ink)}

table{width:100%;border-collapse:collapse;margin-top:4px}
th{
  font-family:var(--mono);font-size:10.5px;letter-spacing:.14em;text-transform:uppercase;
  color:var(--ink-soft);text-align:left;padding:0 16px 10px 0;border-bottom:1.5px solid var(--ink);
}
td{
  font-size:14px;line-height:1.4;padding:13px 16px 13px 0;
  border-bottom:1px solid var(--rule);vertical-align:top;
}
td:first-child{font-weight:600;color:var(--ink);width:38%}
td:last-child{color:var(--ink-soft)}

.panel{background:var(--paper-2);padding:22px 24px;border-top:3px solid var(--accent)}
.panel.warn{border-top-color:var(--fail)}
.panel-label{
  font-family:var(--mono);font-size:10.5px;letter-spacing:.15em;text-transform:uppercase;
  color:var(--ink-soft);margin-bottom:12px;
}
.progression{font-family:var(--mono);font-size:18px;color:var(--ink);letter-spacing:.01em}
.progression b{color:var(--pass)}
.panel-note{font-size:13px;line-height:1.5;color:var(--ink-soft);margin-top:12px}
.panel-note b{color:var(--ink);font-weight:600}

code{font-family:var(--mono);font-size:.88em;background:rgba(36,63,88,.08);padding:1px 5px;color:var(--accent)}

footer{
  position:absolute;left:76px;right:76px;bottom:40px;display:flex;justify-content:space-between;
  font-family:var(--mono);font-size:10.5px;letter-spacing:.06em;color:var(--ink-soft);
  border-top:1px solid var(--rule);padding-top:12px;
}

.tape{display:flex;gap:2px;margin-top:30px}
.tape i{width:6px;height:26px;background:var(--pass);display:block}
.tape i.f{background:var(--fail)}
.tape.big{gap:3px}
.tape.big i{width:12px;height:58px}

.cover{display:flex;flex-direction:column;padding:64px 76px 56px}
.cover-head{
  font-family:var(--mono);font-size:11px;letter-spacing:.2em;text-transform:uppercase;
  color:var(--ink-soft);border-bottom:1px solid var(--rule);padding-bottom:16px;
}
.cover-title{font-family:var(--serif);font-weight:700;font-size:52px;line-height:1.08;margin-top:48px;letter-spacing:-.015em;text-wrap:balance}
.cover-title span{color:var(--ink-soft)}
.cover-sub{font-size:17px;line-height:1.55;color:var(--ink-soft);max-width:72ch;margin-top:22px}
.cover-legend{display:flex;gap:34px;font-family:var(--mono);font-size:12px;color:var(--ink-soft);margin-top:18px;align-items:center}
.cover-legend .dot{display:inline-block;width:9px;height:9px;margin-right:7px;vertical-align:baseline}
.dot.p{background:var(--pass)} .dot.f{background:var(--fail)}
.runbox{
  margin-top:34px;background:var(--ink);color:var(--paper);font-family:var(--mono);
  font-size:13px;letter-spacing:.02em;padding:17px 22px;align-self:flex-start;
}
.cover-foot{
  margin-top:auto;font-size:13px;color:var(--ink-soft);border-top:1px solid var(--rule);
  padding-top:14px;line-height:1.5;max-width:82ch;
}
.stamp{
  position:absolute;top:70px;right:64px;font-family:var(--mono);font-weight:700;
  font-size:20px;letter-spacing:.24em;color:rgba(166,50,46,.62);
  border:2.5px solid rgba(166,50,46,.5);padding:8px 16px 7px;transform:rotate(7deg);
}

.closing{display:flex;flex-direction:column;align-items:flex-start;padding:70px 76px 56px}
.close-head{
  font-family:var(--mono);font-size:11px;letter-spacing:.22em;text-transform:uppercase;
  color:var(--ink-soft);border-bottom:1px solid var(--rule);padding-bottom:16px;align-self:stretch;
}
.bignum{font-family:var(--serif);font-weight:700;font-size:132px;line-height:1;margin-top:48px;letter-spacing:-.02em}
.bignum .p{color:var(--pass)} .bignum .f{color:var(--fail)} .bignum .sep{color:var(--rule)}
.close-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:34px;margin-top:52px;align-self:stretch}
.close-grid div{font-size:13.5px;line-height:1.55;color:var(--ink-soft);border-top:2px solid var(--ink);padding-top:14px}
.close-grid b{font-family:var(--mono);font-size:13px;color:var(--ink);letter-spacing:.02em}
.close-foot{margin-top:auto;font-size:13.5px;color:var(--ink-soft);border-top:1px solid var(--rule);padding-top:14px;align-self:stretch}
`;

function buildHtml() {
  return `<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="utf-8">
<title>Свои люди — QA-отчёт, презентация</title>
<style>${CSS}</style>
</head>
<body>
${slides.join('\n')}
</body>
</html>`;
}

async function main() {
  if (!fs.existsSync(OUT_DIR)) {
    fs.mkdirSync(OUT_DIR, { recursive: true });
  }

  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    try {
      await page.setContent(buildHtml(), { waitUntil: 'load' });
      await page.emulateMedia({ media: 'print' });
      await page.pdf({
        path: OUT_FILE,
        width: '1280px',
        height: '720px',
        printBackground: true,
        preferCSSPageSize: true,
        margin: { top: 0, right: 0, bottom: 0, left: 0 },
      });
    } finally {
      await page.close();
    }
    const bytes = fs.statSync(OUT_FILE).size;
    console.log(`Wrote ${OUT_FILE} (${bytes} bytes)`);
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
