const BASE_URL = 'https://api.murygin.tech';

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Таблица → МС / РЕМ')
    .addItem('Запустить', 'showUploadForm')
    .addToUi();
}

function showUploadForm() {
  const html = HtmlService.createHtmlOutputFromFile('upload')
    .setTitle('Интеграции с ERP')
    .setWidth(500);
  SpreadsheetApp.getUi().showSidebar(html);
}

function processFile(base64Data) {
  const response = UrlFetchApp.fetch(BASE_URL + '/price-monitoring/update-shop-products-costs', {
    method: 'POST',
    contentType: 'application/json',
    payload: JSON.stringify({ file: base64Data }),
    muteHttpExceptions: true,
  });

  const { id } = JSON.parse(response.getContentText());
  return id;
}

function loadPricesFromMS() {
  UrlFetchApp.fetch('https://n8n.murygin.tech/webhook/pricesFromMs', {
    method: 'GET',
    contentType: 'application/json',
  });
  return 'OK';
}

function uploadPricesToMS() {
  UrlFetchApp.fetch('https://n8n.murygin.tech/webhook/updatePricesInMS', {
    method: 'PATCH',
    contentType: 'application/json',
  });
  return 'OK';
}

function uploadSalePricesToMS() {
  UrlFetchApp.fetch('https://n8n.murygin.tech/webhook/updateSalePricesInMS', {
    method: 'PATCH',
    contentType: 'application/json',
  });
  return 'OK';
}

const ACCRUALS_SHEET_GID = 1714253184;
const ACCRUALS_ID_COLUMN = 5;   // E
const ACCRUALS_SUM_COLUMN = 71; // BS
const ACCRUALS_FIRST_ROW = 5;
const RO_NEW_PRICE_COLUMN = 60; // BH
const RO_OLD_PRICE_COLUMN = 49; // AW

function uploadPricesToRO() {
  const sheet = getAccrualsSheet_();

  const lastRow = sheet.getLastRow();
  const emptyResult = { success: true, count: { total: 0, valid: 0, create: 0, update: 0, errors: 0 } };
  if (lastRow < ACCRUALS_FIRST_ROW) return emptyResult;

  const numRows = lastRow - ACCRUALS_FIRST_ROW + 1;
  const ids = sheet.getRange(ACCRUALS_FIRST_ROW, ACCRUALS_ID_COLUMN, numRows, 1).getValues();
  const newPrices = sheet.getRange(ACCRUALS_FIRST_ROW, RO_NEW_PRICE_COLUMN, numRows, 1).getValues();
  const accruals = sheet.getRange(ACCRUALS_FIRST_ROW, ACCRUALS_SUM_COLUMN, numRows, 1).getValues();

  const items = [];
  const sentRows = [];
  for (let i = 0; i < numRows; i++) {
    const id = ids[i][0];
    const price = newPrices[i][0];
    if (id === '' || id === null || price === '' || price === null) continue;
    items.push({ id: id, price: price, serviceCost: accruals[i][0] });
    sentRows.push({ row: ACCRUALS_FIRST_ROW + i, price: price });
  }

  if (items.length === 0) return emptyResult;

  const response = UrlFetchApp.fetch(BASE_URL + '/price-monitoring/update-service-price', {
    method: 'POST',
    contentType: 'application/json',
    payload: JSON.stringify(items),
    muteHttpExceptions: true,
  });

  const result = JSON.parse(response.getContentText());

  if (result.success) {
    sentRows.forEach(function (entry) {
      sheet.getRange(entry.row, RO_OLD_PRICE_COLUMN).setValue(entry.price);
      sheet.getRange(entry.row, RO_NEW_PRICE_COLUMN).setValue('');
    });
  }

  return result;
}

function getAccrualsSheet_() {
  return SpreadsheetApp.getActiveSpreadsheet()
    .getSheets()
    .find(s => s.getSheetId() === ACCRUALS_SHEET_GID);
}

function getAccrualsSheetEntries() {
  const sheet = getAccrualsSheet_();
  const lastRow = sheet.getLastRow();
  if (lastRow < ACCRUALS_FIRST_ROW) return [];

  const numRows = lastRow - ACCRUALS_FIRST_ROW + 1;
  const ids = sheet.getRange(ACCRUALS_FIRST_ROW, ACCRUALS_ID_COLUMN, numRows, 1).getValues();
  const oldSums = sheet.getRange(ACCRUALS_FIRST_ROW, ACCRUALS_SUM_COLUMN, numRows, 1).getValues();

  const entries = [];
  ids.forEach(function (row, i) {
    const id = row[0];
    if (id === '' || id === null) return;
    entries.push({ id: String(id), row: ACCRUALS_FIRST_ROW + i, value: oldSums[i][0] });
  });

  return entries;
}

function fetchServiceBonusesMap() {
  const response = UrlFetchApp.fetch('http://rm.murygin.tech/getServicesBonuses', {
    method: 'GET',
    contentType: 'application/json',
    muteHttpExceptions: true,
  });
  const bonuses = JSON.parse(response.getContentText());

  const earningsById = {};
  bonuses.forEach(function (bonus) { earningsById[String(bonus.objectId)] = bonus.earningsSum; });

  return earningsById;
}

function applyAccrualsUpdates(entries, earningsById) {
  const sheet = getAccrualsSheet_();

  const updatedIds = [];
  entries.forEach(function (entry) {
    if (!(entry.id in earningsById)) return;

    const newValue = earningsById[entry.id];
    if (newValue === entry.value) return;

    sheet.getRange(entry.row, ACCRUALS_SUM_COLUMN).setValue(newValue);
    updatedIds.push(entry.id);
  });

  return updatedIds;
}