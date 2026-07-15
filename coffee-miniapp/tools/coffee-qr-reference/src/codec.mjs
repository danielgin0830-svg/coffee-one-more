import cbor from 'cbor';
import base45 from 'base45-js';
import { createPrivateKey, createPublicKey, KeyObject } from 'node:crypto';
import {
  Algorithms,
  Headers,
  ProtectedHeaders,
  Sign1,
  UnprotectedHeaders
} from '@auth0/cose';

import {
  ENTITY_FIELDS,
  ENTITY_ROLE_NAMES,
  ENTITY_ROLES,
  FIELDS,
  MAX_ARRAY_ITEMS,
  MAX_PAYLOAD_BYTES,
  MAX_QR_TEXT_LENGTH,
  MAX_TEXT_LENGTH,
  PREFIX,
  PROFILE_IDS,
  PROFILE_NAMES,
  ROAST_LEVEL_NAMES,
  ROAST_LEVELS
} from './schema.mjs';

const KNOWN_FIELD_TAGS = new Set(Object.values(FIELDS));

export async function encodeCoffeeQr(batch, { privateKey } = {}) {
  if (!privateKey) throw new Error('privateKey is required');

  const normalized = normalizeBatch(batch);
  const payload = cbor.encodeCanonical(normalized);
  if (payload.length > MAX_PAYLOAD_BYTES) {
    throw new Error(`payload exceeds ${MAX_PAYLOAD_BYTES} bytes`);
  }

  const protectedHeaders = new ProtectedHeaders([
    [Headers.Algorithm, Algorithms.EdDSA],
    [Headers.KeyID, Buffer.from(batch.keyId, 'utf8')]
  ]);
  const signed = await Sign1.sign(
    protectedHeaders,
    new UnprotectedHeaders([]),
    payload,
    normalizePrivateKey(privateKey)
  );
  const text = `${PREFIX}${base45.encode(signed.encode())}`;

  if (text.length > MAX_QR_TEXT_LENGTH) {
    throw new Error(`QR text exceeds ${MAX_QR_TEXT_LENGTH} characters`);
  }

  return {
    text,
    payload,
    cose: Buffer.from(signed.encode())
  };
}

export async function decodeCoffeeQr(text, { publicKey } = {}) {
  if (typeof text !== 'string' || !text.startsWith(PREFIX)) {
    throw new Error('unsupported coffee QR prefix');
  }
  if (text.length > MAX_QR_TEXT_LENGTH) {
    throw new Error(`QR text exceeds ${MAX_QR_TEXT_LENGTH} characters`);
  }

  let signed;
  try {
    signed = Sign1.decode(base45.decode(text.slice(PREFIX.length)));
  } catch (error) {
    throw new Error(`invalid COF1 envelope: ${error.message}`);
  }

  if (signed.payload.length > MAX_PAYLOAD_BYTES) {
    throw new Error(`payload exceeds ${MAX_PAYLOAD_BYTES} bytes`);
  }

  let decoded;
  try {
    decoded = cbor.decodeFirstSync(signed.payload, { preferMap: true });
  } catch (error) {
    throw new Error(`invalid CBOR payload: ${error.message}`);
  }

  const batch = decodeBatchMap(decoded);
  let signatureStatus = 'pending';
  let verificationError = '';

  if (publicKey) {
    try {
      await signed.verify(normalizePublicKey(publicKey), { algorithms: [Algorithms.EdDSA] });
      signatureStatus = 'verified';
    } catch (error) {
      signatureStatus = 'invalid';
      verificationError = error.message;
    }
  }

  return {
    batch,
    signatureStatus,
    issuerStatus: 'unknown',
    verificationError,
    payload: Buffer.from(signed.payload),
    unknownFields: collectUnknownFields(decoded)
  };
}

