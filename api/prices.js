module.exports = async (req, res) => {
  try {
    /*
      Altınkaynak'ın resmi canlı kaynakları
    */
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
      Türkçe sayı formatını güvenli şekilde
      gerçek sayıya çevir.

      Örnek:

      6.999,50
      ↓
      6999.50
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


      let s =
        String(value)
          .trim()
          .replace(/\s/g, "");


      if (!s) {
        return null;
      }


      /*
        Türkçe format:

        6.999,50

        Nokta = binlik
        Virgül = ondalık
      */

      if (s.includes(",")) {

        s =
          s
            .replace(/\./g, "")
            .replace(",", ".");

      }


      const number =
        Number(s);


      return Number.isFinite(number)
        ? number
        : null;

    }


    /*
      Altınkaynak kayıtlarını temizle.
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
      ALTIN
    */

    const goldData =
      clean(gold);


    /*
      DÖVİZ
    */

    const currencyData =
      clean(currency);


    /*
      ------------------------------------------------
      ÖNEMLİ GRAM ALTIN DÜZELTMESİ
      ------------------------------------------------

      Altınkaynak'ta birden fazla "Gram Altın"
      kaydı bulunabiliyor.

      Örneğin:

      GA  -> Gram Altın
      PGA -> Gram Altın

      Biz standart Gram Altın olarak
      kesinlikle GA kodunu kullanıyoruz.

      Böylece yanlış gram altın kaydının
      seçilmesini engelliyoruz.
    */

    const gramGold =
      goldData.find(
        item => item.code === "GA"
      );


    /*
      GA mevcutsa onu koru.

      Eğer ileride GA kaldırılırsa
      PGA fallback olarak kullanılabilir.
    */

    if (!gramGold) {

      const fallbackGram =
        goldData.find(
          item => item.code === "PGA"
        );


      if (fallbackGram) {

        console.warn(
          "GA bulunamadı, PGA kullanılıyor."
        );

      }

    }


    /*
      ------------------------------------------------
      TÜM FİYATLARI OLUŞTUR
      ------------------------------------------------
    */

    const prices = {};


    goldData.forEach(item => {

      /*
        Aynı isimli / benzer ürünlerin
        birbirinin üzerine yazmasını önlemek
        için KOD üzerinden kayıt tutuyoruz.
      */

      prices[item.code] = {

        code: item.code,

        name: item.name,

        buy: item.buy,

        sell: item.sell,

        updatedAt: item.updatedAt

      };

    });


    currencyData.forEach(item => {

      prices[item.code] = {

        code: item.code,

        name: item.name,

        buy: item.buy,

        sell: item.sell,

        updatedAt: item.updatedAt

      };

    });


    /*
      ------------------------------------------------
      SADECE GERÇEKTEN GEREKLİ DÖVİZLER
      ------------------------------------------------

      USD / EUR / GBP kodlarını özellikle
      garanti ediyoruz.
    */

    const allowedCurrencies = [
      "USD",
      "EUR",
      "GBP"
    ];


    const filteredCurrency =
      currencyData.filter(
        item =>
          allowedCurrencies.includes(
            item.code
          )
      );


    /*
      ------------------------------------------------
      GÜNCELLEME ZAMANI
      ------------------------------------------------
    */

    const all = [
      ...goldData,
      ...filteredCurrency
    ];


    const updateTimes =
      all
        .map(
          item =>
            item.updatedAt
        )
        .filter(Boolean);


    const updatedAt =
      updateTimes.length > 0
        ? updateTimes.sort().at(-1)
        : null;


    /*
      ------------------------------------------------
      CACHE KAPAT
      ------------------------------------------------

      Vercel'in eski fiyatı göstermesini
      mümkün olduğunca engelliyoruz.
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
      ------------------------------------------------
      CEVAP
      ------------------------------------------------
    */

    return res.status(200).json({

      source: "Altınkaynak",

      updatedAt,

      fetchedAt:
        new Date().toISOString(),

      /*
        Bütün altın ürünleri
      */

      gold: goldData,

      /*
        Sadece USD / EUR / GBP
      */

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