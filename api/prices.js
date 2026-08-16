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

    // Altınkaynak Türkçe sayı formatını sayıya çevirir.
    // Örn: "6.656,76" -> 6656.76
    function parsePrice(value) {
      if (typeof value === "number") return value;

      if (value === null || value === undefined) {
        return null;
      }

      let s = String(value).trim();

      if (!s) return null;

      s = s.replace(/\s/g, "");

      // Türkçe format: 6.656,76
      if (s.includes(",")) {
        s = s.replace(/\./g, "").replace(",", ".");
      }

      const number = Number(s);

      return Number.isFinite(number) ? number : null;
    }

    function clean(items) {
      if (!Array.isArray(items)) return [];

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

    const goldData = clean(gold);
    const currencyData = clean(currency);

    /*
      ALTINKAYNAK KODLARI

      GA   = Gram Altın
      PC   = Çeyrek
      PY   = Yarım
      PT   = Teklik / Tam
      PA   = Ata Cumhuriyet
      CH_T = Külçe

      USD  = Dolar
      EUR  = Euro
      GBP  = Sterlin
    */

    const goldCodes = [
      "GA",
      "PC",
      "PY",
      "PT",
      "PA",
      "CH_T"
    ];

    const currencyCodes = [
      "USD",
      "EUR",
      "GBP"
    ];

    const selectedGold = goldData.filter(item =>
      goldCodes.includes(item.code)
    );

    const selectedCurrency = currencyData.filter(item =>
      currencyCodes.includes(item.code)
    );

    const all = [
      ...selectedGold,
      ...selectedCurrency
    ];

    const updateTimes = all
      .map(item => item.updatedAt)
      .filter(Boolean);

    const updatedAt =
      updateTimes.length > 0
        ? updateTimes.sort().at(-1)
        : null;

    // Vercel/CDN önbelleğini kapat.
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
      gold: selectedGold,
      currency: selectedCurrency
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
      error: "Altınkaynak verisi alınamadı",
      message: error.message
    });
  }
};