export function normalizeBatch(batch) {
  requireObject(batch, 'batch');

  const protocolVersion = requireInteger(batch.protocolVersion, 'protocolVersion', 1, 1);
  const profileId = PROFILE_IDS[requireString(batch.profileId, 'profileId', 32)];
  if (!profileId) throw new Error('unsupported profileId');

  const registryHash = parseSha256(batch.registryHash);
  const issuedAt = parseTimestamp(batch.issuedAt, 'issuedAt');
  const roastDate = parseDateAsEpochDay(batch.roastDate, 'roastDate');
  const roastLevel = ROAST_LEVELS[requireString(batch.roastLevel, 'roastLevel', 24)];
  if (!roastLevel) throw new Error('unsupported roastLevel');

  const map = new Map([
    [FIELDS.protocolVersion, protocolVersion],
    [FIELDS.profileId, profileId],
    [FIELDS.registryId, requireString(batch.registryId, 'registryId', 40)],
    [FIELDS.registryVersion, requireString(batch.registryVersion, 'registryVersion', 24)],
    [FIELDS.registryHash, registryHash],
    [FIELDS.issuerId, requireString(batch.issuerId, 'issuerId', 40)],
    [FIELDS.issuerName, requireString(batch.issuerName, 'issuerName', 32)],
    [FIELDS.keyId, requireString(batch.keyId, 'keyId', 32)],
    [FIELDS.batchId, requireString(batch.batchId, 'batchId', 40)],
    [FIELDS.issuedAt, issuedAt],
    [FIELDS.productName, requireString(batch.productName, 'productName', MAX_TEXT_LENGTH)],
    [FIELDS.countryQrId, requireInteger(batch.countryQrId, 'countryQrId', 1, 0xffffffff)],
    [FIELDS.entityRoles, normalizeEntityRoles(batch.entityRoles || [])],
    [FIELDS.varietyQrIds, normalizeQrIdArray(batch.varietyQrIds || [], 'varietyQrIds')],
    [FIELDS.processQrIds, normalizeQrIdArray(batch.processQrIds, 'processQrIds', true)],
    [FIELDS.roastDate, roastDate],
    [FIELDS.roastLevel, roastLevel],
    [FIELDS.flavorNotes, requireString(batch.flavorNotes, 'flavorNotes', MAX_TEXT_LENGTH)],
    [FIELDS.language, requireString(batch.language, 'language', 16)]
  ]);

  setOptional(map, FIELDS.cropYear, optionalString(batch.cropYear, 'cropYear', 16));
  setOptional(map, FIELDS.netWeightG, optionalInteger(batch.netWeightG, 'netWeightG', 1, 100000));
  setOptional(map, FIELDS.altitudeMinM, optionalInteger(batch.altitudeMinM, 'altitudeMinM', -500, 10000));
  setOptional(map, FIELDS.altitudeMaxM, optionalInteger(batch.altitudeMaxM, 'altitudeMaxM', -500, 10000));
  setOptional(map, FIELDS.flavorTagQrIds, normalizeQrIdArray(batch.flavorTagQrIds || [], 'flavorTagQrIds'));
  setOptional(map, FIELDS.lotText, optionalString(batch.lotText, 'lotText', 40));
  setOptional(map, FIELDS.customFields, normalizeCustomFields(batch.customFields));

  const min = map.get(FIELDS.altitudeMinM);
  const max = map.get(FIELDS.altitudeMaxM);
  if (min !== undefined && max !== undefined && min > max) {
    throw new Error('altitudeMinM cannot exceed altitudeMaxM');
  }

  return map;
}

function decodeBatchMap(map) {
  if (!(map instanceof Map)) throw new Error('COF1 payload must be a CBOR map');

  const profileName = PROFILE_NAMES[map.get(FIELDS.profileId)];
  const roastLevelName = ROAST_LEVEL_NAMES[map.get(FIELDS.roastLevel)];
  if (map.get(FIELDS.protocolVersion) !== 1 || !profileName || !roastLevelName) {
    throw new Error('unsupported COF1 profile or enum value');
  }

  const result = {
    protocolVersion: map.get(FIELDS.protocolVersion),
    profileId: profileName,
    registryId: map.get(FIELDS.registryId),
    registryVersion: map.get(FIELDS.registryVersion),
    registryHash: `sha256:${Buffer.from(map.get(FIELDS.registryHash)).toString('hex')}`,
    issuerId: map.get(FIELDS.issuerId),
    issuerName: map.get(FIELDS.issuerName),
    keyId: map.get(FIELDS.keyId),
    batchId: map.get(FIELDS.batchId),
    issuedAt: new Date(map.get(FIELDS.issuedAt) * 1000).toISOString(),
    productName: map.get(FIELDS.productName),
    countryQrId: map.get(FIELDS.countryQrId),
    entityRoles: decodeEntityRoles(map.get(FIELDS.entityRoles)),
    varietyQrIds: map.get(FIELDS.varietyQrIds),
    processQrIds: map.get(FIELDS.processQrIds),
    roastDate: epochDayToDate(map.get(FIELDS.roastDate)),
    roastLevel: roastLevelName,
    flavorNotes: map.get(FIELDS.flavorNotes),
    language: map.get(FIELDS.language)
  };

  copyOptional(map, result, FIELDS.cropYear, 'cropYear');
  copyOptional(map, result, FIELDS.netWeightG, 'netWeightG');
  copyOptional(map, result, FIELDS.altitudeMinM, 'altitudeMinM');
  copyOptional(map, result, FIELDS.altitudeMaxM, 'altitudeMaxM');
  copyOptional(map, result, FIELDS.flavorTagQrIds, 'flavorTagQrIds');
  copyOptional(map, result, FIELDS.lotText, 'lotText');
  copyOptional(map, result, FIELDS.customFields, 'customFields');

  normalizeBatch(result);
  return result;
}

