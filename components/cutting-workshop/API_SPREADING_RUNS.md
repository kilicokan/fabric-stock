# API: Serim makinesi verisi

## Application endpoints

The `GET`, `POST`, and `PATCH` `/api/spreading-runs` endpoints require a valid
`Authorization: Bearer <token>` header. The MTK gateway uses the separate
`POST /api/integration/mtk/spreading-runs` endpoint and its configured gateway
API key.

## PLC connection status

`/api/spreading-runs` is a Prisma/database API, not a PLC client. Its `GET`
reads the latest active row from `SpreadingRun`; `POST` creates a manual run;
`PATCH` changes that row or increments its operator counter. This repository
contains no S7 or Modbus polling/client for the PLC.

`POST /api/integration/mtk/spreading-runs` is an authenticated ingestion endpoint:
an external MTK/PLC gateway must send it readings with `x-mtk-api-key`. It
validates and stores those readings; it does not connect to or poll the machine
itself. The protocol, register/DB address, gateway deployment, and behavior
during PLC/network outages must be confirmed with the equipment/backend team
before claiming automatic PLC counts in a pilot.

## Per-machine kat kaynağı

`SpreadingMachine.layerSource` is configured from Kesim Masaları settings:

- `MANUAL` (default): does not poll the PLC/gateway. The operator uses the
  counter; a valid roll-weight calculation can be applied as a one-time layer
  suggestion.
- `PLC`: reads the active run from the database API, which must be fed by the
  separately configured PLC/MTK gateway. This setting does not add a direct PLC
  client to the bridge.

Existing machines become `MANUAL` when the migration is applied. Set a machine
to `PLC` only after its gateway feed is verified.

Set `NEXT_PUBLIC_CUTTING_DEMO_MODE=false` in the environment used for the
Next.js build to disable the simulated counter. In development the demo is on
by default unless explicitly set to `false`; in production it is off unless
explicitly set to `true`. With demo disabled, the UI reads the database API,
but that alone does not make the data a live PLC feed. If no active run exists,
the API returns `{ "data": null }`; polling errors are shown to the operator.

### `GET /api/spreading-runs?orderId={number}`

Serim başladıktan sonra UI en çok 500 ms aralıkla poll eder (`loadMtkRun`).

### Query

| Parametre | Tip | Zorunlu | Açıklama |
|-----------|-----|---------|----------|
| `orderId` | number | evet | Kesim iş emri id |

### Başarı — 200

```json
{
  "data": {
    "id": 12,
    "machine": "Serim Makinesi 01",
    "status": "SERİM DEVAM EDİYOR",
    "layerSet": 120,
    "currentLayer": 48,
    "pastelMeter": 9.42,
    "pastelPositionMeter": 9.42,
    "widthCm": 180,
    "tension": 90,
    "forwardSpeed": 80,
    "reverseSpeed": 60,
    "sourceUpdatedAt": "2026-09-22T12:00:00.000Z",
    "machineId": 3,
    "cuttingTableId": 1
  }
}
```

Alternatif: gövde doğrudan run nesnesi (`data` sarmalayıcısı olmadan) — istemci her iki biçimi de okur.

### Durum değerleri (önerilen)

| `status` | Anlam |
|----------|--------|
| `HAZIR` | Başlatılmadı |
| `SERİM DEVAM EDİYOR` | Çalışıyor |
| `SERİM TAMAMLANDI` | Kat hedefi doldu / operatör bitirdi |
| `HATA` | PLC/gateway hatası |

### Hata

```json
{ "error": "Serim makinesi verisi alınamadı.", "code": "SPREADING_UNAVAILABLE" }
```

| HTTP | Kullanım |
|------|----------|
| 200 | Run bulundu; run yoksa `{ "data": null }` |
| 502 / 503 | Gateway / PLC |
| 401 | Auth |

### Demo modu

Development ortamında demo modu varsayılan olarak açıktır; production ortamında
varsayılan olarak kapalıdır. `NEXT_PUBLIC_CUTTING_DEMO_MODE=true` demo modunu
açar; `false` ise development ortamında da kapatır. PLC kaynağı seçili demo
makinelerde istemci sayaç simülasyonu kullanılır. Manuel kaynaklı makinelerde
operatör sayacı kullanılır; demo modunda artışlar yalnızca yerel oturumda,
production modunda veritabanında saklanır.

### Operatör sayacı

- Manual-source machines increment through the operator counter and may add an
  unapplied scale estimate for a roll. The suggestion is marked as applied so a
  refresh does not offer it twice.
- `POST /api/spreading-runs` iş emri için aktif serim kaydı yoksa manuel bir kayıt
  açar. İstek gövdesinde `orderId` ve aktif `machineId` bulunmalıdır; makine adı
  ve bağlı kesim masası sunucudaki makine tanımından alınır. Aynı iş emrinde
  aktif kayıt zaten varsa yeni kayıt oluşturmak yerine onu döndürür.
- `PATCH /api/spreading-runs` kat sayacını `{"orderId": 1, "action": "increment",
  "delta": 1, "requestId": "..."}` ile artırır. `requestId` tekrar gönderilirse
  işlem çift sayılmaz.
- `{"orderId": 1, "action": "decrement"}` bir kat düşürür; `action: "set"` ve
  `value` operatör düzeltmesini neden/kullanıcı/zaman bilgisiyle kaydeder.
- `action: "complete"` kaydı `SERİM TAMAMLANDI` olarak kapatır.

### Serim başlatma sınırı

Operatör ekranındaki serim başlatma işlemi veritabanındaki aktif run'ı okur veya
manuel kayıt açar; fiziksel makineye/PLC'ye start komutu göndermez. Makineye
komut gönderme, PLC iletişim protokolü doğrulanmadan uygulanmamalıdır.

### İstemci eşlemesi

`CuttingWorkshopPage` → `loadMtkRun` → `setMtkRun` / `spreadingRunsByOrder`.
Tipler: `types.ts` → `MtkSpreadingRun`, `SpreadingRunApiResponse`.
