// TEİAŞ "Lisanssız GES-RES trafo kapasiteleri (tahsis edilen)" tablosundan Konya ve Karaman satırları.
// Kaynak: TEİAŞ yayını, Depar Solar aktarımı (deparsolar.com). Tablo tarihi kaynakta belirtilmemiş;
// TEİAŞ listeyi her ayın ilk haftası günceller. "*" işaretli satırlar kesinleşmemiş.
// tahsis = çağrı mektubu verilmiş (bağlı / bağlanacak kabul edilir), maks = TM için yayımlanan üst sınır.

export interface Trafo {
  ad: string;
  il: "KONYA" | "KARAMAN";
  tahsisMW: number;
  maksMW: number;
  kesin: boolean;
  enlem: number;
  boylam: number;
}

// Koordinatlar ilçe merkezi yaklaşığıdır (hava verisi çekmek için yeterli; TM'nin tam yeri değil).
export const TRAFOLAR: Trafo[] = [
  { ad: "Akşehir TM", il: "KONYA", tahsisMW: 12, maksMW: 12, kesin: true, enlem: 38.36, boylam: 31.42 },
  { ad: "Alibeyhöyüğü TM", il: "KONYA", tahsisMW: 44, maksMW: 44, kesin: true, enlem: 37.6, boylam: 33.0 },
  { ad: "Altınekin TM", il: "KONYA", tahsisMW: 25, maksMW: 25, kesin: true, enlem: 38.31, boylam: 32.87 },
  { ad: "Beyşehir TM", il: "KONYA", tahsisMW: 15, maksMW: 26, kesin: true, enlem: 37.68, boylam: 31.72 },
  { ad: "Cihanbeyli TM", il: "KONYA", tahsisMW: 22, maksMW: 22, kesin: true, enlem: 38.66, boylam: 32.93 },
  { ad: "Çumra TM", il: "KONYA", tahsisMW: 20, maksMW: 26, kesin: true, enlem: 37.57, boylam: 32.77 },
  { ad: "Ereğli TM", il: "KONYA", tahsisMW: 15, maksMW: 28, kesin: true, enlem: 37.51, boylam: 34.05 },
  { ad: "Güneysınır TM", il: "KONYA", tahsisMW: 35, maksMW: 35, kesin: true, enlem: 37.27, boylam: 32.73 },
  { ad: "Ilgın TM", il: "KONYA", tahsisMW: 20, maksMW: 20, kesin: true, enlem: 38.28, boylam: 31.91 },
  { ad: "Karapınar TM", il: "KONYA", tahsisMW: 51, maksMW: 72, kesin: true, enlem: 37.72, boylam: 33.55 },
  { ad: "Kızören TM", il: "KONYA", tahsisMW: 46.008, maksMW: 46.008, kesin: true, enlem: 38.25, boylam: 33.19 },
  { ad: "Kolukısa TM", il: "KONYA", tahsisMW: 25, maksMW: 25, kesin: true, enlem: 38.17, boylam: 32.95 },
  { ad: "Konya-1 TM", il: "KONYA", tahsisMW: 7, maksMW: 20, kesin: false, enlem: 37.87, boylam: 32.49 },
  { ad: "Konya-2 TM", il: "KONYA", tahsisMW: 15, maksMW: 30, kesin: false, enlem: 37.9, boylam: 32.5 },
  { ad: "Konya-3 TM", il: "KONYA", tahsisMW: 30, maksMW: 50, kesin: false, enlem: 37.95, boylam: 32.52 },
  { ad: "Konya-4 TM", il: "KONYA", tahsisMW: 8, maksMW: 30, kesin: false, enlem: 37.84, boylam: 32.42 },
  { ad: "Kulu TM", il: "KONYA", tahsisMW: 17, maksMW: 17, kesin: true, enlem: 39.09, boylam: 33.08 },
  { ad: "Ladik TM", il: "KONYA", tahsisMW: 14, maksMW: 14, kesin: true, enlem: 38.2, boylam: 32.4 },
  { ad: "Seydişehir TM", il: "KONYA", tahsisMW: 25, maksMW: 25, kesin: true, enlem: 37.42, boylam: 31.85 },
  { ad: "Yunak TM", il: "KONYA", tahsisMW: 16, maksMW: 16, kesin: true, enlem: 38.82, boylam: 31.73 },
  { ad: "Karaman OSB TM", il: "KARAMAN", tahsisMW: 22, maksMW: 24, kesin: true, enlem: 37.2, boylam: 33.17 },
  { ad: "Karaman TM", il: "KARAMAN", tahsisMW: 20, maksMW: 32, kesin: true, enlem: 37.18, boylam: 33.22 },
  { ad: "Ayrancı (geçici) TM", il: "KARAMAN", tahsisMW: 8, maksMW: 8, kesin: true, enlem: 37.36, boylam: 33.83 },
];

export const TRAFO_KAYNAK =
  "TEİAŞ, Lisanssız GES-RES Trafo Kapasiteleri (Tahsis Edilen); Depar Solar aktarımı. Tablo tarihi kaynakta yok.";
