import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ProductProvider } from './context/ProductContext';
import ProductsPage from './components/ProductsPage';
import FabricsPlanningPage from './components/FabricsPlanningPage';

function App() {
  return (
    <ProductProvider>
      <Router>
        <div className="App">
          <Routes>
            <Route path="/products" element={<ProductsPage />} />
            <Route path="/fabric-exit" element={<FabricsPlanningPage />} />
            {/* Ana sayfayı products'a yönlendir */}
            <Route path="/" element={<ProductsPage />} />
          </Routes>
        </div>
      </Router>
    </ProductProvider>
  );
}

export default App;