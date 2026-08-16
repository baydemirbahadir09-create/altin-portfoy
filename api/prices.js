module.exports = async (req, res) => {
  try {
    const [goldResponse, currencyResponse] = await Promise.all([
      fetch("https://static.altinkaynak.com/public/Gold"),
      fetch("https://static.altinkaynak.com/public/Currency")
    ]);

    if (!goldResponse.ok || !currencyResponse.ok) {
      throw new Error("Altınkaynak servisine bağlanılamadı");
    }

    const gold = await goldResponse.json();
    const currency = await currencyResponse.json();

    const goldData = {};
    const currencyData = {};

    for (const item of gold) {
      const name = item.Aciklama;
      if (!name) continue;

      goldData[name] = {
        buy: item.Alis,
        sell: item.Satis,
        code: item.Kod,
        updated: item.GuncellenmeZamani
      };
    }

    for (const item of currency) {
      const name = item.Aciklama || item.Kod;
      if (!name) continue;

      currencyData[name] = {
        buy: item.Alis,
        sell: item.Satis,
        code: item.Kod,
        updated: item.GuncellenmeZamani
      };
    }

    res.setHeader("Cache-Control", "no-store");

    res.status(200).json({
      gold: goldData,
      currency: currencyData,
      updatedAt: new Date().toISOString()
    });

  } catch (error) {
    console.error("Altınkaynak API hatası:", error);

    res.status(500).json({
      error: "Altınkaynak verisi alınamadı",
      message: error.message
    });
  }
};
