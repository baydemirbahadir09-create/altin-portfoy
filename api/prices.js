module.exports = async (req, res) => {
  try {
    const [goldResponse, currencyResponse] =
      await Promise.all([
        fetch("https://static.altinkaynak.com/public/Gold", {
          cache: "no-store"
        }),

        fetch("https://static.altinkaynak.com/public/Currency", {
          cache: "no-store"
        })
      ]);

    if (!goldResponse.ok) {
      throw new Error(
        "Gold HTTP " + goldResponse.status
      );
    }

    if (!currencyResponse.ok) {
      throw new Error(
        "Currency HTTP " + currencyResponse.status
      );
    }

    const [gold, currency] =
      await Promise.all([
        goldResponse.json(),
        currencyResponse.json()
      ]);

    /*
      ============================================
      SAYI DÖNÜŞTÜRME
      ============================================

      Altınkaynak'ta altın fiyatları bazen:

      6.537
      43.205
      10.568

      şeklinde geliyor.

      Buradaki nokta BINLİK ayırıcıdır.

      Yani:

      6.537  -> 6537
      43.205 -> 43205
      10.568 -> 10568

      Virgüllü değerlerde ise:

      4.167,19 -> 4167.19
    */

    function parsePrice(value) {
      if (typeof value === "number") {
        return value;
      }

      if (
        value === null ||
        value === undefined
      ) {
        return null;
      }

      let s = String(value)
        .trim()
        .replace(/\s/g, "");

      if (!s) {
        return null;
      }

      /*
        Türkçe format:

        6.537,50
        6.537
        88
      */

      if (s.includes(",")) {
        s = s
          .replace(/\./g, "")
          .replace(",", ".");
      }

      /*
        Virgül yoksa ve değer:

        6.537
        43.205
        10.568

        biçimindeyse noktayı binlik
        ayırıcı olarak kabul ediyoruz.
      */

      else if (
        /^\d{1,3}\.\d{3}$/.test(s)
      ) {
        s = s.replace(/\./g, "");
      }

      const number = Number(s);

      return Number.isFinite(number)
        ? number
        : null;
    }

    /*
      ============================================
      ALTINKAYNAK KAYITLARINI TEMİZLE
      ============================================
    */

    function clean(items) {
      if (!Array.isArray(items)) {
        return [];
      }

      return items
        .map(item => {
          const code =
            item.Kod
              ? String(item.Kod).trim()
              : "";

          const name =
            item.Aciklama
              ? String(item.Aciklama).trim()
              : "";

          const buy =
            parsePrice(item.Alis);

          const sell =
            parsePrice(item.Satis);

          const updatedAt =
            item.GuncellenmeZamani
              ? String(
                  item.GuncellenmeZamani
                ).trim()
              : "";

          return {
            code,
            name,
            buy,
            sell,
            updatedAt
          };
        })
        .filter(item =>
          item.code &&
          item.name &&
          item.buy !== null &&
          item.sell !== null
        );
    }

    /*
      ============================================
      ALTIN
      ============================================
    */

    const goldData =
      clean(gold);

    /*
      ============================================
      DÖVİZ
      ============================================
    */

    const currencyData =
      clean(currency);

    /*
      ============================================
      SADECE GEREKLİ DÖVİZLER
      ============================================
    */

    const allowedCurrencies = [
      "USD",
      "EUR",
      "GBP"
    ];

    const filteredCurrency =
      currencyData.filter(item =>
        allowedCurrencies.includes(
          item.code
        )
      );

    /*
      ============================================
      GRAM ALTIN
      ============================================

      Uygulamada standart Gram Altın:

      GA

      kullanılacak.

      PGA gibi ikinci Gram Altın kaydı
      kullanılmayacak.
    */

    const gramGold =
      goldData.find(
        item => item.code === "GA"
      );

    if (!gramGold) {
      throw new Error(
        "Altınkaynak GA (Gram Altın) verisi bulunamadı."
      );
    }

    /*
      ============================================
      FİYATLAR
      ============================================
    */

    const prices = {};

    /*
      Altınları kodlarına göre oluştur.
    */

    goldData.forEach(item => {
      prices[item.code] = {
        code: item.code,
        name: item.name,
        buy: item.buy,
        sell: item.sell,
        updatedAt: item.updatedAt
      };
    });

    /*
      Dövizleri ekle.
    */

    filteredCurrency.forEach(item => {
      prices[item.code] = {
        code: item.code,
        name: item.name,
        buy: item.buy,
        sell: item.sell,
        updatedAt: item.updatedAt
      };
    });

    /*
      ============================================
      GRAM ALTINI GARANTİ ALTINA AL
      ============================================
    */

    prices["GA"] = {
      code: "GA",
      name: "Gram Altın",
      buy: gramGold.buy,
      sell: gramGold.sell,
      updatedAt: gramGold.updatedAt
    };

    /*
      ============================================
      GÜNCELLEME ZAMANI
      ============================================
    */

    const all = [
      ...goldData,
      ...filteredCurrency
    ];

    const updateTimes =
      all
        .map(item =>
          item.updatedAt
        )
        .filter(Boolean);

    const updatedAt =
      updateTimes.length > 0
        ? updateTimes.sort().at(-1)
        : null;

    /*
      ============================================
      CACHE KAPAT
      ============================================
    */

    res.setHeader(
      "Cache-Control",
      "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0"
    );

    res.setHeader(
      "CDN-Cache-Control",
      "no-store"
    );

    res.setHeader(
      "Vercel-CDN-Cache-Control",
      "no-store"
    );

    res.setHeader(
      "Pragma",
      "no-cache"
    );

    /*
      ============================================
      CEVAP
      ============================================
    */

    return res.status(200).json({
      source: "Altınkaynak",

      updatedAt,

      fetchedAt:
        new Date().toISOString(),

      gold: goldData,

      currency: filteredCurrency
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