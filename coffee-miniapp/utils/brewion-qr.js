// Snapshot source: https://github.com/zjcrop/BrewIon/tree/main/coffee-qr-codebook
const CODEBOOK = require('../data/brewion-coffee-qr-codebook-v6.js');

const ROAST_LEVELS = [
  'ultra_light',
  'light',
  'light',
  'medium',
  'dark',
  'ultra_dark',
  'ultra_dark'
];

function isBrewIonQr(text) {
  return /^CQ[678](?:-|~)/.test(String(text || '').trim());
}

function decodeBrewIonQr(text) {
  const payload = String(text || '').trim();
  if (!isBrewIonQr(payload)) {
    throw new Error('不是 BrewIon 支持的咖啡二维码');
  }

  const protocol = payload.slice(0, 3);
  const delimiter = protocol === 'CQ8' ? '-' : '~';
  const parts = payload.split(delimiter);
  const fields = normalizePayloadParts(parts);
  const core = parts.slice(0, -1).join(delimiter);
  const expectedCrc = crc16(core);
  if (fields.crc !== expectedCrc) {
    throw new Error(`二维码校验失败：读取到 ${fields.crc}，应为 ${expectedCrc}`);
  }

  const warnings = [];
  if (fields.db !== String(CODEBOOK.version)) {
    warnings.push(`二维码码表版本为 v${fields.db}，本地码表为 v${CODEBOOK.version}，已按兼容行号解析，请重点核对结果。`);
  }

  const country = getRequiredRecord('countries', fields.country, '国家');
  const region = getOptionalRecord('regions', fields.region, '产区', warnings);
  const farm = getOptionalRecord('entities', fields.farm, '庄园/农场', warnings);
  const station = getOptionalRecord('entities', fields.station, '处理站/处理厂', warnings);
  const variety = getRequiredRecord('varieties', fields.variety, '豆种');
  const process = getRequiredRecord('processes', fields.process, '处理法');
  validateCountryRelation(country, region, '产区', warnings);
  validateCountryRelation(country, farm, '庄园/农场', warnings);
  validateCountryRelation(country, station, '处理站/处理厂', warnings);
  const flavors = String(fields.flavors || '')
    .split('.')
    .filter(Boolean)
    .map(segment => getOptionalRecord('flavors', segment, '风味', warnings))
    .filter(Boolean);

  const roastIndex = Number(fields.roast);
  if (!Number.isInteger(roastIndex) || !ROAST_LEVELS[roastIndex]) {
    throw new Error('二维码中的烘焙度无法识别');
  }

  const origin = country[1] || country[2] || country[3] || '';
  const regionName = region ? (region[2] || region[3] || region[4]) : '';
  const farmName = farm ? (farm[3] || farm[4] || farm[5]) : '';
  const stationName = station ? (station[3] || station[4] || station[5]) : '';
  const varietyName = variety[1] || variety[2] || variety[3] || '';
  const processName = process[1] || process[2] || process[3] || '';
  const regionLot = uniqueValues([regionName, farmName, stationName]).join(' · ');
  const flavorNotes = uniqueValues(flavors.map(row => row[4] || row[5])).join('、');
  const roastDate = decodeDateCode(fields.date);
  const altitude = decodeAltitude(fields.altitude);
  const roaster = protocol === 'CQ8'
    ? decodeFieldText(fields.roaster)
    : decodeBase64UrlUtf8(fields.roaster);
  const harvestYear = decodeHarvest(fields.harvest);
  const name = uniqueValues([
    country[3] || origin,
    regionName || farmName || stationName || varietyName,
    processName
  ]).join(' ');

  if (!roastDate) warnings.push('二维码未包含有效烘焙日期，请保存前补充。');
  if (!flavorNotes) warnings.push('二维码未包含风味标签，请保存前补充风味描述。');
  if (fields.color) warnings.push(`已识别 Agtron ${fields.color}，当前豆仓暂无独立色值字段，已保留在来源信息中。`);
  if (harvestYear) warnings.push(`已识别生豆产季 ${harvestYear}，当前豆仓暂无独立产季字段，已保留在来源信息中。`);

  return {
    source: 'BrewIon 二维码',
    draft: compactObject({
      name,
      origin,
      roaster,
      roastDate,
      roastLevel: ROAST_LEVELS[roastIndex],
      processing: mapProcessing(process),
      flavorNotes,
      altitude,
      regionLot,
      variety: varietyName
    }),
    candidates: {},
    rawText: payload,
    warnings,
    metadata: compactObject({
      qrSource: 'brewion-codebook',
      qrProtocol: protocol,
      qrCodebookVersion: fields.db,
      qrPayload: payload,
      qrCrc: fields.crc,
      qrImportedAt: new Date().toISOString(),
      brewIonRoastColor: fields.color,
      brewIonHarvestYear: harvestYear,
      brewIonLegacyUid: fields.legacyUid
    })
  };
}

function normalizePayloadParts(parts) {
  if (parts[0] === 'CQ8' && parts.length === 16) {
    return mapPayload(parts, false, true);
  }
  if (parts[0] === 'CQ7' && parts.length === 16) {
    return mapPayload(parts, false, false);
  }
  if (parts[0] === 'CQ6' && parts.length === 17) {
    return mapPayload(parts, true, false);
  }
  throw new Error('二维码字段数量不正确；当前支持 CQ8，并兼容 CQ7 / CQ6');
}

