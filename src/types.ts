export type UserRole = "customer" | "seller" | "admin";

export interface UserProfile {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  superCoins?: number;
  phoneNumber?: string;
  subscriptionExpiry?: string;
  createdAt: string;
}

export interface Review {
  id: string;
  customerId: string;
  customerName: string;
  rating: number;
  comment: string;
  createdAt: string;
}

export interface SellerProfile extends UserProfile {
  vehicleType: string;
  serviceArea: string;
  isKycVerified: boolean;
  isOnline: boolean;
  onboardingComplete?: boolean;
  membershipPlan?: 'standard' | 'premium' | 'enterprise';
  businessDetails?: {
    shopName?: string;
    address?: string;
    description?: string;
    operatingHours?: string;
    bio?: string;
    logoUrl?: string;
  };
  paymentInfo?: {
    upiId?: string;
    phoneNumber?: string;
    qrCodeUrl?: string;
  };
  currentLocation?: {
    lat: number;
    lng: number;
    updatedAt: string;
  };
  averageRating?: number;
  totalRatings?: number;
  reviews?: Review[];
}

export interface VegetableItem {
  id: string;
  name: string;
  price: number;
  unit: string;
  quantity?: number;
}

export interface Order {
  id: string;
  customerId: string;
  sellerId?: string;
  items: VegetableItem[];
  status: "pending" | "accepted" | "ongoing" | "delivered" | "cancelled";
  location: {
    lat: number;
    lng: number;
    address: string;
  };
  timeSlot: string;
  notes?: string;
  totalAmount: number;
  createdAt: string;
  rewardAvailable?: boolean;
  rewardAmount?: number;
  rating?: number;
  qualityRating?: number;
  type?: 'reward' | 'signal';
}
