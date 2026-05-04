import { Product } from '../types';

export interface CartItem extends Product {
  quantity: number;
}

const CART_STORAGE_KEY = 'vegieroute_cart';

export class CartService {
  static getCart(): CartItem[] {
    const saved = localStorage.getItem(CART_STORAGE_KEY);
    return saved ? JSON.parse(saved) : [];
  }

  static saveCart(cart: CartItem[]): void {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
  }

  static addToCart(cart: CartItem[], product: Product): CartItem[] {
    const existing = cart.find(item => item.id === product.id);
    if (existing) {
      return cart.map(item => 
        item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
      );
    }
    return [...cart, { ...product, quantity: 1 }];
  }

  static updateQuantity(cart: CartItem[], productId: string, delta: number): CartItem[] {
    return cart.map(item => {
      if (item.id === productId) {
        const newQty = Math.max(0, item.quantity + delta);
        return { ...item, quantity: newQty };
      }
      return item;
    }).filter(item => item.quantity > 0);
  }

  static clearCart(): void {
    localStorage.removeItem(CART_STORAGE_KEY);
  }

  static getTotals(cart: CartItem[]): { total: number; count: number } {
    return cart.reduce(
      (acc, item) => ({
        total: acc.total + item.price * item.quantity,
        count: acc.count + item.quantity
      }),
      { total: 0, count: 0 }
    );
  }
}
