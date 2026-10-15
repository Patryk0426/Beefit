import React, { useState } from 'react';
import './App.css';

function App() {
  const [searchTerm, setSearchTerm] = useState('');
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  function handleSearch(event) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    fetch(`/api/items?search=${encodeURIComponent(searchTerm)}`)
      .then(function(response) {
        if (!response.ok) {
          throw new Error('Błąd podczas pobierania danych z serwera.');
        }
        return response.json();
      })
      .then(function(result) {
        setProducts(result.data);
        setLoading(false);
      })
      .catch(function(err) {
        setError(err.message);
        setLoading(false);
      });
  }

  return (
    <div className="app-container">
      <header className="app-header">
        <h1>BeeFIT 🍏</h1>
        <p>Twoja aplikacja do liczenia kalorii i zarządzania dietą</p>
      </header>

      <main className="app-main">
        <section className="search-section">
          <form onSubmit={handleSearch}>
            <input
              type="text"
              placeholder="Wyszukaj produkt (np. banan, chleb)..."
              value={searchTerm}
              onChange={function(e) { setSearchTerm(e.target.value); }}
            />
            <button type="submit">Szukaj</button>
          </form>
        </section>

        {loading && <p className="loading-text">Ładowanie danych...</p>}
        {error && <p className="error-text">{error}</p>}

        <section className="results-section">
          <h2>Wyniki wyszukiwania</h2>
          {products.length === 0 && !loading && <p>Brak produktów do wyświetlenia.</p>}
          <ul className="product-list">
            {products.map(function(product) {
              return (
                <li key={product.id} className="product-item">
                  <h3>{product.name}</h3>
                  <p>Kalorie: {product.caloriesPer100g} kcal / 100g</p>
                  <p>Białko: {product.proteinPer100g}g | Tłuszcz: {product.fatPer100g}g | Węglowodany: {product.carbsPer100g}g</p>
                  {product.allergens && <p className="allergens">Alergeny: {product.allergens}</p>}
                </li>
              );
            })}
          </ul>
        </section>
      </main>
    </div>
  );
}

export default App;