function mapPayload(parts, hasLegacyUid, encodedDatabaseVersion) {
  const offset = hasLegacyUid ? 1 : 0;
  return {
    protocol: parts[0],
    db: encodedDatabaseVersion ? decodeFieldText(parts[1]) : parts[1],
    legacyUid: hasLegacyUid ? parts[2] : '',
    country: parts[2 + offset],
    region: parts[3 + offset],
    farm: parts[4 + offset],
    station: parts[5 + offset],
    variety: parts[6 + offset],
    process: parts[7 + offset],
    roast: parts[8 + offset],
    color: parts[9 + offset],
    altitude: parts[10 + offset],
    flavors: parts[11 + offset],
    roaster: parts[12 + offset],
    date: parts[13 + offset],
    harvest: parts[14 + offset],
    crc: parts[15 + offset]
  };
}

function getRequiredRecord(table, segment, label) {
  const record = getRecord(table, segment);
  if (!record) throw new Error(`${label}编码无法用本地 v${CODEBOOK.version} 码表解析`);
  return record;
}

function getOptionalRecord(table, segment, label, warnings) {
  if (!segment) return null;
  const record = getRecord(table, segment);
  if (!record) warnings.push(`${label}编码 ${segment} 暂未收录，已跳过该字段。`);
  return record;
}

function getRecord(table, segment) {
  if (!segment || !/^[0-9a-z]+$/i.test(String(segment))) return null;
  const index = parseInt(segment, 36);
  if (!Number.isSafeInteger(index) || index < 1) return null;
  return (CODEBOOK[table] || [])[index - 1] || null;
}

function validateCountryRelation(country, record, label, warnings) {
  if (!record || !record[1] || record[1] === country[0]) return;
  warnings.push(`${label}与国家的编码关系不一致，请保存前人工核对。`);
}

function crc16(text) {
  let crc = 0xffff;
  for (let index = 0; index < text.length; index += 1) {
    crc ^= text.charCodeAt(index) << 8;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) : (crc << 1);
      crc &= 0xffff;
    }
  }
  return crc.toString(36).padStart(4, '0');
}

function decodeFieldText(value) {
  if (!value) return '';
  try {
    return decodeURIComponent(String(value));
  } catch (error) {
    return '';
  }
}

function decodeBase64UrlUtf8(value) {
  if (!value) return '';
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const source = String(value).replace(/-/g, '+').replace(/_/g, '/').replace(/=+$/, '');
  let buffer = 0;
  let bits = 0;
  const bytes = [];
  for (const character of source) {
    const code = alphabet.indexOf(character);
    if (code < 0) return '';
    buffer = (buffer << 6) | code;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((buffer >> bits) & 0xff);
      buffer = bits === 0 ? 0 : buffer & ((1 << bits) - 1);
    }
  }
  try {
    return decodeURIComponent(bytes.map(byte => `%${byte.toString(16).padStart(2, '0')}`).join(''));
  } catch (error) {
    return '';
  }
}

function decodeDateCode(value) {
  if (!/^\d{5}$/.test(String(value || ''))) return '';
  const yearPart = Number(String(value).slice(0, 2));
  const year = yearPart >= 70 ? 1900 + yearPart : 2000 + yearPart;
  const dayOfYear = Number(String(value).slice(2));
  const maxDay = isLeapYear(year) ? 366 : 365;
  if (dayOfYear < 1 || dayOfYear > maxDay) return '';
  const date = new Date(Date.UTC(year, 0, dayOfYear));
  return date.toISOString().slice(0, 10);
}

function decodeAltitude(value) {
  if (value === '' || value === null || value === undefined) return '';
  const altitude = Number(value) * 100;
  return Number.isFinite(altitude) && altitude >= 0 && altitude <= 5000
    ? `${Math.round(altitude)}m`
    : '';
}

function decodeHarvest(value) {
  if (value === '' || value === null || value === undefined) return '';
  const year = Number(value) + 2024;
  return Number.isInteger(year) && year >= 2000 && year <= 2100 ? String(year) : '';
}

function mapProcessing(process) {
  const code = String(process[0] || '');
  if (['PR-WA', 'PR-ANW', 'PR-SEMI'].includes(code)) return 'washed';
  if (['PR-NA', 'PR-ANN', 'PR-PN'].includes(code)) return 'natural';
  if (['PR-HO', 'PR-BH', 'PR-RH', 'PR-WH', 'PR-YH'].includes(code)) return 'honey';
  return 'other';
}

function uniqueValues(values) {
  return Array.from(new Set(values.map(value => String(value || '').trim()).filter(Boolean)));
}

function compactObject(value) {
  return Object.keys(value).reduce((result, key) => {
    if (value[key] !== '' && value[key] !== null && value[key] !== undefined) result[key] = value[key];
    return result;
  }, {});
}

function isLeapYear(year) {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

module.exports = {
  CODEBOOK_VERSION: String(CODEBOOK.version),
  crc16,
  decodeBrewIonQr,
  isBrewIonQr
};
