
require("dotenv").config({
  path: require("path").join(__dirname, "../.env"),
});

const express = require("express");
const cors = require("cors");
const axios = require("axios");

const app = express();

app.use(cors());
app.use(express.json());

const OFF = "https://world.openfoodfacts.org";

let offCookies = "";
let loginPromise = null;

// =====================================
// LOGOWANIE OPEN FOOD FACTS
// =====================================

async function loginOFF() {
  const username = process.env.OFF_USERNAME;
  const password = process.env.OFF_PASSWORD;

  if (!username || !password) {
    throw new Error(
      "Brak OFF_USERNAME lub OFF_PASSWORD w pliku .env"
    );
  }

  const response = await axios.post(
    `${OFF}/cgi/session.pl`,
    new URLSearchParams({
      user_id: username,
      password: password,
    }).toString(),
    {
      timeout: 20000,
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": "BeeFIT/1.0",
      },
      maxRedirects: 0,
      validateStatus: (status) => status >= 200 && status < 400,
    }
  );

  const cookies = response.headers["set-cookie"] || [];

  if (!cookies.length) {
    throw new Error(
      "Open Food Facts nie zwrócił ciasteczka sesji."
    );
  }

  offCookies = cookies
    .map((cookie) => cookie.split(";")[0])
    .join("; ");

  console.log("Zalogowano do Open Food Facts.");
}

async function ensureLogin() {
  if (offCookies) return;

  if (!loginPromise) {
    loginPromise = loginOFF().finally(() => {
      loginPromise = null;
    });
  }

  await loginPromise;
}

// =====================================
// WYSZUKIWANIE PRODUKTÓW
// =====================================

app.get("/api/items", async (req, res) => {
  try {
    const search = String(req.query.search || "").trim();

    if (!search) {
      return res.json([]);
    }

    await ensureLogin();

    const response = await axios.get(
      `${OFF}/cgi/search.pl`,
      {
        params: {
          search_terms: search,
          search_simple: 1,
          action: "process",
          json: 1,
          page_size: 100,
          fields: [
            "code",
            "product_name",
            "product_name_pl",
            "brands",
            "image_url",
            "nutriments",
            "allergens",
            "countries_tags",
          ].join(","),
        },

        timeout: 20000,

        headers: {
          "User-Agent": "BeeFIT/1.0",
          Cookie: offCookies,
        },
      }
    );

    const rawProducts = response.data.products || [];

    const products = rawProducts
      .filter((product) => {
        return product.product_name || product.product_name_pl;
      })
      .map((product) => {
        const countries = product.countries_tags || [];

        const isPolish = countries.some((country) =>
          country.toLowerCase().includes("poland")
        );

        const nutriments = product.nutriments || {};

        return {
          barcode: product.code || "",

          name:
            product.product_name_pl ||
            product.product_name ||
            "Nieznany produkt",

          originalName: product.product_name || "",

          brand: product.brands || "",

          image: product.image_url || "",

          caloriesPer100g: Number(
            nutriments["energy-kcal_100g"] || 0
          ),

          proteinPer100g: Number(
            nutriments.proteins_100g || 0
          ),

          fatPer100g: Number(
            nutriments.fat_100g || 0
          ),

          carbsPer100g: Number(
            nutriments.carbohydrates_100g || 0
          ),

          allergens: product.allergens || "",

          isPolish: isPolish,
        };
      });

    // Polskie produkty na początku
    products.sort((a, b) => {
      return Number(b.isPolish) - Number(a.isPolish);
    });

    const finalProducts = products.slice(0, 100);

    console.log(
      `Wyszukiwanie "${search}": znaleziono ${finalProducts.length} produktów.`
    );

    return res.json(finalProducts);

  } catch (error) {
    console.error(
      "BŁĄD WYSZUKIWANIA:",
      error.response?.data || error.message
    );

    return res.status(500).json({
      error: "Nie udało się wyszukać produktów.",
    });
  }
});

// =====================================
// START SERWERA
// =====================================

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`BeeFIT działa na porcie ${PORT} 🚀`);
});
