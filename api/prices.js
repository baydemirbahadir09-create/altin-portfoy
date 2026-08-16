module.exports = async (req, res) => {
  try {
    const [goldResponse, currencyResponse] = await Promise.all([
      fetch("https://static.altinkaynak.com/public/Gold", {
        cache: "no-store"
      }),
      fetch("https://static.altinkaynak.com/public/Currency", {
        cache: "no-store"
      })
    ]);

    if (!goldResponse.ok) {
      throw new Error("Gold HTTP " + goldResponse.status);
    }

    if (!currencyResponse.ok) {
      throw new Error("Currency HTTP " + currencyResponse.status);
    }

    const [gold, currency] = await Promise.all([
      goldResponse.json(),
      currencyResponse.json()
    ]);

    function parsePrice(value) {
      if (typeof value === "number") {
        return value;
      }

      if (value === null || value === undefined) {
        return null;
      }

      let s = String(value)
        .trim()
        .replace(/\s/g, "");

      if (!s) {
        return null;
      }

      /*
        Türkçe sayı formatı:
        6.753,94 -> 6753.94
      */
      if (s.includes(",")) {
        s = s
          .replace(/\./g, "")
          .replace(",", ".");
      }

      const number = Number(s);

      return Number.isFinite(number)
        ? number
        : null;
    }

    function clean(items) {
      if (!Array.isArray(items)) {
        return [];
      }

      return items
        .map(item => ({
          code: item.Kod
            ? String(item.Kod).trim()
            : "",

          name: item.Aciklama
            ? String(item.Aciklama).trim()
            : "",

          buy: parsePrice(item.Alis),

          sell: parsePrice(item.Satis),

          updatedAt: item.GuncellenmeZamani
            ? String(item.GuncellenmeZamani).trim()
            : ""
        }))
        .filter(item =>
          item.code &&
          item.name &&
          item.buy !== null &&
          item.sell !== null
        );
    }

    /*
      Altınkaynak'tan gelen TÜM altın ürünleri.
      
      Artık:
      GA
      PC
      PY
      PT
      PA
      CH_T
      
      gibi sabit kod listesi kullanmıyoruz.

      Böylece Altınkaynak'a yeni bir altın ürünü
      eklenirse otomatik olarak API'den gelir.
    */
    const goldData = clean(gold);

    /*
      Dövizleri de otomatik olarak alıyoruz.
    */
    const currencyData = clean(currency);

    /*
      Altınkaynak'ın güncelleme zamanını bul.
    */
    const all = [
      ...goldData,
      ...currencyData
    ];

    const updateTimes = all
      .map(item => item.updatedAt)
      .filter(Boolean);

    const updatedAt =
      updateTimes.length > 0
        ? updateTimes.sort().at(-1)
        : null;

    /*
      Vercel / CDN cache kapalı.
      Her istek Altınkaynak'tan güncel veri almaya çalışır.
    */
    res.setHeader(
      "Cache-Control",
      "no-store, no-cache, must-revalidate, proxy-revalidate"
    );

    res.setHeader(
      "CDN-Cache-Control",
      "no-store"
    );

    res.setHeader(
      "Vercel-CDN-Cache-Control",
      "no-store"
    );

    return res.status(200).json({
      source: "Altınkaynak",

      updatedAt: updatedAt,

      fetchedAt: new Date().toISOString(),

      gold: goldData,

      currency: currencyData
    });

  } catch (error) {

    console.error(
      "Altınkaynak API hatası:",
      error
    );

    res.setHeader(
      "Cache-Control",
      "no-store"
    );

    return res.status(500).json({
      source: "Altınkaynak",

      error:
        "Altınkaynak verisi alınamadı",

      message:
        error.message
    });
  }
};
