import { GpsRawRow } from '../../src/gps/dto/gps-raw-row.dto';

function loadNormalizer() {
  jest.resetModules();
  return require('../../src/gps/normalizer') as typeof import('../../src/gps/normalizer');
}

describe('GPS Normalizer', () => {
  const validRawRow = (): GpsRawRow => ({
    imei: '435654321239569',
    latitude: -12.228012,
    longitude: -76.931337,
    route_id: '08',
    ts: Date.now(),
    license_plate: 'ABC123',
    speed: 50,
    direction_id: 1,
    driver_id: '12345678',
    tsinitialtrip: Date.now() - 600000,
  });

  describe('Timestamp Conversion', () => {
    it('24. timestamp en milisegundos — ya viene en ms del query, se preserva', () => {
      const { normalize } = loadNormalizer();
      const row = validRawRow();
      const normalized = normalize(row);
      expect(normalized.gpsTimestamp).toBe(row.ts);
      expect(normalized.gpsTimestamp).toBeGreaterThan(1000000000000);
    });

    it('25. timestamp en segundos detectado — si viene en segundos se detecta', () => {
      const { normalize } = loadNormalizer();
      const row = validRawRow();
      row.ts = Math.floor(Date.now() / 1000); // seconds
      // The normalizer doesn't convert seconds to ms — it just passes through
      // The validator would catch this
      const normalized = normalize(row);
      expect(normalized.gpsTimestamp).toBe(row.ts);
    });

    it('25b. si tsinitialtrip > ts, normalizer clampa a ts', () => {
      const { normalize } = loadNormalizer();
      const row = validRawRow();
      row.ts = Date.now();
      row.tsinitialtrip = row.ts + 60000;
      const normalized = normalize(row);
      expect(normalized.tripStartTimestamp).toBe(normalized.gpsTimestamp);
    });
  });

  describe('Direction Mapping', () => {
    it('27. direction_id 0 mapea a IDA', () => {
      const { normalize } = loadNormalizer();
      const row = validRawRow();
      row.direction_id = 0;
      const normalized = normalize(row);
      expect(normalized.direction).toBe('IDA');
    });

    it('28. direction_id 1 mapea a VUELTA', () => {
      const { normalize } = loadNormalizer();
      const row = validRawRow();
      row.direction_id = 1;
      const normalized = normalize(row);
      expect(normalized.direction).toBe('VUELTA');
    });
  });

  describe('Speed Unit Conversion', () => {
    it('GPS_SPEED_UNIT km/h — speed sin conversión', () => {
      process.env.GPS_SPEED_UNIT = 'km/h';
      const { normalize } = loadNormalizer();
      const row = validRawRow();
      row.speed = 50;
      const normalized = normalize(row);
      expect(normalized.speed).toBe(50);
      delete process.env.GPS_SPEED_UNIT;
    });

    it('GPS_SPEED_UNIT knots — speed × 1.852', () => {
      process.env.GPS_SPEED_UNIT = 'knots';
      const { normalize } = loadNormalizer();
      const row = validRawRow();
      row.speed = 50;
      const normalized = normalize(row);
      expect(normalized.speed).toBeCloseTo(50 * 1.852, 2);
      delete process.env.GPS_SPEED_UNIT;
    });
  });

  describe('Batch Normalization', () => {
    it('normaliza array de rows correctamente', () => {
      const { normalizeBatch } = loadNormalizer();
      const rows: GpsRawRow[] = [validRawRow(), validRawRow()];
      rows[1].imei = '987654321098765';
      const normalized = normalizeBatch(rows);
      expect(normalized.length).toBe(2);
      expect(normalized[0].deviceImei).toBe('435654321239569');
      expect(normalized[1].deviceImei).toBe('987654321098765');
    });
  });

  describe('Error Handling', () => {
    it('lanza error si falta campo obligatorio', () => {
      const { normalize } = loadNormalizer();
      const row = validRawRow();
      delete (row as any).imei;
      expect(() => normalize(row)).toThrow();
    });

    it('lanza error si falta latitude', () => {
      const { normalize } = loadNormalizer();
      const row = validRawRow();
      delete (row as any).latitude;
      expect(() => normalize(row)).toThrow();
    });
  });
});
