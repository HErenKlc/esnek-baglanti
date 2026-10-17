"""Trafo merkezlerine GERÇEK koordinat atar (OpenStreetMap + Open-Meteo geocoding).

Neden: Uygulamada şu an koordinatlar ilçe merkezinin yaklaşık yeri. Hava verisi
santralin kurulacağı noktadan gelmeli. OSM'de Türkiye iletim şebekesi
power=substation etiketiyle haritalı ve açık veri.

Yöntem:
  1. Overpass'tan Türkiye'deki yüksek gerilim trafo sahalarını çek (>=66 kV).
  2. TM adını normalize edip OSM adlarıyla eşleştir (il kontrolü ile).
  3. Eşleşmeyen TM için Open-Meteo geocoding'den ilçe merkezi al (eski davranış).
  4. Her satıra kaynak yaz: "osm" veya "ilce". Dürüstlük tablosu bunu gösterecek.

Girdi:  teias_kalan_01102026.csv  (il,tm,kalan_MWe)  — pdf_tablo.py üretir
Çıktı:  trafo_konum.json          (il, tm, enlem, boylam, kaynak, osm_ad, mesafe_km)

Çalıştırma:  python osm_konum.py
Gereken: internet. Hesap GEREKMİYOR. Overpass'a nazik davranılır (tek sorgu + bekleme).
Lisans: OpenStreetMap katkıcıları, ODbL. Open-Meteo geocoding, CC BY 4.0.
"""
import csv
import json
import re
import sys
import time
import unicodedata
import urllib.parse
import urllib.request
from difflib import SequenceMatcher
from math import asin, cos, radians, sin, sqrt
from pathlib import Path

OVERPASS = "https://overpass-api.de/api/interpreter"
GEOCODE = "https://geocoding-api.open-meteo.com/v1/search"
GIRDI = Path(__file__).with_name("teias_kalan_01102026.csv")
CIKTI = Path(__file__).with_name("trafo_konum.json")

SORGU = """
[out:json][timeout:180];
area["ISO3166-1"="TR"][admin_level=2]->.tr;
(
  node["power"="substation"](area.tr);
  way["power"="substation"](area.tr);
  relation["power"="substation"](area.tr);
);
out center tags;
"""


def sade(s: str) -> str:
    """Karşılaştırma için: Türkçe harfleri sadeleştir, TM/trafo eklerini at."""
    s = s.replace("İ", "i").replace("I", "i").replace("ı", "i").lower()
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode()
    s = re.sub(r"\b(tm|trafo|merkezi|merkez|substation|elektrik|ges|res|osb|havza)\b", " ", s)
    s = re.sub(r"\(.*?\)", " ", s)
    s = re.sub(r"[^a-z0-9]+", " ", s)
    return " ".join(s.split())


def mesafe(a1, b1, a2, b2) -> float:
    r = 6371.0
    da, db = radians(a2 - a1), radians(b2 - b1)
    h = sin(da / 2) ** 2 + cos(radians(a1)) * cos(radians(a2)) * sin(db / 2) ** 2
    return 2 * r * asin(sqrt(h))


def getir(url, veri=None, deneme=3):
    for i in range(deneme):
        try:
            istek = urllib.request.Request(
                url, data=veri.encode() if veri else None,
                headers={"User-Agent": "esnek-baglanti/1.0 (Climathon 2026; akademik)"})
            with urllib.request.urlopen(istek, timeout=240) as y:
                return json.loads(y.read().decode("utf-8"))
        except Exception as e:
            if i == deneme - 1:
                raise
            print(f"  tekrar deneniyor ({e})")
            time.sleep(10 * (i + 1))


