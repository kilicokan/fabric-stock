import React, { createContext, useContext, useState, useEffect } from 'react';

const ProductContext = createContext();

export const useProducts = () => {
  const context = useContext(ProductContext);
  if (!context) {
    throw new Error('useProducts must be used within a ProductProvider');
  }
  return context;
};

export const ProductProvider = ({ children }) => {
  const [products, setProducts] = useState([]);

  // Sayfa yüklendiğinde localStorage'dan ürünleri yükle
  useEffect(() => {
    const savedProducts = localStorage.getItem('products');
    if (savedProducts) {
      setProducts(JSON.parse(savedProducts));
    } else {
      // Varsayılan ürünler
      const defaultProducts = [
        {
          id: 1,
          code: "PRD-1001",
          name: "Pamuklu Kumaş",
          materialType: "Dokuma Kumaş",
          groupNo: "GRP-001",
          taxRate: "%18",
          image: ""
        },
        {
          id: 2,
          code: "PRD-1002",
          name: "Polyester Kumaş",
          materialType: "Örme Kumaş",
          groupNo: "GRP-002",
          taxRate: "%8",
          image: ""
        }
      ];
      setProducts(defaultProducts);
      localStorage.setItem('products', JSON.stringify(defaultProducts));
    }
  }, []);

  // products değiştiğinde localStorage'a kaydet
  useEffect(() => {
    if (products.length > 0) {
      localStorage.setItem('products', JSON.stringify(products));
    }
  }, [products]);

  const addProduct = (newProduct) => {
    const productWithId = {
      ...newProduct,
      id: Math.max(...products.map(p => p.id), 0) + 1,
      code: newProduct.productCode || `PRD-${Math.floor(1000 + Math.random() * 9000)}`
    };
    const updatedProducts = [...products, productWithId];
    setProducts(updatedProducts);
    return productWithId;
  };

  const updateProduct = (updatedProduct) => {
    const updatedProducts = products.map(p => p.id === updatedProduct.id ? updatedProduct : p);
    setProducts(updatedProducts);
  };

  const deleteProduct = (id) => {
    const updatedProducts = products.filter(p => p.id !== id);
    setProducts(updatedProducts);
  };

  const getProductById = (id) => {
    return products.find(product => product.id === id);
  };

  const value = {
    products,
    addProduct,
    updateProduct,
    deleteProduct,
    getProductById
  };

  return (
    <ProductContext.Provider value={value}>
      {children}
    </ProductContext.Provider>
  );
};