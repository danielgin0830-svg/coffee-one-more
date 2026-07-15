const form = document.querySelector('#issuerForm');
const countrySelect = document.querySelector('#countrySelect');
const regionSelect = document.querySelector('#regionSelect');
const stationSelect = document.querySelector('#stationSelect');
const varietySelect = document.querySelector('#varietySelect');
const processSelect = document.querySelector('#processSelect');
const customStationField = document.querySelector('#customStationField');
const serviceState = document.querySelector('#serviceState');
const registryMeta = document.querySelector('#registryMeta');
const formMessage = document.querySelector('#formMessage');
const generateButton = document.querySelector('#generateButton');
const flavorCounter = document.querySelector('#flavorCounter');
const previewEmpty = document.querySelector('#previewEmpty');
const previewResult = document.querySelector('#previewResult');
const qrImage = document.querySelector('#qrImage');
const qrStats = document.querySelector('#qrStats');
const batchSummary = document.querySelector('#batchSummary');

let catalog = null;
let latest = null;

await initialize();

async function initialize() {
  setToday();
  bindEvents();
  updateFlavorCounter();
  try {
    catalog = await api('/api/catalog');
    populateCountries();
    populateSimpleSelect(varietySelect, catalog.varieties, ['JARC 74110', 'JARC 74112']);
    populateSimpleSelect(processSelect, catalog.processes, ['水洗']);
    registryMeta.textContent = `${catalog.registryVersion} · ${catalog.countries.length} 个国家 · ${catalog.regions.length} 个产区`;
    serviceState.classList.add('online');
    serviceState.querySelector('span:last-child').textContent = '本地服务已连接';
  } catch (error) {
    serviceState.classList.add('error');
    serviceState.querySelector('span:last-child').textContent = '连接失败';
    formMessage.textContent = error.message;
  }
}

function bindEvents() {
  countrySelect.addEventListener('change', updateOriginOptions);
  stationSelect.addEventListener('change', () => {
    customStationField.hidden = stationSelect.value !== '0';
  });
  form.elements.flavorNotes.addEventListener('input', updateFlavorCounter);
  form.addEventListener('submit', submitForm);
  form.addEventListener('reset', () => setTimeout(() => {
    setToday();
    if (catalog) {
      populateCountries();
      populateSimpleSelect(varietySelect, catalog.varieties, ['JARC 74110', 'JARC 74112']);
      populateSimpleSelect(processSelect, catalog.processes, ['水洗']);
    }
    updateFlavorCounter();
    formMessage.textContent = '';
  }));
  document.querySelector('#downloadSvg').addEventListener('click', () => downloadText(latest.svg, 'coffee-batch.svg', 'image/svg+xml'));
  document.querySelector('#downloadPng').addEventListener('click', () => downloadDataUrl(latest.pngDataUrl, 'coffee-batch.png'));
  document.querySelector('#copyText').addEventListener('click', copyQrText);
}

async function submitForm(event) {
  event.preventDefault();
  generateButton.disabled = true;
  generateButton.textContent = '正在生成';
  formMessage.textContent = '';
  try {
    const data = buildPayload(new FormData(form));
    latest = await api('/api/encode', { method: 'POST', body: data });
    renderResult(latest);
  } catch (error) {
    formMessage.textContent = error.message;
  } finally {
    generateButton.disabled = false;
    generateButton.textContent = '生成二维码';
  }
}

function buildPayload(data) {
  const countryQrId = Number(data.get('countryQrId'));
  const regionQrId = Number(data.get('regionQrId'));
  const stationValue = String(data.get('stationQrId') || '');
  const stationQrId = stationValue === '' ? null : Number(stationValue);
  const entityRoles = [];
  if (regionQrId) entityRoles.push({ role: 'region', qrId: regionQrId });
  if (stationQrId > 0) entityRoles.push({ role: 'washing_station', qrId: stationQrId });
  if (stationValue === '0') {
    entityRoles.push({
      role: 'washing_station',
      qrId: 0,
      text: String(data.get('customStationText') || '').trim(),
      language: 'zh-CN'
    });
  }
  return {
    issuerName: data.get('issuerName'),
    issuerId: data.get('issuerId'),
    batchId: data.get('batchId'),
    productName: data.get('productName'),
    countryQrId,
    entityRoles,
    varietyQrIds: selectedNumbers(varietySelect),
    processQrIds: selectedNumbers(processSelect),
    cropYear: data.get('cropYear'),
    roastDate: data.get('roastDate'),
    roastLevel: data.get('roastLevel'),
    netWeightG: numberOrUndefined(data.get('netWeightG')),
    altitudeMinM: numberOrUndefined(data.get('altitudeMinM')),
    altitudeMaxM: numberOrUndefined(data.get('altitudeMaxM')),
    flavorTagQrIds: [],
    flavorNotes: data.get('flavorNotes'),
    lotText: data.get('lotText'),
    language: 'zh-CN',
    customFields: {}
  };
}

