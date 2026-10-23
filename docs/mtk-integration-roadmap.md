# MTK Flex serim entegrasyonu yol haritası

## Mevcut adım

MiraApp'e protokolden bağımsız serim veri sözleşmesi eklendi:

- `POST /api/integration/mtk/spreading-runs`: Machine Gateway için API anahtarlı ingest endpoint'i
- `GET /api/integration/mtk/spreading-runs`: Yetkili panel kullanıcısı için serim kayıtları
- `SpreadingRun`: İş emriyle ilişkilendirilebilen, son makine durumunu idempotent saklayan Prisma modeli

Gateway, `MTK_GATEWAY_API_KEY` ortam değişkenini `X-MTK-API-Key` başlığıyla göndermelidir. `externalRunId` aynı kaldığı sürece tekrar gönderilen ölçümler yeni kayıt açmaz.

## Önerilen uygulama sırası

1. Elektrik panosundan PLC marka/modeli, HMI model etiketi ve kullanılabilir port/protokolü tespit et.
2. Gateway'i makine ağına yakın Windows bilgisayarda çalıştır; ilk aşamada yalnızca okuma yap.
3. PLC/HMI dokümanına göre tek bir adapter yaz: Modbus TCP, Siemens S7, OPC UA veya seri haberleşme.
4. Adapter çıktısını bu endpoint'in JSON sözleşmesine dönüştür ve bağlantı kopunca lokal kuyrukla tekrar gönder.
5. Test makinesinde kat sayısı/metre değerlerini ekranla karşılaştır; kalibrasyon ve polling aralığını doğrula.
6. Panelde canlı serim görünümü ve tamamlanınca kesim akışı için ayrı UI/iş akışı ekle.

## Gateway veri örneği

```json
{
  "externalRunId": "MTK-01-2026-09-02-0001",
  "machine": "MTK-01",
  "workOrderNo": "WO-2026-00452",
  "pastelNo": "P-1254",
  "fabricCode": "KMS-00125",
  "color": "Siyah",
  "layerSet": 120,
  "currentLayer": 117,
  "pastelPositionMeter": 0,
  "pastelMeter": 1.11,
  "widthCm": 180,
  "tension": 90,
  "forwardSpeed": 80,
  "reverseSpeed": 60,
  "status": "RUNNING",
  "sourceUpdatedAt": "2026-09-02T14:28:00.000Z"
}
```

PLC/register adresleri doğrulanmadan gerçek bir Modbus veya Siemens adapter'i seçilmemelidir.
