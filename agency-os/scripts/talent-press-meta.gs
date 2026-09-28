/** Talent Press workbook-bound Apps Script. Meta token stays in Agency OS. */
const TP_META_EXPORT_URL = 'https://prodigital-os.vercel.app/api/exports/talent-press-meta';
const TP_META_WEEK_SHEET = 'META ads _ недели';
const TP_META_MONTH_SHEET = '_META — МЕСЯЦЫ';

function setupMetaDirect() {
  updateMetaDirect();
  ScriptApp.getProjectTriggers()
    .filter(trigger => trigger.getHandlerFunction() === 'updateMetaDirect')
    .forEach(trigger => ScriptApp.deleteTrigger(trigger));
  ScriptApp.newTrigger('updateMetaDirect').timeBased().everyDays(1)
    .atHour(8).inTimezone('Europe/Moscow').create();
}

function updateMetaDirect() {
  const secret = PropertiesService.getScriptProperties().getProperty('TALENT_PRESS_SHEETS_SECRET');
  if (!secret) throw new Error('Не настроен ключ выгрузки Meta');
  const response = UrlFetchApp.fetch(TP_META_EXPORT_URL, {
    method: 'get',
    headers: { Authorization: 'Bearer ' + secret },
    muteHttpExceptions: true,
  });
  if (response.getResponseCode() !== 200) {
    throw new Error('Meta API: выгрузка недоступна, HTTP ' + response.getResponseCode());
  }
  const payload = JSON.parse(response.getContentText());
  if (!Array.isArray(payload.periods) || !/^\d{4}-\d{2}-\d{2}$/.test(payload.asOf)) {
    throw new Error('Meta API: некорректный ответ');
  }
  const weeks = payload.periods.filter(period => period.kind === 'week');
  const months = payload.periods.filter(period => period.kind === 'month');
  if (weeks.length !== 5 || months.length !== 2) {
    throw new Error('Meta API: неполный набор периодов');
  }
  const lock = LockService.getDocumentLock();
  lock.waitLock(30000);
  try {
    writeMetaPeriods_(TP_META_WEEK_SHEET, weeks, metaWeekRow_);
    writeMetaPeriods_(TP_META_MONTH_SHEET, months, metaMonthRow_);
  } finally {
    lock.releaseLock();
  }
}

function writeMetaPeriods_(sheetName, periods, rowMapper) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
  if (!sheet) throw new Error('Не найден лист ' + sheetName);
  const width = sheetName === TP_META_WEEK_SHEET ? 14 : 15;
  const last = sheet.getLastRow();
  const existing = last > 1 ? sheet.getRange(2, 1, last - 1, width).getValues() : [];
  const replaced = new Set(periods.map(period => period.start));
  const retained = existing.filter(row => {
    const value = row[sheetName === TP_META_WEEK_SHEET ? 0 : 11];
    if (!value) return false;
    const start = value instanceof Date
      ? Utilities.formatDate(value, 'Etc/UTC', 'yyyy-MM-dd')
      : String(value).slice(0, 10);
    return !replaced.has(start);
  });
  const next = retained.concat(periods.flatMap(period => {
    if (!Array.isArray(period.rows)) throw new Error('Meta API: период без строк');
    return period.rows.map(row => rowMapper(row));
  }));
  next.sort((a, b) => {
    const left = sheetName === TP_META_WEEK_SHEET ? a[0] : a[11];
    const right = sheetName === TP_META_WEEK_SHEET ? b[0] : b[11];
    return String(left).localeCompare(String(right));
  });
  if (last > 1) sheet.getRange(2, 1, last - 1, width).clearContent();
  if (next.length > 0) {
    if (sheet.getMaxRows() < next.length + 1) {
      sheet.insertRowsAfter(sheet.getMaxRows(), next.length + 1 - sheet.getMaxRows());
    }
    sheet.getRange(2, 1, next.length, width).setValues(next);
  }
}

function metaWeekRow_(row) {
  const ctr = row.impressions ? row.clicks / row.impressions * 100 : 0;
  return [row.period, row.campaign, row.country, row.spend, row.reach,
    row.impressions, row.impressions ? row.spend / row.impressions * 1000 : 0,
    row.clicks, ctr, row.clicks ? row.spend / row.clicks : 0,
    row.linkClicks, row.linkClicks ? row.spend / row.linkClicks : 0,
    row.leads, row.leads ? row.spend / row.leads : 0];
}

function metaMonthRow_(row) {
  return [row.reach, row.impressions,
    row.reach ? row.impressions / row.reach : 0,
    row.leads, row.leads ? row.spend / row.leads : 0,
    row.spend, row.impressions ? row.spend / row.impressions * 1000 : 0,
    row.linkClicks, row.linkClicks ? row.spend / row.linkClicks : 0,
    row.impressions ? row.linkClicks / row.impressions * 100 : 0,
    row.campaign, row.period, row.country, row.clicks, row.leads];
}
