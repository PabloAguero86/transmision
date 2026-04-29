import { buildAtuPayload } from '../../src/atu/mapper';
import { GpsPosition } from '../../src/gps/dto/gps-position.dto';

describe('ATU Payload Mapper', () => {
  const validPosition = (): GpsPosition => ({
    deviceImei: '435654321239569',
    plate: 'ABC123',
    latitude: -12.228012,
    longitude: -76.931337,
    speed: 77.5,
    gpsTimestamp: 1757119795000,
    routeCode: '1180',
    direction: 'VUELTA',
    driverDocument: '12345678',
    tripStartTimestamp: 1757097480000,
  });

  it('construye payload con todos los 11 campos', () => {
    const position = validPosition();
    const payload = buildAtuPayload(position);
    expect(payload).toHaveProperty('imei');
    expect(payload).toHaveProperty('latitude');
    expect(payload).toHaveProperty('longitude');
    expect(payload).toHaveProperty('route_id');
    expect(payload).toHaveProperty('ts');
    expect(payload).toHaveProperty('license_plate');
    expect(payload).toHaveProperty('speed');
    expect(payload).toHaveProperty('direction_id');
    expect(payload).toHaveProperty('driver_id');
    expect(payload).toHaveProperty('tsinitialtrip');
    expect(payload).toHaveProperty('identifier');
  });

  it('IMEI como string — no number', () => {
    const position = validPosition();
    const payload = buildAtuPayload(position);
    expect(typeof payload.imei).toBe('string');
  });

  it('direction_id = 0 para IDA', () => {
    const position = validPosition();
    position.direction = 'IDA';
    const payload = buildAtuPayload(position);
    expect(payload.direction_id).toBe(0);
  });

  it('direction_id = 1 para VUELTA', () => {
    const position = validPosition();
    position.direction = 'VUELTA';
    const payload = buildAtuPayload(position);
    expect(payload.direction_id).toBe(1);
  });

  it('identifier auto-generado si no existe', () => {
    const position = validPosition();
    const payload = buildAtuPayload(position);
    expect(payload.identifier).toBeTruthy();
    expect(payload.identifier.length).toBeGreaterThan(0);
    // Should be alphanumeric
    expect(/^[A-Za-z0-9]+$/.test(payload.identifier)).toBe(true);
  });

  it('identifier preservado si se pasa', () => {
    const position = validPosition();
    const customId = 'mycustomidentifier123';
    const payload = buildAtuPayload(position, customId);
    expect(payload.identifier).toBe(customId);
  });

  it('ts y tsinitialtrip como numbers en ms', () => {
    const position = validPosition();
    const payload = buildAtuPayload(position);
    expect(typeof payload.ts).toBe('number');
    expect(typeof payload.tsinitialtrip).toBe('number');
    // Should be ~13 digits (ms)
    expect(payload.ts).toBeGreaterThan(1000000000000);
    expect(payload.tsinitialtrip).toBeGreaterThan(1000000000000);
  });

  it('route_id mapeado desde routeCode', () => {
    const position = validPosition();
    position.routeCode = '9999';
    const payload = buildAtuPayload(position);
    expect(payload.route_id).toBe('9999');
  });

  it('license_plate mapeado desde plate', () => {
    const position = validPosition();
    position.plate = 'XYZ999';
    const payload = buildAtuPayload(position);
    expect(payload.license_plate).toBe('XYZ999');
  });

  it('driver_id mapeado desde driverDocument', () => {
    const position = validPosition();
    position.driverDocument = 'DNI12345678';
    const payload = buildAtuPayload(position);
    expect(payload.driver_id).toBe('DNI12345678');
  });

  it('trim en campos string mapeados', () => {
    const position = validPosition();
    position.deviceImei = ' 435654321239569 ';
    position.routeCode = ' 1180 ';
    position.plate = ' ABC123 ';
    position.driverDocument = ' 12345678 ';
    const payload = buildAtuPayload(position, ' custom123 ');
    expect(payload.imei).toBe('435654321239569');
    expect(payload.route_id).toBe('1180');
    expect(payload.license_plate).toBe('ABC123');
    expect(payload.driver_id).toBe('12345678');
    expect(payload.identifier).toBe('custom123');
  });

  it('valores de ejemplo del manual ATU', () => {
    const position: GpsPosition = {
      deviceImei: '435654321239569',
      plate: 'ABC123',
      latitude: -12.228012,
      longitude: -76.931337,
      speed: 77.5,
      gpsTimestamp: 1757119795000,
      routeCode: '1180',
      direction: 'VUELTA',
      driverDocument: '12345678',
      tripStartTimestamp: 1757097480000,
    };
    const payload = buildAtuPayload(position);
    expect(payload.imei).toBe('435654321239569');
    expect(payload.latitude).toBe(-12.228012);
    expect(payload.longitude).toBe(-76.931337);
    expect(payload.route_id).toBe('1180');
    expect(payload.ts).toBe(1757119795000);
    expect(payload.license_plate).toBe('ABC123');
    expect(payload.speed).toBe(77.5);
    expect(payload.direction_id).toBe(1);
    expect(payload.driver_id).toBe('12345678');
    expect(payload.tsinitialtrip).toBe(1757097480000);
  });
});