def osm_cek():
    print("Overpass'tan Türkiye trafo sahaları çekiliyor (1-3 dakika sürebilir)…")
    c = getir(OVERPASS, "data=" + urllib.parse.quote(SORGU))
    kayit = []
    for e in c.get("elements", []):
        t = e.get("tags", {})
        ad = t.get("name") or t.get("name:tr") or t.get("operator:ref") or ""
        if not ad:
            continue
        gerilim = t.get("voltage", "")
        try:  # ";" ile ayrılmış olabilir: "154000;34500"
            en_yuksek = max(int(v) for v in re.findall(r"\d+", gerilim)) if gerilim else 0
        except ValueError:
            en_yuksek = 0
        if en_yuksek and en_yuksek < 66000:
            continue  # dağıtım seviyesi; bizim TM'ler 154/400 kV
        m = e.get("center") or e
        if m.get("lat") is None:
            continue
        kayit.append({"ad": ad, "sade": sade(ad), "enlem": m["lat"], "boylam": m["lon"],
                      "gerilim": en_yuksek})
    print(f"  {len(kayit)} trafo sahası (adı olan, >=66 kV)")
    return kayit


def ilce_konum(ad: str, il: str, onbellek: dict):
    """Open-Meteo geocoding: TM adından ilçe/yer araması (yedek yöntem)."""
    anahtar = f"{ad}|{il}"
    if anahtar in onbellek:
        return onbellek[anahtar]
    sorgu = re.sub(r"\b(TM|OSB|HAVZA|HES)\b", " ", ad, flags=re.I).strip() or il
    try:
        s = getir(f"{GEOCODE}?" + urllib.parse.urlencode(
            {"name": sorgu, "count": 10, "language": "tr", "countryCode": "TR"}))
        for r in s.get("results", []):
            if sade(r.get("admin1", "")) == sade(il) or sade(r.get("name", "")) == sade(il):
                onbellek[anahtar] = (r["latitude"], r["longitude"], r.get("name", ""))
                break
        else:
            r = (s.get("results") or [None])[0]
            onbellek[anahtar] = (r["latitude"], r["longitude"], r.get("name", "")) if r else None
    except Exception as e:
        print(f"  ! {ad}: geocoding hatası {e}")
        onbellek[anahtar] = None
    time.sleep(0.3)  # Open-Meteo'ya nazik ol
    return onbellek[anahtar]


def main():
    if not GIRDI.exists():
        sys.exit(f"{GIRDI.name} yok. Önce pdf_tablo.py çalıştır.")
    trafolar = list(csv.DictReader(GIRDI.open(encoding="utf-8")))
    print(f"{len(trafolar)} trafo merkezi okundu")

    osm = osm_cek()
    onbellek, sonuc, sayac = {}, [], {"osm": 0, "ilce": 0, "yok": 0}

    for t in trafolar:
        hedef = sade(t["tm"])
        en_iyi, en_puan = None, 0.0
        for o in osm:
            p = SequenceMatcher(None, hedef, o["sade"]).ratio()
            if hedef and o["sade"] and (hedef in o["sade"] or o["sade"] in hedef):
                p = max(p, 0.92)
            if p > en_puan:
                en_iyi, en_puan = o, p
        kayit = {"il": t["il"], "tm": t["tm"], "kalan_MWe": float(t["kalan_MWe"])}
        if en_iyi and en_puan >= 0.88:
            kayit.update(enlem=round(en_iyi["enlem"], 5), boylam=round(en_iyi["boylam"], 5),
                         kaynak="osm", osm_ad=en_iyi["ad"], osm_gerilim=en_iyi["gerilim"],
                         benzerlik=round(en_puan, 3))
            sayac["osm"] += 1
        else:
            k = ilce_konum(t["tm"], t["il"], onbellek)
            if k:
                kayit.update(enlem=round(k[0], 5), boylam=round(k[1], 5), kaynak="ilce",
                             yer=k[2], benzerlik=round(en_puan, 3))
                sayac["ilce"] += 1
            else:
                kayit.update(kaynak="yok")
                sayac["yok"] += 1
        sonuc.append(kayit)
        if len(sonuc) % 50 == 0:
            print(f"  {len(sonuc)}/{len(trafolar)} … osm={sayac['osm']} ilce={sayac['ilce']}")

    CIKTI.write_text(json.dumps(sonuc, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"\nYazıldı: {CIKTI.name}")
    print(f"  OSM'den gerçek konum : {sayac['osm']}")
    print(f"  ilçe merkezi yaklaşık: {sayac['ilce']}")
    print(f"  konum bulunamadı     : {sayac['yok']}")


if __name__ == "__main__":
    main()