function renderResult(result) {
  const { decoded } = result;
  previewEmpty.hidden = true;
  previewResult.hidden = false;
  qrImage.src = result.pngDataUrl;
  qrStats.textContent = `短链接 ${result.qrTextLength} 字符 · Version ${result.qrVersion} · ${result.moduleCount}×${result.moduleCount} 模块`;
  const regionNames = decoded.resolved.entities.map(item => displayName(item.entity)).filter(Boolean).join(' · ') || '未填写';
  const processNames = decoded.resolved.processes.map(displayName).join(' / ');
  batchSummary.innerHTML = [
    ['商品', decoded.batch.productName],
    ['产地', displayName(decoded.resolved.country)],
    ['产区／处理厂', regionNames],
    ['处理法', processNames],
    ['烘焙日期', decoded.batch.roastDate],
    ['净含量', decoded.batch.netWeightG ? `${decoded.batch.netWeightG} 克` : '未填写'],
    ['扫码链接', result.qrText]
  ].map(([label, value]) => `<div class="summary-item"><span>${escapeHtml(label)}</span><strong title="${escapeHtml(value)}">${escapeHtml(value)}</strong></div>`).join('');
}

function populateCountries() {
  countrySelect.innerHTML = catalog.countries.map(item => optionHtml(item)).join('');
  const ethiopia = catalog.countries.find(item => item.nameCn === '埃塞俄比亚');
  if (ethiopia) countrySelect.value = String(ethiopia.qrId);
  updateOriginOptions();
}

function updateOriginOptions() {
  if (!catalog) return;
  const countryQrId = Number(countrySelect.value);
  const regions = catalog.regions.filter(item => item.countryQrId === countryQrId);
  const stations = catalog.stations.filter(item => item.countryQrId === countryQrId);
  regionSelect.innerHTML = `<option value="">未填写</option>${regions.map(optionHtml).join('')}`;
  stationSelect.innerHTML = `<option value="">未填写</option>${stations.map(optionHtml).join('')}<option value="0">未收录，填写原文</option>`;
  const yirgacheffe = regions.find(item => item.nameCn === '耶加雪菲');
  const worka = stations.find(item => item.nameCn === '沃卡');
  if (yirgacheffe) regionSelect.value = String(yirgacheffe.qrId);
  if (worka) stationSelect.value = String(worka.qrId);
  customStationField.hidden = true;
}

function populateSimpleSelect(select, items, selectedNames = []) {
  select.innerHTML = items.map(optionHtml).join('');
  for (const option of select.options) {
    option.selected = selectedNames.includes(option.textContent.split(' / ')[0]);
  }
}

function optionHtml(item) {
  const label = item.nameCn || item.nameEn || item.code;
  const secondary = item.nameEn && item.nameEn !== label ? ` / ${item.nameEn}` : '';
  return `<option value="${item.qrId}">${escapeHtml(label + secondary)}</option>`;
}

function selectedNumbers(select) {
  return Array.from(select.selectedOptions).map(option => Number(option.value));
}

function numberOrUndefined(value) {
  const text = String(value || '').trim();
  return text === '' ? undefined : Number(text);
}

function setToday() {
  form.elements.roastDate.value = new Date().toISOString().slice(0, 10);
}

function updateFlavorCounter() {
  flavorCounter.textContent = `${Array.from(form.elements.flavorNotes.value).length}/60`;
}

function displayName(entity = {}) {
  return entity.nameCn || entity.shortName || entity.nameEn || entity.code || '';
}

async function copyQrText() {
  if (!latest) return;
  await navigator.clipboard.writeText(latest.qrText);
  const button = document.querySelector('#copyText');
  button.textContent = '已复制';
  setTimeout(() => { button.textContent = '复制'; }, 1200);
}

function downloadText(text, fileName, type) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  triggerDownload(url, fileName);
  URL.revokeObjectURL(url);
}

function downloadDataUrl(url, fileName) {
  triggerDownload(url, fileName);
}

function triggerDownload(url, fileName) {
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
}

async function api(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  const result = await response.json();
  if (!response.ok || result.ok === false) throw new Error(result.message || '请求失败');
  return result;
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  })[character]);
}
