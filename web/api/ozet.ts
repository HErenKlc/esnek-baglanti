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
JSON'da varsayimsiz_alt_sinir altında yıllık gelir ve kısıntı bedeli (milyon TL) varsa, 2. paragrafta yatırımcı için bunu tek cümleyle söyle.
Kurallar: JSON'da olmayan hiçbir sayı yazma. Sayıları Türkçe biçimde yaz (virgüllü ondalık). Abartma, reklam dili kullanma.
Biçim: düz metin yaz. Yıldız, kalın, başlık, madde imi veya başka markdown işareti kullanma. Her paragrafı tamamla; yarım cümle bırakma. Toplam 150 kelimeyi geçme.`;

const virgul = (x: unknown) => String(x).replace(".", ",");

function sablon(o: any): string {
  const y = (x: number) => `%${(x * 100).toFixed(1).replace(".", ",")}`;
  return [
    `${o.trafo}: statik kurala göre ${o.statik_kalan_MW} MW boş görünüyor. Esnek bağlantıyla ${o.esnek_MW ?? o.esnek_ek_MW} MW ek GES bağlanabilir.`,
    `Bu güçte yeni projenin yıllık kısıntısı tipik yılda ${y(o.kisinti_P50)}, kötü yılda ${y(o.kisinti_P90)}. Mevcut santraller kısılmıyor.`,
    `Öneri: ${o.kabul_kisinti * 100}% kısıntı sınırlı esnek bağlantı anlaşmasıyla pilot başvuru değerlendirilebilir. Batarya: ${o.batarya}.`,
    ...(Array.isArray(o.varsayimsiz_alt_sinir) ? [`Para karşılığı (varsayımsız alt sınır): ${o.varsayimsiz_alt_sinir.map((m: any) => `${m.risk_olcusu} ${virgul(m.ek_MW)} MW, yılda ≈ ${virgul(m.yillik_gelir_milyon_TL)} milyon TL satış, kısıntı bedeli ≈ ${virgul(m.yillik_kisinti_bedeli_milyon_TL)} milyon TL`).join("; ")}.`] : []),
    `Dikkat: TM yükü (${o.yuk_tepe_varsayim_MW} MW tepe) varsayımdır; gerilim ve koruma etüdü yapılmamıştır.`,
  ].join("\n");
}

/** Markdown işaretlerini temizler; arayüz düz paragraf bekliyor. */
const duzelt = (s: string) => s.trim().replace(/\*\*/g, "").replace(/^#+\s*/gm, "");

async function gemini(o: any, anahtar: string) {
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": anahtar },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: TALIMAT }] },
      contents: [{ role: "user", parts: [{ text: JSON.stringify(o) }] }],
      // thinkingBudget 0: düşünme tokenları maxOutputTokens'ı yiyip metni yarıda kesiyordu.
      generationConfig: { temperature: 0.2, maxOutputTokens: 2048, thinkingConfig: { thinkingBudget: 0 } },
    }),
  });
  const j: any = await r.json();
  if (!r.ok) throw new Error(j?.error?.message || `Gemini ${r.status}`);
  const aday = j.candidates?.[0];
  const metin = duzelt((aday?.content?.parts ?? []).map((p: any) => p.text ?? "").join(""));
  if (!metin) throw new Error("Gemini boş yanıt döndü");
  if (aday?.finishReason && aday.finishReason !== "STOP") throw new Error(`Yanıt tamamlanmadı (${aday.finishReason})`);
  return { metin, kaynak: "gemini", model: MODEL };
}

async function claude(o: any, anahtar: string) {
  const model = process.env.CLAUDE_MODEL || "claude-haiku-4-5";
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": anahtar, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({
      model, max_tokens: 1024, temperature: 0.2, system: TALIMAT,
      messages: [{ role: "user", content: JSON.stringify(o) }],
    }),
  });
  const j: any = await r.json();
  if (!r.ok) throw new Error(j?.error?.message || `Claude ${r.status}`);
  const metin = duzelt((j.content ?? []).map((p: any) => p.text ?? "").join(""));
  if (!metin) throw new Error("Claude boş yanıt döndü");
  if (j.stop_reason && j.stop_reason !== "end_turn") throw new Error(`Yanıt tamamlanmadı (${j.stop_reason})`);
  return { metin, kaynak: "claude", model };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ hata: "Sadece POST" });
  const o = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
  if (!o || typeof o !== "object" || !o.trafo) return res.status(400).json({ hata: "Simülasyon özeti eksik" });

  // Sağlayıcı sırası: SAGLAYICI=claude ile Claude öne alınır. Biri düşerse diğeri, o da yoksa şablon.
  const g = process.env.GEMINI_API_KEY, c = process.env.ANTHROPIC_API_KEY;
  const sira: Array<() => Promise<{ metin: string; kaynak: string; model: string }>> = [];
  if (process.env.SAGLAYICI === "claude") {
    if (c) sira.push(() => claude(o, c));
    if (g) sira.push(() => gemini(o, g));
  } else {
    if (g) sira.push(() => gemini(o, g));
    if (c) sira.push(() => claude(o, c));
  }

  const hatalar: string[] = [];
  for (const dene of sira) {
    try {
      return res.status(200).json(await dene());
    } catch (e) {
      hatalar.push((e as Error).message);
    }
  }
  return res.status(200).json({
    metin: sablon(o), kaynak: "sablon",
    uyari: hatalar.length ? hatalar.join(" · ") : "Sağlayıcı anahtarı tanımlı değil",
  });
}
