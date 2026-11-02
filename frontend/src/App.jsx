
import React, { useState } from 'react';
import './App.css';

const API_URL = 'http://localhost:5000';
const PRODUCTS_PER_PAGE = 20;

function App() {
  const [searchTerm, setSearchTerm] = useState('');
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [searched, setSearched] = useState(false);

  async function handleSearch(event) {
    event.preventDefault();

    const search = searchTerm.trim();

    if (!search) {
      setError('Wpisz nazwę produktu.');
      return;
    }

    setLoading(true);
    setError('');
    setProducts([]);
    setPage(1);
    setSearched(true);

    try {
      const response = await fetch(
        `${API_URL}/api/items?search=${encodeURIComponent(search)}`
      );

      if (!response.ok) {
        throw new Error(`Błąd serwera: ${response.status}`);
      }

      const result = await response.json();

      if (!Array.isArray(result)) {
        throw new Error('Nieprawidłowe dane z serwera.');
      }

      const seen = new Set();

      const uniqueProducts = result.filter((product) => {
        if (!product.name) return false;

        if (product.barcode && seen.has(product.barcode)) {
          return false;
        }

        if (product.barcode) seen.add(product.barcode);

        return true;
      });

      setProducts(uniqueProducts);

      if (uniqueProducts.length === 0) {
        setError('Nie znaleziono produktów.');
      }
    } catch (err) {
      setError(err.message || 'Wystąpił błąd.');
    } finally {
      setLoading(false);
    }
  }

  function formatNumber(value) {
    const number = Number(value);
    return Number.isFinite(number)
      ? Number.isInteger(number) ? number : number.toFixed(1)
      : '0';
  }

  const totalPages = Math.ceil(products.length / PRODUCTS_PER_PAGE);
  const start = (page - 1) * PRODUCTS_PER_PAGE;
  const visibleProducts = products.slice(start, start + PRODUCTS_PER_PAGE);

  return (
    <div className="app">
      <header>
    <img src="/bee.png" alt="BeeFIT" className="logo" />
    <p>Sprawdzaj kalorie i wartości odżywcze produktów</p>
      </header>

      <main>
        <form className="search" onSubmit={handleSearch}>
          <input
            type="text"
            placeholder="Wyszukaj produkt, np. banan..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <button type="submit" disabled={loading}>
            {loading ? 'Szukam...' : 'Szukaj'}
          </button>
        </form>

        <section>
          <div className="results-heading">
            <h2>{searched ? 'Wyniki wyszukiwania' : 'Produkty'}</h2>
            {products.length > 0 && (
              <span>Znaleziono: {products.length}</span>
            )}
          </div>

          {loading && <p className="message">Ładowanie produktów...</p>}
          {error && !loading && <p className="message error">{error}</p>}

          {!searched && !loading && (
            <p className="message">Wpisz nazwę produktu, aby rozpocząć.</p>
          )}

          {!loading && visibleProducts.length > 0 && (
            <>
              <div className="product-grid">
                {visibleProducts.map((product, index) => (
                  <article
                    className="product"
                    key={product.barcode || `${product.name}-${index}`}
                  >
                    {product.image ? (
                      <img
                        src={product.image}
                        alt={product.name}
                        loading="lazy"
                      />
                    ) : (
                      <div className="no-image">🍏</div>
                    )}

                    {product.isPolish && (
                      <span className="polish">🇵🇱 Polski produkt</span>
                    )}

                    <h3>{product.name}</h3>
                    <p className="brand">
                      {product.brand || 'Produkt spożywczy'}
                    </p>

                    <div className="calories">
                      {formatNumber(product.caloriesPer100g)} kcal
                      <small> / 100 g</small>
                    </div>

                    <div className="macros">
                      <span>Białko: {formatNumber(product.proteinPer100g)} g</span>
                      <span>Tłuszcze: {formatNumber(product.fatPer100g)} g</span>
                      <span>Węglowodany: {formatNumber(product.carbsPer100g)} g</span>
                    </div>

                    {product.allergens && (
                      <p className="allergens">
                        Alergeny: {product.allergens}
                      </p>
                    )}
                  </article>
                ))}
              </div>

              <div className="pagination">
                <button
                  onClick={() => setPage(page - 1)}
                  disabled={page === 1}
                >
                  ← Poprzednia
                </button>

                <span>
                  Strona <strong>{page}</strong> z <strong>{totalPages}</strong>
                </span>

                <button
                  onClick={() => setPage(page + 1)}
                  disabled={page === totalPages}
                >
                  Następna →
                </button>
              </div>
            </>
          )}
        </section>
      </main>

      <footer>BeeFIT © 2026</footer>
    </div>
  );
}

export default App;
