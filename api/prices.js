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
      throw new Error("Altınkaynak Gold servisi HTTP " + goldResponse.status);
    }

    if (!currencyResponse.ok) {
      throw new Error(
        "Altınkaynak Currency servisi HTTP " + currencyResponse.status
      );
    }

    const [gold, currency] = await Promise.all([
      goldResponse.json(),
      currencyResponse.json()
    ]);

    function clean(items) {
      if (!Array.isArray(items)) return [];

      return items
        .map((item) => ({
          code: item.Kod ? String(item.Kod).trim() : "",
          name: item.Aciklama ? String(item.Aciklama).trim() : "",
          buy: Number(item.Alis),
          sell: Number(item.Satis),
          updatedAt: item.GuncellenmeZamani
            ? String(item.GuncellenmeZamani).trim()
            : ""
        }))
        .filter(
          (item) =>
            item.code &&
            item.name &&
            Number.isFinite(item.buy) &&
            Number.isFinite(item.sell)
        );
    }

    const goldData = clean(gold);
    const currencyData = clean(currency);

    /*
      Altınkaynak ürün kodları:
      GA   = Gram Altın
      PC   = Çeyrek Altın
      PY   = Yarım Altın
      PT   = Tam/Teklik Altın
      PA   = Ata Cumhuriyet
      CH_T = Külçe Altın
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

    const selectedGold = goldData.filter((item) =>
      goldCodes.includes(item.code)
    );

    const selectedCurrency = currencyData.filter((item) =>
      currencyCodes.includes(item.code)
    );

    const all = [...selectedGold, ...selectedCurrency];

    const updateTimes = all
      .map((item) => item.updatedAt)
      .filter(Boolean);

    const updatedAt =
      updateTimes.length > 0
        ? updateTimes.sort().at(-1)
        : null;

    res.setHeader("Cache-Control", "no-store, max-age=0");
    res.setHeader("CDN-Cache-Control", "no-store");
    res.setHeader("Vercel-CDN-Cache-Control", "no-store");

    return res.status(200).json({
      source: "Altınkaynak",
      updatedAt: updatedAt,
      fetchedAt: new Date().toISOString(),
      gold: selectedGold,
      currency: selectedCurrency
    });

  } catch (error) {
    console.error("Altınkaynak API hatası:", error);

    res.setHeader("Cache-Control", "no-store");

    return res.status(500).json({
      source: "Altınkaynak",
      error: "Altınkaynak verisi alınamadı",
      message: error.message
    });
  }
};
