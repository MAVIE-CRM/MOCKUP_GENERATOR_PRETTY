const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:3005';

export const config = {
  apiUrl: API_URL,
  endpoints: {
    products: `${API_URL}/api/products`,
    grafiche: `${API_URL}/api/grafiche`,
    file: (id: string) => `${API_URL}/api/onedrive/file/${id}`,
  }
};
