import { EventEmitter } from 'node:events';
import request from 'supertest';
import { createBridgeApp, parseWeight } from '../bridge-agent/server';

class MockSerialPort extends EventEmitter {
  static instances: MockSerialPort[] = [];
  isOpen = false;

  constructor() {
    super();
    MockSerialPort.instances.push(this);
  }

  open(callback: (error?: Error | null) => void) {
    this.isOpen = true;
    callback(null);
  }

  close(callback: (error?: Error | null) => void) {
    this.isOpen = false;
    callback(null);
    this.emit('close');
  }
}

describe('cutting bridge API', () => {
  let parser: EventEmitter;
  let app: ReturnType<typeof createBridgeApp>;

  beforeEach(() => {
    MockSerialPort.instances = [];
    app = createBridgeApp({
      SerialPortClass: MockSerialPort,
      reconnectDelayMs: 5,
      createParser: () => {
        parser = new EventEmitter();
        return parser;
      },
    });
  });

  it('parses kg and gram readings with decimal commas', () => {
    expect(parseWeight('ST 12,5 kg')).toMatchObject({ weight: 12.5, stable: true });
    expect(parseWeight('850 g')).toMatchObject({ weight: 0.85, stable: false });
    expect(parseWeight('no reading')).toBeNull();
  });

  it('connects to the serial scale and serves its latest reading', async () => {
    await request(app)
      .post('/scale/connect')
      .send({ port: 'COM3', baudRate: 19200 })
      .expect(200);
    await request(app)
      .post('/scale/connect')
      .send({ port: 'COM3', baudRate: 19200 })
      .expect(200);

    parser.emit('data', Buffer.from('ST 12,5 kg\r\n'));
    await request(app)
      .get('/scale/weight')
      .expect(200)
      .expect(({ body }: { body: { weight: number; stable: boolean } }) => {
        expect(body.weight).toBe(12.5);
        expect(body.stable).toBe(true);
      });

    await request(app).post('/scale/disconnect').expect(200);
    await request(app).get('/scale/weight').expect(503);
  });

  it('rejects invalid settings and untrusted browser origins', async () => {
    await request(app)
      .post('/scale/connect')
      .send({ port: 'COM3', baudRate: 1234 })
      .expect(400);

    await request(app)
      .get('/health')
      .set('Origin', 'https://untrusted.example')
      .expect(403);
  });

  it('reconnects after an unexpected serial-port disconnect', async () => {
    await request(app)
      .post('/scale/connect')
      .send({ port: 'COM3', baudRate: 19200 })
      .expect(200);

    const disconnectedPort = MockSerialPort.instances[0];
    disconnectedPort.isOpen = false;
    disconnectedPort.emit('close');

    await request(app).get('/scale/weight').expect(503);
    await new Promise(resolve => setTimeout(resolve, 20));

    expect(MockSerialPort.instances).toHaveLength(2);
    await request(app).get('/health').expect(200).expect(({ body }: { body: { scaleConnected: boolean } }) => {
      expect(body.scaleConnected).toBe(true);
    });
  });
});