function normalizeEntityRoles(items) {
  if (!Array.isArray(items) || items.length > MAX_ARRAY_ITEMS) {
    throw new Error(`entityRoles must contain at most ${MAX_ARRAY_ITEMS} items`);
  }

  return items.map((item, index) => {
    requireObject(item, `entityRoles[${index}]`);
    const role = ENTITY_ROLES[item.role];
    if (!role) throw new Error(`unsupported entity role at entityRoles[${index}]`);
    const qrId = requireInteger(item.qrId, `entityRoles[${index}].qrId`, 0, 0xffffffff);
    const map = new Map([
      [ENTITY_FIELDS.role, role],
      [ENTITY_FIELDS.qrId, qrId]
    ]);

    if (qrId === 0) {
      map.set(ENTITY_FIELDS.text, requireString(item.text, `entityRoles[${index}].text`, MAX_TEXT_LENGTH));
      map.set(ENTITY_FIELDS.language, requireString(item.language, `entityRoles[${index}].language`, 16));
    }
    return map;
  });
}

function decodeEntityRoles(items) {
  if (!Array.isArray(items)) throw new Error('entityRoles must be an array');
  return items.map((item, index) => {
    if (!(item instanceof Map)) throw new Error(`entityRoles[${index}] must be a map`);
    const role = ENTITY_ROLE_NAMES[item.get(ENTITY_FIELDS.role)];
    if (!role) throw new Error(`unsupported entity role at entityRoles[${index}]`);
    const decoded = { role, qrId: item.get(ENTITY_FIELDS.qrId) };
    if (decoded.qrId === 0) {
      decoded.text = item.get(ENTITY_FIELDS.text);
      decoded.language = item.get(ENTITY_FIELDS.language);
    }
    return decoded;
  });
}

function normalizeQrIdArray(items, field, required = false) {
  if (!Array.isArray(items) || items.length > MAX_ARRAY_ITEMS || (required && items.length === 0)) {
    throw new Error(`${field} must contain ${required ? '1-' : '0-'}${MAX_ARRAY_ITEMS} items`);
  }
  return items.map((value, index) => requireInteger(value, `${field}[${index}]`, 1, 0xffffffff));
}

function normalizeCustomFields(value) {
  if (value === undefined || value === null) return undefined;
  requireObject(value, 'customFields');
  const entries = Object.entries(value);
  if (entries.length > 8) throw new Error('customFields must contain at most 8 entries');
  const result = new Map();
  for (const [key, item] of entries) {
    result.set(requireString(key, 'custom field name', 24), requireString(item, `customFields.${key}`, MAX_TEXT_LENGTH));
  }
  return result.size ? result : undefined;
}

function collectUnknownFields(map) {
  const result = new Map();
  for (const [key, value] of map.entries()) {
    if (!KNOWN_FIELD_TAGS.has(key)) result.set(key, value);
  }
  return result;
}

function parseSha256(value) {
  const text = requireString(value, 'registryHash', 71);
  if (!/^sha256:[0-9a-f]{64}$/i.test(text)) {
    throw new Error('registryHash must use sha256:<64 hex characters>');
  }
  return Buffer.from(text.slice(7), 'hex');
}

function parseTimestamp(value, field) {
  const timestamp = Date.parse(requireString(value, field, 32));
  if (!Number.isFinite(timestamp)) throw new Error(`${field} must be an ISO 8601 timestamp`);
  return Math.floor(timestamp / 1000);
}

function parseDateAsEpochDay(value, field) {
  const text = requireString(value, field, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) throw new Error(`${field} must use YYYY-MM-DD`);
  const timestamp = Date.parse(`${text}T00:00:00Z`);
  if (!Number.isFinite(timestamp) || new Date(timestamp).toISOString().slice(0, 10) !== text) {
    throw new Error(`${field} is not a valid calendar date`);
  }
  return Math.floor(timestamp / 86400000);
}

function epochDayToDate(value) {
  return new Date(requireInteger(value, 'roastDate', 0, 1000000) * 86400000).toISOString().slice(0, 10);
}

function requireString(value, field, maxLength) {
  if (typeof value !== 'string' || value.length === 0 || [...value].length > maxLength) {
    throw new Error(`${field} must contain 1-${maxLength} Unicode characters`);
  }
  return value;
}

function optionalString(value, field, maxLength) {
  if (value === undefined || value === null || value === '') return undefined;
  return requireString(value, field, maxLength);
}

function requireInteger(value, field, min, max) {
  if (!Number.isSafeInteger(value) || value < min || value > max) {
    throw new Error(`${field} must be an integer from ${min} to ${max}`);
  }
  return value;
}

function optionalInteger(value, field, min, max) {
  if (value === undefined || value === null || value === '') return undefined;
  return requireInteger(value, field, min, max);
}

function requireObject(value, field) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || value instanceof Map) {
    throw new Error(`${field} must be an object`);
  }
  return value;
}

function setOptional(map, key, value) {
  if (value !== undefined && (!Array.isArray(value) || value.length > 0)) map.set(key, value);
}

function copyOptional(map, result, key, name) {
  if (map.has(key)) result[name] = map.get(key);
}

function normalizePrivateKey(key) {
  return key instanceof KeyObject ? key : createPrivateKey(key);
}

function normalizePublicKey(key) {
  return key instanceof KeyObject ? key : createPublicKey(key);
}
