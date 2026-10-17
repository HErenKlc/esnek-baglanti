# Esnek Bağlantı Motoru

**"Kapasite yok" denen trafo merkezine, kısıntı riskini bilerek ne kadar temiz enerji bağlanabilir?**

Climathon 2026 (Siemens × YGA × UP School) · Görev 3 prototipi · Hüseyin Eren Kılıç

Türkiye'de 2024–2025'te 11,6 GW lisanssız GES/RES başvurusunun %65'i kapasite yok denerek reddedildi ([Ember](https://ember-energy.org/latest-insights/turkiye-can-bypass-grid-constraints-with-hybrid-solar-power-plants/grid-connection-capacity-challenges-in-turkiye-and/)). Kapasite, en kötü iki anın (tam üretim + en düşük yük) aynı anda olacağını varsayan statik bir kuralla hesaplanıyor. Bu araç, bir trafo merkezi için gerçek hava ve yük belirsizliğini saat saat simüle ederek esnek (kısılabilir) bağlantıyla kaç MW daha bağlanabileceğini ve bunun yıllık kısıntı bedelini (P50/P90) hesaplar.

## Mimari

```
Veri        Open-Meteo hava (canlı)   EPİAŞ saatlik tüketim     TEİAŞ TM kapasite tablosu
               │                          │                           │
Model       GES modeli (PVWatts)      Yük modeli (YZ):            Ters akış sınırı
                                      LightGBM kantil+conformal
               └──────────────┬───────────┴───────────────────────────┘
Simülasyon          110 senaryo × 8.760 saat, esnek kısıntı kuralı, batarya
                              │
Karar               Kabul edilen kısıntıyı aşmayan en yüksek ek MW (ikiye bölme)
                              │
Anlatım       Pano (risk cümlesi, eğri, ısı haritası)  ·  Gemini planlama notu
```

| Klasör | İçerik |
| --- | --- |
| `model/` | `train.py`: EPİAŞ verisiyle yük kantil modeli, baseline kıyası, 2026 kantil çıktısı |
| `web/src/veri` | Open-Meteo istemcisi, TEİAŞ TM tablosu |
| `web/src/sim` | PVWatts GES modeli, senaryo kurma, kısıntı, batarya, ikiye bölme |
| `web/src/ui` | Bağımlılıksız SVG grafikler |
| `web/api/ozet.ts` | Vercel fonksiyonu: Gemini planlama notu (anahtar sunucuda) |
| `web/tests` | pvlib karşılaştırması ve simülasyon testleri |

## Çalıştırma

```bash
# Model (isteğe bağlı; çıktıları web/public'te hazır)
cd model && pip install pandas numpy lightgbm holidays && python train.py

# Web
cd web && npm install
npm test          # PVWatts = pvlib, simülasyon tutarlılık testleri
npm run dev       # http://localhost:5173
```

**Vercel:** Add New → Project → bu depo → Root Directory `web` → Deploy. İsteğe bağlı ortam değişkenleri: `GEMINI_API_KEY` (Google AI Studio), `GEMINI_MODEL` (varsayılan `gemini-3.8-flash`). Anahtar yoksa planlama notu şablon metinle üretilir.

## Hangi kısım gerçek

| Katman | Kaynak | Durum |
| --- | --- | --- |
| Hava (eğik yüzey ışınımı, sıcaklık, rüzgâr) | Open-Meteo Historical API, ERA5, 2015–2025 | Gerçek, canlı |
| Yük şekli ve belirsizliği | EPİAŞ Şeffaflık Platformu, ulusal saatlik tüketim 2022–2025 | Gerçek |
| TM üst sınırı, tahsisli güç | TEİAŞ lisanssız GES-RES kapasite tablosu (Depar Solar aktarımı; tarih kaynakta yok) | Gerçek |
| TM yük büyüklüğü | Ulusal şeklin kullanıcı tepe değerine ölçeklenmesi | Varsayım |
| Gerilim, N-1, koruma | — | Kapsam dışı |

## Yük modeli: 2025 test yılı (eğitimde görülmedi)

| Yöntem | Pinball kaybı | P5–P95 kapsama | P50 MAPE |
| --- | --- | --- | --- |
| Naif: geçen yılın aynı saati | – | – | %5,28 |
| Ay × saat × gün tipi kantil tablosu | 0,0123 | %83,4 | %4,18 |
| LightGBM kantil | 0,0119 | %67,1 | %3,89 |
| **LightGBM kantil + conformal** | **0,0111** | **%92,6** | **%3,89** |

## Atıf ve lisans

- Hava: [Open-Meteo](https://open-meteo.com) (CC BY 4.0), ERA5 — Copernicus Climate Change Service bilgisi kullanılmıştır.
- Yük: [EPİAŞ Şeffaflık Platformu](https://seffaflik.epias.com.tr); derleme: [ulvi12/Turkiye-Electricity-Prediction](https://github.com/ulvi12/Turkiye-Electricity-Prediction).
- TM kapasiteleri: TEİAŞ, [Depar Solar aktarımı](https://www.deparsolar.com/teias-lisanssiz-ges-res-trafo-kapasiteleri-tahsis-edilen_4-223).
- GES modeli: [pvlib-python](https://github.com/pvlib/pvlib-python) PVWatts ve Faiman modellerinin TypeScript uyarlaması.

Bu bir prototiptir. Gerçek bağlantı kararı için EDAŞ yük ölçümü, gerilim ve koruma etütleri gerekir.
