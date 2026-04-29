import {
  validatePayload,
  isTimestampInSeconds,
  isOlderThanTenMinutes,
  ValidationResult,
} from '../../src/atu/validator';
import { AtuPayload } from '../../src/atu/mapper';

describe('ATU Payload Validator', () => {
  // Helper: build a valid payload to modify
  const validPayload = (): AtuPayload => ({
    imei: '435654321239569',
    latitude: -12.228012,
    longitude: -76.931337,
    route_id: '1180',
    ts: Date.now(),
    license_plate: 'ABC123',
    speed: 77.5,
    direction_id: 1,
    driver_id: '12345678',
    tsinitialtrip: Date.now() - 600000,
    identifier: 'm3d3dqfvdfr2ed2d',
  });

  // ===== IMEI TESTS =====
  describe('IMEI Validation', () => {
    it('1. IMEI válido — 15 caracteres alfanuméricos', () => {
      const result = validatePayload(validPayload());
      expect(result.valid).toBe(true);
    });

    it('2. IMEI inválido — menos de 15 caracteres', () => {
      const payload = validPayload();
      payload.imei = '123';
      const result = validatePayload(payload);
      expect(result.valid).toBe(false);
      expect(result.errors[0].code).toBe('06');
    });

    it('3. IMEI inválido — caracteres especiales (guiones)', () => {
      const payload = validPayload();
      payload.imei = '43565-4321239569';
      const result = validatePayload(payload);
      expect(result.valid).toBe(false);
      expect(result.errors[0].code).toBe('06');
    });

    it('3b. IMEI inválido — espacios', () => {
      const payload = validPayload();
      payload.imei = '43565 4321239569';
      const result = validatePayload(payload);
      expect(result.valid).toBe(false);
      expect(result.errors[0].code).toBe('06');
    });
  });

  // ===== LICENSE_PLATE TESTS =====
  describe('License Plate Validation', () => {
    it('4. Placa válida — ABC123', () => {
      const result = validatePayload(validPayload());
      expect(result.valid).toBe(true);
    });

    it('4b. Placa válida — con guion ABC-123', () => {
      const payload = validPayload();
      payload.license_plate = 'ABC-123';
      const result = validatePayload(payload);
      expect(result.valid).toBe(true);
    });

    it('5. Placa inválida — más de 7 caracteres', () => {
      const payload = validPayload();
      payload.license_plate = 'ABC123456';
      const result = validatePayload(payload);
      expect(result.valid).toBe(false);
      expect(result.errors.find(e => e.field === 'license_plate')?.code).toBe('07');
    });

    it('5b. Placa inválida — guión bajo no permitido', () => {
      const payload = validPayload();
      payload.license_plate = 'ABC_123';
      const result = validatePayload(payload);
      expect(result.valid).toBe(false);
      expect(result.errors.find(e => e.field === 'license_plate')?.code).toBe('07');
    });
  });

  // ===== LATITUDE TESTS =====
  describe('Latitude Validation', () => {
    it('6. Latitud válida — -12.228012', () => {
      const result = validatePayload(validPayload());
      expect(result.valid).toBe(true);
    });

    it('7. Latitud fuera de rango — -91', () => {
      const payload = validPayload();
      payload.latitude = -91;
      const result = validatePayload(payload);
      expect(result.valid).toBe(false);
      expect(result.errors.find(e => e.field === 'latitude')?.code).toBe('08');
    });

    it('7b. Latitud fuera de rango — 91', () => {
      const payload = validPayload();
      payload.latitude = 91;
      const result = validatePayload(payload);
      expect(result.valid).toBe(false);
      expect(result.errors.find(e => e.field === 'latitude')?.code).toBe('08');
    });

    it('7c. Latitud válida — 0', () => {
      const payload = validPayload();
      payload.latitude = 0;
      const result = validatePayload(payload);
      expect(result.valid).toBe(true);
    });

    it('7d. Latitud válida — 90', () => {
      const payload = validPayload();
      payload.latitude = 90;
      const result = validatePayload(payload);
      expect(result.valid).toBe(true);
    });
  });

  // ===== LONGITUDE TESTS =====
  describe('Longitude Validation', () => {
    it('8. Longitud válida — -76.931337', () => {
      const result = validatePayload(validPayload());
      expect(result.valid).toBe(true);
    });

    it('9. Longitud fuera de rango — -181', () => {
      const payload = validPayload();
      payload.longitude = -181;
      const result = validatePayload(payload);
      expect(result.valid).toBe(false);
      expect(result.errors.find(e => e.field === 'longitude')?.code).toBe('08');
    });

    it('9b. Longitud fuera de rango — 181', () => {
      const payload = validPayload();
      payload.longitude = 181;
      const result = validatePayload(payload);
      expect(result.valid).toBe(false);
      expect(result.errors.find(e => e.field === 'longitude')?.code).toBe('08');
    });
  });

  // ===== SPEED TESTS =====
  describe('Speed Validation', () => {
    it('10. Velocidad válida — 77.5', () => {
      const result = validatePayload(validPayload());
      expect(result.valid).toBe(true);
    });

    it('11. Velocidad negativa — -1', () => {
      const payload = validPayload();
      payload.speed = -1;
      const result = validatePayload(payload);
      expect(result.valid).toBe(false);
      expect(result.errors.find(e => e.field === 'speed')?.code).toBe('09');
    });

    it('12. Velocidad mayor a 999.99 — 1000', () => {
      const payload = validPayload();
      payload.speed = 1000;
      const result = validatePayload(payload);
      expect(result.valid).toBe(false);
      expect(result.errors.find(e => e.field === 'speed')?.code).toBe('09');
    });

    it('12b. Velocidad límite inferior — 0', () => {
      const payload = validPayload();
      payload.speed = 0;
      const result = validatePayload(payload);
      expect(result.valid).toBe(true);
    });

    it('12c. Velocidad límite superior — 999.99', () => {
      const payload = validPayload();
      payload.speed = 999.99;
      const result = validatePayload(payload);
      expect(result.valid).toBe(true);
    });
  });

  // ===== ROUTE_ID TESTS =====
  describe('Route ID Validation', () => {
    it('13. route_id válido — 1180', () => {
      const result = validatePayload(validPayload());
      expect(result.valid).toBe(true);
    });

    it('14. route_id mayor a 10 caracteres', () => {
      const payload = validPayload();
      payload.route_id = '1180AAAAAAAA';
      const result = validatePayload(payload);
      expect(result.valid).toBe(false);
      expect(result.errors.find(e => e.field === 'route_id')?.code).toBe('12');
    });

    it('14b. route_id con caracteres no permitidos', () => {
      const payload = validPayload();
      payload.route_id = '1180-AAA';
      const result = validatePayload(payload);
      expect(result.valid).toBe(false);
      expect(result.errors.find(e => e.field === 'route_id')?.code).toBe('12');
    });
  });

  // ===== DIRECTION_ID TESTS =====
  describe('Direction ID Validation', () => {
    it('15. direction_id válido — 0 (IDA)', () => {
      const payload = validPayload();
      payload.direction_id = 0;
      const result = validatePayload(payload);
      expect(result.valid).toBe(true);
    });

    it('16. direction_id válido — 1 (VUELTA)', () => {
      const payload = validPayload();
      payload.direction_id = 1;
      const result = validatePayload(payload);
      expect(result.valid).toBe(true);
    });

    it('17. direction_id inválido — 2', () => {
      const payload = validPayload();
      (payload as any).direction_id = 2;
      const result = validatePayload(payload);
      expect(result.valid).toBe(false);
      expect(result.errors.find(e => e.field === 'direction_id')?.code).toBe('13');
    });

    it('17b. direction_id inválido — -1', () => {
      const payload = validPayload();
      (payload as any).direction_id = -1;
      const result = validatePayload(payload);
      expect(result.valid).toBe(false);
      expect(result.errors.find(e => e.field === 'direction_id')?.code).toBe('13');
    });

    it('17c. direction_id inválido — string', () => {
      const payload = validPayload();
      (payload as any).direction_id = 'IDA';
      const result = validatePayload(payload);
      expect(result.valid).toBe(false);
    });
  });

  // ===== DRIVER_ID TESTS =====
  describe('Driver ID Validation', () => {
    it('18. driver_id válido — 12345678', () => {
      const result = validatePayload(validPayload());
      expect(result.valid).toBe(true);
    });

    it('19. driver_id mayor a 20 caracteres', () => {
      const payload = validPayload();
      payload.driver_id = '123456789012345678901';
      const result = validatePayload(payload);
      expect(result.valid).toBe(false);
      expect(result.errors.find(e => e.field === 'driver_id')?.code).toBe('14');
    });
  });

  // ===== IDENTIFIER TESTS =====
  describe('Identifier Validation', () => {
    it('20. identifier válido — 20 caracteres alfanum', () => {
      const payload = validPayload();
      payload.identifier = 'm3d3dqfvdfr2ed2d1234';
      const result = validatePayload(payload);
      expect(result.valid).toBe(true);
    });

    it('21. identifier vacío — string vacío', () => {
      const payload = validPayload();
      payload.identifier = '';
      const result = validatePayload(payload);
      expect(result.valid).toBe(false);
      expect(result.errors.find(e => e.field === 'identifier')?.code).toBe('11');
    });

    it('22. identifier mayor a 50 caracteres', () => {
      const payload = validPayload();
      payload.identifier = 'a'.repeat(51);
      const result = validatePayload(payload);
      expect(result.valid).toBe(false);
      expect(result.errors.find(e => e.field === 'identifier')?.code).toBe('11');
    });

    it('23. identifier con guiones — no permitido', () => {
      const payload = validPayload();
      payload.identifier = 'abc-123-xyz';
      const result = validatePayload(payload);
      expect(result.valid).toBe(false);
      expect(result.errors.find(e => e.field === 'identifier')?.code).toBe('11');
    });
  });

  // ===== TIMESTAMP TESTS =====
  describe('Timestamp Validation', () => {
    it('24. timestamp en milisegundos — válido', () => {
      const payload = validPayload();
      payload.ts = Date.now();
      const result = validatePayload(payload);
      expect(result.valid).toBe(true);
    });

    it('25. timestamp en segundos detectado', () => {
      const payload = validPayload();
      payload.ts = Math.floor(Date.now() / 1000); // seconds, not ms
      const result = validatePayload(payload);
      expect(result.valid).toBe(false);
    });

    it('25b. timestamp decimal — inválido', () => {
      const payload = validPayload();
      payload.ts = Date.now() + 0.5;
      const result = validatePayload(payload);
      expect(result.valid).toBe(false);
      expect(result.errors.find(e => e.field === 'ts')?.code).toBe('01');
    });

    it('26. posición mayor a 10 minutos — validator deja pasar, scheduler expira', () => {
      const payload = validPayload();
      payload.ts = Date.now() - 11 * 60 * 1000; // 11 min ago
      payload.tsinitialtrip = payload.ts - 60000;
      const result = validatePayload(payload);
      expect(result.valid).toBe(true);
    });

    it('26b. timestamp futuro — debe pasar (no se puede detectar fácilmente)', () => {
      const payload = validPayload();
      payload.ts = Date.now() + 1000; // 1 second in future, OK
      const result = validatePayload(payload);
      expect(result.valid).toBe(true);
    });
  });

  // ===== TSINITIALTRIP TESTS =====
  describe('tsinitialtrip Validation', () => {
    it('27. tsinitialtrip mayor que ts — rechazado', () => {
      const payload = validPayload();
      payload.tsinitialtrip = payload.ts + 60000; // tsinitialtrip AFTER ts
      const result = validatePayload(payload);
      expect(result.valid).toBe(false);
    });

    it('27b. tsinitialtrip igual a ts — válido', () => {
      const payload = validPayload();
      payload.tsinitialtrip = payload.ts;
      const result = validatePayload(payload);
      expect(result.valid).toBe(true);
    });

    it('27c. tsinitialtrip en segundos — inválido', () => {
      const payload = validPayload();
      payload.tsinitialtrip = Math.floor(payload.ts / 1000);
      const result = validatePayload(payload);
      expect(result.valid).toBe(false);
      expect(result.errors.find(e => e.field === 'tsinitialtrip')?.code).toBe('01');
    });

    it('27d. tsinitialtrip decimal — inválido', () => {
      const payload = validPayload();
      payload.tsinitialtrip = payload.ts - 1.5;
      const result = validatePayload(payload);
      expect(result.valid).toBe(false);
      expect(result.errors.find(e => e.field === 'tsinitialtrip')?.code).toBe('01');
    });
  });

  // ===== UTILITY FUNCTIONS =====
  describe('Utility Functions', () => {
    it('isTimestampInSeconds — ms válido', () => {
      expect(isTimestampInSeconds(1757119795000)).toBe(false); // ~13 digits = ms
    });

    it('isTimestampInSeconds — segundos detectado', () => {
      expect(isTimestampInSeconds(1757119795)).toBe(true); // 10 digits = seconds
    });

    it('isOlderThanTenMinutes — posición vieja', () => {
      const oldTs = Date.now() - 11 * 60 * 1000;
      expect(isOlderThanTenMinutes(oldTs, 10)).toBe(true);
    });

    it('isOlderThanTenMinutes — posición reciente', () => {
      const recentTs = Date.now() - 5 * 60 * 1000;
      expect(isOlderThanTenMinutes(recentTs, 10)).toBe(false);
    });
  });

  // ===== MULTIPLE ERRORS =====
  describe('Multiple Validation Errors', () => {
    it('varios campos inválidos — reporta todos los errores', () => {
      const payload = validPayload();
      payload.imei = 'BAD';
      payload.latitude = 999;
      payload.speed = -50;
      const result = validatePayload(payload);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThanOrEqual(3);
    });
  });
});
