const express = require('express');
const cors = require('cors');
const { PrismaClient } = require('@prisma/client');
const axios = require('axios');

const app = express();
const prisma = new PrismaClient();

app.use(cors());
app.use(express.json());

// Pomocnicza funkcja do czyszczenia danych z API
function cleanAndParseProductData(rawProduct) {
    const nutriments = rawProduct.nutriments || {};
    return {
        barcode: rawProduct.code || null,
        name: rawProduct.product_name_pl || rawProduct.product_name || 'Nieznany produkt',
        caloriesPer100g: parseFloat(nutriments['energy-kcal_100g'] || nutriments['energy-kcal'] || 0),
        proteinPer100g: parseFloat(nutriments['proteins_100g'] || 0),
        fatPer100g: parseFloat(nutriments['fat_100g'] || 0),
        carbsPer100g: parseFloat(nutriments['carbohydrates_100g'] || 0),
        allergens: rawProduct.allergens_tags ? rawProduct.allergens_tags.join(', ') : null
    };
}

// GET /api/items - wyszukiwanie produktów (lokalnie + zabezpieczone Open Food Facts)
app.get('/api/items', function(req, res) {
    return (async function() {
        try {
            const { search } = req.query;
            let products = [];

            if (search) {
                // 1. Szukamy lokalnie w bazie
                products = await prisma.product.findMany({
                    where: { name: { contains: search, mode: 'insensitive' } },
                    take: 50
                });

                // 2. Jeśli lokalnie nic nie ma, próbujemy pytać Open Food Facts
                if (products.length === 0 && search.trim() !== '') {
                    try {
                        const searchResponse = await axios.get(
                            `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(search)}&search_simple=1&action=process&json=1`, 
                            { 
                                timeout: 4000,
                                headers: {
                                    'User-Agent': 'BeeFIT-App (contact@beefit.local)'
                                }
                            }
                        );
                        
                        if (searchResponse.data && searchResponse.data.products && searchResponse.data.products.length > 0) {
                            const rawProducts = searchResponse.data.products.slice(0, 5);

                            for (const raw of rawProducts) {
                                const parsed = cleanAndParseProductData(raw);
                                
                                try {
                                    const created = await prisma.product.create({
                                        data: parsed
                                    });
                                    products.push(created);
                                } catch (dbErr) {
                                    if (parsed.barcode) {
                                        const existingProd = await prisma.product.findUnique({ where: { barcode: parsed.barcode } });
                                        if (existingProd && !products.some(p => p.id === existingProd.id)) {
                                            products.push(existingProd);
                                        }
                                    }
                                }
                            }
                        }
                    } catch (apiErr) {
                        // Zewnętrzne API Open Food Facts padło lub zwróciło 503 – logujemy łagodnie zamiast sypać błędami
                        console.log('Informacja: Zewnętrzne API Open Food Facts jest obecnie niedostępne (503). Korzystamy z bazy lokalnej.');
                    }
                }
            } else {
                products = await prisma.product.findMany({ take: 50 });
            }

            res.status(200).json({ success: true, data: products });
        } catch (error) {
            res.status(500).json({ success: false, error: 'Błąd serwera podczas pobierania produktów.' });
        }
    })();
});

// POST /api/items - pobieranie danych z Open Food Facts za pomocą kodu kreskowego i zapis do bazy
app.post('/api/items', async function(req, res) {
    try {
        const { barcode } = req.body;
        if (!barcode) {
            return res.status(400).json({ success: false, error: 'Wymagany jest kod kreskowy produktu.' });
        }

        const existing = await prisma.product.findUnique({ where: { barcode } });
        if (existing) {
            return res.status(200).json({ success: true, data: existing, message: 'Produkt już istnieje w bazie.' });
        }

        const apiResponse = await axios.get(`https://world.openfoodfacts.org/api/v0/product/${barcode}.json`, { 
            timeout: 4000,
            headers: {
                'User-Agent': 'BeeFIT-App (contact@beefit.local)'
            }
        });
        
        if (!apiResponse.data || apiResponse.data.status !== 1) {
            return res.status(404).json({ success: false, error: 'Nie znaleziono produktu w zewnętrznej bazie danych.' });
        }

        const parsedData = cleanAndParseProductData(apiResponse.data.product);
        const newProduct = await prisma.product.create({ data: parsedData });

        res.status(201).json({ success: true, data: newProduct });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Zewnętrzne API jest obecnie przeciążone (503). Spróbuj ponownie później.' });
    }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, function() {
    console.log(`Serwer backendowy BeeFIT działa na porcie ${PORT}`);
});