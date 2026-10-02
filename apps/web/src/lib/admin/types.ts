export type AdminRole = 
  | "SUPER_ADMIN"
  | "ADMIN"
  | "COMPLIANCE_ADMIN"
  | "KYC_ADMIN"
  | "FINANCE_ADMIN"
  | "TRADING_ADMIN"
  | "P2P_ADMIN"
  | "SUPPORT_ADMIN"
  | "RISK_MANAGER"
  | "AUDITOR"
  | "MODERATOR"
  | "USER";

export interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: AdminRole;
  status: "ACTIVE" | "FROZEN" | "SUSPENDED" | "PENDING";
  kycStatus: "VERIFIED" | "PENDING" | "REJECTED" | "UNVERIFIED";
  riskLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  balanceUsd: number;
  p2pVolumeUsd: number;
  createdAt: string;
  lastLoginAt: string;
}

export interface KycApplication {
  id: string;
  userId: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  country: string;
  documentType: "PASSPORT" | "ID_CARD" | "DRIVERS_LICENSE";
  documentNumber: string;
  documentFrontUrl: string;
  documentBackUrl?: string;
  selfieUrl: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  rejectionReason?: string;
  reviewedBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface FinancialTransaction {
  id: string;
  userId: string;
  userName: string;
  type: "DEPOSIT" | "WITHDRAWAL";
  asset: string;
  amount: number;
  network?: string;
  address?: string;
  txHash?: string;
  status: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED" | "REJECTED";
  riskScore: "LOW" | "MEDIUM" | "HIGH";
  createdAt: string;
  completedAt?: string;
}

export interface AdminOrder {
  id: string;
  userId: string;
  userName: string;
  market: string; // e.g. "BTC/USD"
  side: "BUY" | "SELL";
  type: "LIMIT" | "MARKET" | "STOP_LIMIT";
  price: number;
  amount: number;
  filled: number;
  status: "OPEN" | "PARTIAL" | "FILLED" | "CANCELED";
  createdAt: string;
}

export interface AdminTrade {
  id: string;
  market: string;
  price: number;
  amount: number;
  total: number;
  makerId: string;
  takerId: string;
  side: "BUY" | "SELL"; // Taker side
  timestamp: string;
}

export interface AdminP2PDispute {
  id: string;
  orderId: string;
  buyerId: string;
  sellerId: string;
  asset: string;
  fiatAmount: number;
  fiatCurrency: string;
  reason: string;
  status: "OPEN" | "UNDER_REVIEW" | "RESOLVED_BUYER" | "RESOLVED_SELLER" | "CANCELED";
  raisedBy: "BUYER" | "SELLER";
  assignedAdmin?: string;
  createdAt: string;
}

export interface AdminDashboardKPIs {
  totalUsers: number;
  activeUsers: number;
  newUsers: number;
  suspendedUsers: number;
  
  volume24h: number;
  trades24h: number;
  openOrders: number;
  activeMarkets: number;
  
  totalPlatformBalance: number;
  depositsToday: number;
  withdrawalsToday: number;
  pendingWithdrawals: number;
  
  activeP2POrders: number;
  p2pVolume24h: number;
  pendingDisputes: number;
  activeMerchants: number;
  
  pendingKyc: number;
  rejectedKyc: number;
  highRiskAccounts: number;
  
  apiStatus: string;
  dbStatus: string;
  errorRate: number;
}

export interface AuditEvent {
  id: string;
  adminId: string;
  adminRole: AdminRole;
  action: string;
  entity: string;
  entityId: string;
  reason?: string;
  ip: string;
  timestamp: string;
}
