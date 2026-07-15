export const PREFIX = 'COF1:';
export const MAX_QR_TEXT_LENGTH = 4296;
export const MAX_PAYLOAD_BYTES = 4096;
export const MAX_ARRAY_ITEMS = 8;
export const MAX_TEXT_LENGTH = 60;

export const FIELDS = Object.freeze({
  protocolVersion: 1,
  profileId: 2,
  registryId: 3,
  registryVersion: 4,
  registryHash: 5,
  issuerId: 6,
  issuerName: 7,
  keyId: 8,
  batchId: 9,
  issuedAt: 10,
  productName: 11,
  countryQrId: 12,
  entityRoles: 13,
  varietyQrIds: 14,
  processQrIds: 15,
  cropYear: 16,
  roastDate: 17,
  roastLevel: 18,
  netWeightG: 19,
  altitudeMinM: 20,
  altitudeMaxM: 21,
  flavorTagQrIds: 22,
  flavorNotes: 23,
  lotText: 24,
  language: 25,
  customFields: 26
});

export const ENTITY_FIELDS = Object.freeze({
  role: 1,
  qrId: 2,
  text: 3,
  language: 4
});

export const PROFILE_IDS = Object.freeze({
  'single-origin-v1': 1
});

export const PROFILE_NAMES = invert(PROFILE_IDS);

export const ENTITY_ROLES = Object.freeze({
  region: 1,
  farm: 2,
  producer: 3,
  washing_station: 4,
  mill: 5
});

export const ENTITY_ROLE_NAMES = invert(ENTITY_ROLES);

export const ROAST_LEVELS = Object.freeze({
  extremely_light: 1,
  light: 2,
  medium_light: 3,
  medium: 4,
  medium_dark: 5,
  dark: 6
});

export const ROAST_LEVEL_NAMES = invert(ROAST_LEVELS);

function invert(record) {
  return Object.freeze(Object.fromEntries(
    Object.entries(record).map(([key, value]) => [value, key])
  ));
}
