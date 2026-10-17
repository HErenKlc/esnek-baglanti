// Vercel sunucu fonksiyonu: simülasyon sonuçlarını Gemini ile planlama notuna çevirir.
// Anahtar sadece sunucuda: Vercel → Project Settings → Environment Variables → GEMINI_API_KEY
// Yağmur'un önerisi: LLM tahmin ürününün yerine geçmez; uyarı metni ve rapor özeti üretir.
import type { VercelRequest, VercelResponse } from "@vercel/node";

const MODEL = process.env.GEMINI_MODEL || "gemini-3.8-flash";

const TALIMAT = `Sen Türkiye'de bir elektrik dağıtım şirketinde (EDAŞ) şebeke planlama mühendisisin.
Sana bir trafo merkezi için esnek (kısılabilir) GES bağlantısı simülasyonunun sonuçları JSON olarak verilecek.
Türkçe, en fazla 4 kısa paragrafta bir planlama notu yaz:
1) Durum: statik kurala göre ne görünüyor, esnek bağlantıyla ne değişiyor.
2) Risk: kısıntının P50/P90 değerleri ne demek; yatırımcı için anlamı.
3) Öneri: ne kadar MW, hangi koşulla (kısıntı sınırı, batarya), tek somut adım.
4) Dikkat: bu analizin modellemediği şey (gerilim, N-1, koruma) ve TM yükünün varsayım olduğu.
Kurallar: JSON'da olmayan hiçbir sayı yazma. Sayıları Türkçe biçimde yaz (virgüllü ondalık). Abartma, reklam dili kullanma.`;

function sablon(o: any): string {
  const y = (x: number) => `%${(x * 100).toFixed(1).replace(".", ",")}`;
  return [
    `${o.trafo}: statik kurala göre ${o.statik_kalan_MW} MW boş görünüyor. Esnek bağlantıyla ${o.esnek_ek_MW} MW ek GES bağlanabilir.`,
    `Bu güçte yeni projenin yıllık kısıntısı tipik yılda ${y(o.kisinti_P50)}, kötü yılda ${y(o.kisinti_P90)}. Mevcut santraller kısılmıyor.`,
    `Öneri: ${o.kabul_kisinti * 100}% kısıntı sınırlı esnek bağlantı anlaşmasıyla pilot başvuru değerlendirilebilir. Batarya: ${o.batarya}.`,
    `Dikkat: TM yükü (${o.yuk_tepe_varsayim_MW} MW tepe) varsayımdır; gerilim ve koruma etüdü yapılmamıştır.`,
  ].join("\n");
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ hata: "Sadece POST" });
  const o = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
  if (!o || typeof o !== "object" || !o.trafo) return res.status(400).json({ hata: "Simülasyon özeti eksik" });

  const anahtar = process.env.GEMINI_API_KEY;
  if (!anahtar) return res.status(200).json({ metin: sablon(o), kaynak: "sablon" });

  try {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": anahtar },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: TALIMAT }] },
        contents: [{ role: "user", parts: [{ text: JSON.stringify(o) }] }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 700 },
      }),
    });
    const j: any = await r.json();
    if (!r.ok) throw new Error(j?.error?.message || `Gemini ${r.status}`);
    const metin = (j.candidates?.[0]?.content?.parts ?? []).map((p: any) => p.text ?? "").join("").trim();
    if (!metin) throw new Error("Gemini boş yanıt döndü");
    return res.status(200).json({ metin, kaynak: "gemini", model: MODEL });
  } catch (e) {
    return res.status(200).json({ metin: sablon(o), kaynak: "sablon", uyari: (e as Error).message });
  }
}
