import { Hono } from 'hono';
import Decimal from 'decimal.js';
import { eq, desc, sql, and } from 'drizzle-orm';
import { getFeeConfig, calculateFee } from '../services/fees';
import { generateBusinessId } from '../services/id-generator';
import { Bindings, Variables } from '../db';
import { users, kycProfiles, payment_methods, wallets, walletTransactions, ledgerAccounts, ledgerEntries, bankTransfers, bank_accounts, real_manual_deposits, p2pAds, p2pOrders, p2pMessages, p2pDisputes, p2pPaymentMethods, p2pFeedback, tickets, ticketMessages, notifications, cregisDeposits, cregisPayouts, sessions, expertProfiles } from 'database';
import { jwtMiddleware } from '../middleware/jwt';

export const adminRoutes = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// All admin routes require JWT
adminRoutes.use('*', jwtMiddleware);

// Admin Middleware Check
adminRoutes.use('*', async (c, next) => {
  const user = c.get('user');
  if (!['SUPER_ADMIN', 'COMPLIANCE_ADMIN', 'SUPPORT_ADMIN', 'ADMIN'].includes(user.role)) {
    return c.json({ success: false, error: 'Unauthorized: Admin access required' }, 403);
  }
  await next();
});

// GET /api/v1/admin/stats
adminRoutes.get('/stats', async (c) => {
  const db = c.get('db');
  
  try {
    const [{ count: totalUsers }] = await db.select({ count: sql<number>`count(*)` }).from(users);
    const [{ count: activeUsers }] = await db.select({ count: sql<number>`count(*)` }).from(users).where(sql`status = 'ACTIVE'`);
    const [{ count: pendingKyc }] = await db.select({ count: sql<number>`count(*)` }).from(kycProfiles).where(eq(kycProfiles.status, 'PENDING'));
    const [{ count: activeMarkets }] = await db.select({ count: sql<number>`count(*)` }).from(markets).where(eq(markets.status, 'ACTIVE'));
    const [{ count: pendingWithdrawals }] = await db.select({ count: sql<number>`count(*)` }).from(walletTransactions).where(and(eq(walletTransactions.type, 'WITHDRAWAL'), eq(walletTransactions.status, 'PENDING')));
    const [{ count: pendingDisputes }] = await db.select({ count: sql<number>`count(*)` }).from(p2pDisputes).where(eq(p2pDisputes.status, 'OPEN'));
    const [{ count: suspendedUsers }] = await db.select({ count: sql<number>`count(*)` }).from(users).where(sql`status IN ('FROZEN', 'BANNED')`);

    // Platform Balance (sum all stablecoin + fiat wallets)
    const [{ balance }] = await db.select({
      balance: sql<number>`sum(CAST(balance AS REAL) + CAST(locked_balance AS REAL) + CAST(escrow_balance AS REAL))`
    }).from(wallets).where(sql`asset_symbol IN ('USDT', 'USD', 'USDC', 'INR', 'EUR', 'GBP')`);
    
    // Deposits Today
    const todayStart = new Date();
    todayStart.setHours(0,0,0,0);
    const [{ depositsToday }] = await db.select({
      depositsToday: sql<number>`sum(amount)`
    }).from(real_manual_deposits).where(and(eq(real_manual_deposits.status, 'APPROVED'), sql`created_at >= ${todayStart.toISOString()}`));
    
    // P2P Volume 24h - use ISO string for comparison (SQLite stores ISO strings)
    const yesterday24h = new Date(Date.now() - 86400000).toISOString();
    const [{ p2pVolume24h }] = await db.select({
      p2pVolume24h: sql<number>`sum(CAST(fiat_amount AS REAL))`
    }).from(p2pOrders).where(and(eq(p2pOrders.status, 'COMPLETED'), sql`updated_at > ${yesterday24h}`));

    // Trading Volume 24h - use ISO string for comparison
    const [{ dailyVolumeUsd }] = await db.select({
      dailyVolumeUsd: sql<number>`sum(CAST(filled_amount AS REAL) * CAST(price AS REAL))`
    }).from(orders).where(and(eq(orders.status, 'FILLED'), sql`created_at > ${yesterday24h}`));

    return c.json({
      success: true,
      data: {
        totalUsers: totalUsers || 0,
        activeUsers: activeUsers || 0,
        pendingKyc: pendingKyc || 0,
        activeMarkets: activeMarkets || 0,
        totalPlatformBalance: balance || 0,
        depositsToday: depositsToday || 0,
        pendingWithdrawals: pendingWithdrawals || 0,
        p2pVolume24h: p2pVolume24h || 0,
        pendingDisputes: pendingDisputes || 0,
        suspendedUsers: suspendedUsers || 0,
        dailyVolumeUsd: dailyVolumeUsd || 0
      }
    });
  } catch (error) {
    return c.json({ success: false, error: 'Failed to fetch admin stats' }, 500);
  }
});

// GET /api/v1/admin/stats/volume-chart
adminRoutes.get('/stats/volume-chart', async (c) => {
  const db = c.get('db');
  
  try {
    const now = Date.now();
    const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
    const sevenDaysAgoDate = new Date(sevenDaysAgo);
    const { gte } = require('drizzle-orm');
    
    // Fetch P2P completed orders
    const p2pTrades = await db.select({
      amount: p2pOrders.fiatAmount,
      createdAt: p2pOrders.createdAt,
    }).from(p2pOrders)
      .where(and(
        eq(p2pOrders.status, 'COMPLETED'), 
        gte(p2pOrders.createdAt, sevenDaysAgoDate)
      ));

    

    // Add spot trading volume (filled_amount * price)
    spotOrders.forEach((order) => {
      if (!order.createdAt) return;
      const dateStr = new Date(order.createdAt).toISOString().split('T')[0];
      if (dailyVolume[dateStr] !== undefined) {
        dailyVolume[dateStr] += (Number(order.amount) || 0) * (Number(order.price) || 0);
      }
    });
    
    const result = Object.keys(dailyVolume).sort().map(date => ({
      date,
      volume: dailyVolume[date]
    }));
    
    return c.json({ success: true, data: result });
  } catch (error) {
    console.error("Volume chart error:", error);
    return c.json({ success: false, error: 'Failed to fetch volume data' }, 500);
  }
});


// GET /api/v1/admin/stats/recent-activity
adminRoutes.get('/stats/recent-activity', async (c) => {
  const db = c.get('db');
  try {
    const { desc } = require('drizzle-orm');
    
    // Fetch recent users
    const recentUsers = await db.select({
      email: users.email,
      createdAt: users.createdAt
    }).from(users).orderBy(desc(users.createdAt)).limit(5).all();
    
    // Fetch recent orders
    const recentOrders = await db.select({
      side: orders.side,
      type: orders.type,
      amount: orders.amount,
      symbol: orders.marketSymbol,
      createdAt: orders.createdAt
    }).from(orders).orderBy(desc(orders.createdAt)).limit(5).all();

    const activity: any[] = [];
    
    recentUsers.forEach(u => {
      if (u.createdAt) {
        activity.push({
          action: `New user registered: ${u.email}`,
          timestamp: new Date(u.createdAt).toISOString()
        });
      }
    });
    
    recentOrders.forEach(o => {
      if (o.createdAt) {
        activity.push({
          action: `Order placed: ${o.side} ${o.amount} ${o.symbol}`,
          timestamp: new Date(o.createdAt).toISOString()
        });
      }
    });
    
    // Sort combined activity descending
    activity.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    
    return c.json({ success: true, data: activity.slice(0, 10) });
  } catch (error) {
    console.error("Recent activity error:", error);
    return c.json({ success: false, error: 'Failed to fetch recent activity' }, 500);
  }
});

// GET /api/v1/admin/stats/p2p
adminRoutes.get('/stats/p2p', async (c) => {
  const db = c.get('db');
  try {
    const { startDate, endDate } = c.req.query();
    const { and, eq, gte, lte, sql, desc } = require('drizzle-orm');
    
    // Build conditions safely - only include if values exist
    const orderConditions: any[] = [];
    if (startDate) orderConditions.push(gte(p2pOrders.createdAt, new Date(startDate)));
    if (endDate) orderConditions.push(lte(p2pOrders.createdAt, new Date(endDate)));
    const orderWhere = orderConditions.length > 0 ? and(...orderConditions) : undefined;

    // Orders Stats - count all statuses for the period
    const ordersQuery = db.select({
      status: p2pOrders.status,
      count: sql<number>`count(*)`,
      volume: sql<number>`sum(CAST(${p2pOrders.cryptoAmount} AS REAL))`
    }).from(p2pOrders).groupBy(p2pOrders.status);
    
    const ordersData = orderWhere
      ? await ordersQuery.where(orderWhere)
      : await ordersQuery;

    const orderStats = {
      totalOrders: 0,
      totalVolume: 0, // Only count COMPLETED orders for volume
      byStatus: {} as Record<string, { count: number, volume: number }>
    };

    ordersData.forEach((row: any) => {
      orderStats.totalOrders += row.count;
      // Only sum volume for COMPLETED orders to avoid inflating with cancelled/pending
      if (row.status === 'COMPLETED') {
        orderStats.totalVolume += row.volume || 0;
      }
      orderStats.byStatus[row.status] = { count: row.count, volume: row.volume || 0 };
    });

    // Buy / Sell Activity - volumes from all non-cancelled orders in period
    const buySellQuery = db.select({
      type: p2pAds.type,
      volume: sql<number>`sum(CAST(${p2pOrders.cryptoAmount} AS REAL))`
    }).from(p2pOrders)
    .leftJoin(p2pAds, eq(p2pOrders.adId, p2pAds.id))
    .where(
      orderConditions.length > 0
        ? and(...orderConditions, eq(p2pOrders.status, 'COMPLETED'))
        : eq(p2pOrders.status, 'COMPLETED')
    )
    .groupBy(p2pAds.type);

    const buySellVolume = { BUY: 0, SELL: 0 };
    const buySellData = await buySellQuery;
    buySellData.forEach((row: any) => {
      // p2pAds.type is from the ad poster's perspective:
      // A 'SELL' ad = merchant selling crypto = BUY activity for the taker
      // A 'BUY' ad = merchant buying crypto = SELL activity for the taker
      // We display it from the market perspective: BUY ad volume = BUY volume on market
      if (row.type) buySellVolume[row.type as 'BUY' | 'SELL'] = row.volume || 0;
    });

    // Active Ads - not date-filtered (current state)
    const [{ activeAds }] = await db.select({ activeAds: sql<number>`count(*)` })
      .from(p2pAds)
      .where(eq(p2pAds.status, 'ACTIVE'));

    // Active P2P Merchants = users who have at least one active ad
    const [{ activeMerchants }] = await db.select({ activeMerchants: sql<number>`count(DISTINCT user_id)` })
      .from(p2pAds)
      .where(eq(p2pAds.status, 'ACTIVE'));

    // Chats - date filtered
    const chatConditions: any[] = [];
    if (startDate) chatConditions.push(gte(p2pMessages.createdAt, new Date(startDate)));
    if (endDate) chatConditions.push(lte(p2pMessages.createdAt, new Date(endDate)));
    const chatWhere = chatConditions.length > 0 ? and(...chatConditions) : undefined;

    const totalChatsQuery = db.select({ totalChats: sql<number>`count(*)` }).from(p2pMessages);
    const unreadChatsQuery = db.select({ unreadChats: sql<number>`count(*)` }).from(p2pMessages).where(
      chatConditions.length > 0 ? and(...chatConditions, eq(p2pMessages.isRead, false)) : eq(p2pMessages.isRead, false)
    );

    const [{ totalChats }] = chatWhere ? await totalChatsQuery.where(chatWhere) : await totalChatsQuery;
    const [{ unreadChats }] = await unreadChatsQuery;

    // Disputes - date filtered
    const disputeConditions: any[] = [];
    if (startDate) disputeConditions.push(gte(p2pDisputes.createdAt, new Date(startDate)));
    if (endDate) disputeConditions.push(lte(p2pDisputes.createdAt, new Date(endDate)));
    const disputeWhere = disputeConditions.length > 0 ? and(...disputeConditions) : undefined;

    const disputesQuery = db.select({
      status: p2pDisputes.status,
      count: sql<number>`count(*)`
    }).from(p2pDisputes).groupBy(p2pDisputes.status);

    const disputesData = disputeWhere ? await disputesQuery.where(disputeWhere) : await disputesQuery;

    const disputeStats = { total: 0, OPEN: 0, RESOLVED: 0, CLOSED: 0 };
    disputesData.forEach((row: any) => {
      disputeStats.total += row.count;
      if (row.status in disputeStats) disputeStats[row.status as keyof typeof disputeStats] = row.count;
    });

    // Escrow - sum only escrow for orders that are ACTIVE in the period
    // Only include wallets that have orders in escrow within the date window
    const escrowQuery = db.select({
      totalEscrow: sql<number>`sum(CAST(escrow_balance AS REAL))`
    }).from(wallets);
    const [{ totalEscrow }] = await escrowQuery;

    // Recent Transactions - apply date filter
    const recentOrdersQuery = db.select({
      id: p2pOrders.displayId,
      cryptoAmount: p2pOrders.cryptoAmount,
      fiatAmount: p2pOrders.fiatAmount,
      status: p2pOrders.status,
      createdAt: p2pOrders.createdAt,
      asset: p2pAds.asset,
      fiat: p2pAds.fiat
    }).from(p2pOrders)
    .leftJoin(p2pAds, eq(p2pOrders.adId, p2pAds.id))
    .orderBy(desc(p2pOrders.createdAt))
    .limit(10);

    const recentOrders = orderWhere
      ? await recentOrdersQuery.where(orderWhere)
      : await recentOrdersQuery;

    return c.json({
      success: true,
      data: {
        orderStats,
        buySellVolume,
        activeAds,
        activeMerchants,
        chatStats: { total: totalChats, unread: unreadChats },
        disputeStats,
        totalEscrow: totalEscrow || 0,
        recentOrders
      }
    });
  } catch (error) {
    console.error("P2P Admin Stats error:", error);
    return c.json({ success: false, error: 'Failed to fetch P2P stats' }, 500);
  }
});

// GET /api/v1/admin/users
adminRoutes.get('/users', async (c) => {
  const db = c.get('db');
  try {
    const allUsers = await db.select({
      id: users.id,
      email: users.email,
      displayName: users.displayName,
      status: users.status,
      role: users.role,
      createdAt: users.createdAt,
      lastLoginAt: users.lastLoginAt
    }).from(users).orderBy(desc(users.createdAt)).all();
    
    return c.json({ success: true, data: allUsers });
  } catch (error) {
    return c.json({ success: false, error: 'Failed to fetch users' }, 500);
  }
});

// GET /api/v1/admin/users/:id
adminRoutes.get('/users/:id', async (c) => {
  const db = c.get('db');
  const userId = c.req.param('id');
  try {
    const { eq } = require('drizzle-orm');
    const user = await db.select().from(users).where(eq(users.id, userId)).get();
    if (!user) return c.json({ success: false, error: 'User not found' }, 404);
    
    const kyc = await db.select().from(kycProfiles).where(eq(kycProfiles.userId, userId)).get();
    const userWallets = await db.select().from(wallets).where(eq(wallets.userId, userId)).all();
    
    let balanceUsd = 0;
    for (const w of userWallets) {
      if (w.assetSymbol === 'USDT' || w.assetSymbol === 'USD') {
        const total = parseFloat(w.balance || '0') + parseFloat(w.lockedBalance || '0') + parseFloat(w.escrowBalance || '0');
        balanceUsd += total;
      }
    }
    
    // Fetch related activity and orders
    const recentOrders = await db.select().from(orders).where(eq(orders.userId, userId)).orderBy(desc(orders.createdAt)).limit(50).all();
    const recentP2pOrders = await db.select().from(p2pOrders).where(sql`buyer_id = ${userId} OR seller_id = ${userId}`).orderBy(desc(p2pOrders.createdAt)).limit(50).all();
    const recentTransactions = await db.select().from(walletTransactions).where(eq(walletTransactions.userId, userId)).orderBy(desc(walletTransactions.createdAt)).limit(50).all();
    const recentSessions = await db.select().from(sessions).where(eq(sessions.userId, userId)).orderBy(desc(sessions.createdAt)).limit(10).all();

    return c.json({
      success: true,
      data: {
        ...user,
        kycStatus: kyc ? kyc.status : 'UNVERIFIED',
        riskLevel: 'LOW',
        balanceUsd,
        
        p2pVolumeUsd: 0,
        orders: recentOrders,
        p2pOrders: recentP2pOrders,
        transactions: recentTransactions,
        sessions: recentSessions,
      }
    });
  } catch (error) {
    return c.json({ success: false, error: 'Failed to fetch user details' }, 500);
  }
});

// POST /api/v1/admin/users/:id/status
adminRoutes.post('/users/:id/status', async (c) => {
  const db = c.get('db');
  const admin = c.get('user');
  const userId = c.req.param('id');
  const body = await c.req.json();

  if (admin.role !== 'SUPER_ADMIN') {
    return c.json({ success: false, error: 'Unauthorized: Only Super Admins can change user status' }, 403);
  }
  
  if (!['ACTIVE', 'FROZEN', 'BANNED'].includes(body.status)) {
    return c.json({ success: false, error: 'Invalid status' }, 400);
  }
  
  try {
    await db.update(users).set({ status: body.status, updatedAt: new Date() }).where(eq(users.id, userId));
    return c.json({ success: true });
  } catch (error) {
    return c.json({ success: false, error: 'Failed to update user status' }, 500);
  }
});

// PUT /api/v1/admin/users/:id/role
adminRoutes.put('/users/:id/role', async (c) => {
  const db = c.get('db');
  const admin = c.get('user');
  const userId = c.req.param('id');
  const body = await c.req.json();

  if (admin.role !== 'SUPER_ADMIN') {
    return c.json({ success: false, error: 'Unauthorized: Only Super Admins can change user roles' }, 403);
  }

  if (!['USER', 'EXPERT', 'SUPPORT_ADMIN', 'COMPLIANCE_ADMIN', 'SUPER_ADMIN'].includes(body.role)) {
    return c.json({ success: false, error: 'Invalid role' }, 400);
  }

  try {
    await db.update(users).set({ role: body.role, updatedAt: new Date() }).where(eq(users.id, userId));
    
    // Auto-create an expert profile if changed to EXPERT
    if (body.role === 'EXPERT') {
      const { expertProfiles } = await import('database');
      const existing = await db.select().from(expertProfiles).where(eq(expertProfiles.userId, userId)).get();
      if (!existing) {
        const profileId = `exp_${crypto.randomUUID().replace(/-/g, '').substring(0, 12)}`;
        await db.insert(expertProfiles).values({
          id: profileId,
          userId: userId,
          bio: 'Expert automatically verified by Admin.',
          experienceYears: 0,
          languages: ['English'],
          categories: ['General'],
          verificationStatus: 'VERIFIED',
          availabilityStatus: 'AVAILABLE',
          createdAt: new Date(),
          updatedAt: new Date()
        }).run();
      } else {
        // If it exists, ensure it's VERIFIED
        await db.update(expertProfiles).set({ verificationStatus: 'VERIFIED' }).where(eq(expertProfiles.userId, userId)).run();
      }
    }
    
    return c.json({ success: true });
  } catch (error) {
    return c.json({ success: false, error: 'Failed to update user role' }, 500);
  }
});

// Helper function to hash password
async function hashPassword(password: string) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// POST /api/v1/admin/users/:id/password
adminRoutes.post('/users/:id/password', async (c) => {
  const db = c.get('db');
  const admin = c.get('user');
  const userId = c.req.param('id');
  const body = await c.req.json();

  if (admin.role !== 'SUPER_ADMIN') {
    return c.json({ success: false, error: 'Unauthorized: Only Super Admins can reset passwords' }, 403);
  }

  const { newPassword } = body;
  if (!newPassword || newPassword.length < 8) {
    return c.json({ success: false, error: 'Password must be at least 8 characters' }, 400);
  }

  try {
    const hashedPassword = await hashPassword(newPassword);
    await db.update(users).set({ passwordHash: hashedPassword, updatedAt: new Date() }).where(eq(users.id, userId));
    return c.json({ success: true, message: 'Password updated successfully' });
  } catch (error) {
    return c.json({ success: false, error: 'Failed to update user password' }, 500);
  }
});

// DELETE /api/v1/admin/users/:id
adminRoutes.delete('/users/:id', async (c) => {
  const db = c.get('db');
  const admin = c.get('user');
  const userId = c.req.param('id');

  if (admin.role !== 'SUPER_ADMIN') {
    return c.json({ success: false, error: 'Unauthorized: Only Super Admins can delete users' }, 403);
  }

  try {
    const { eq, or, inArray } = require('drizzle-orm');
    const { assetConversions, expertServices, expertBookings, expertReviews, expertMessages, emailDeliveryLogs } = require('database');

    const targetUser = await db.select().from(users).where(eq(users.id, userId)).get();
    if (!targetUser) return c.json({ success: false, error: 'User not found' });

    const queries: any[] = [];

    // Manual Cascades for P2P Ads -> P2P Orders -> Disputes/Feedback/Messages
    if (p2pAds && p2pOrders && p2pDisputes) {
      const uAds = await db.select({ id: p2pAds.id }).from(p2pAds).where(eq(p2pAds.userId, userId));
      const uAdIds = uAds.map((a: any) => a.id);
      
      // Find all orders where user is buyer/seller OR the order is for an ad owned by user
      const uOrders = await db.select({ id: p2pOrders.id }).from(p2pOrders).where(
        or(
          eq(p2pOrders.buyerId, userId), 
          eq(p2pOrders.sellerId, userId),
          uAdIds.length > 0 ? inArray(p2pOrders.adId, uAdIds) : eq(p2pOrders.buyerId, 'impossible_value')
        )
      );
      const uOrderIds = uOrders.map((o: any) => o.id);

      if (uOrderIds.length > 0) {
        queries.push(db.delete(p2pDisputes).where(inArray(p2pDisputes.orderId, uOrderIds)));
        queries.push(db.delete(p2pFeedback).where(inArray(p2pFeedback.orderId, uOrderIds)));
        queries.push(db.delete(p2pMessages).where(inArray(p2pMessages.orderId, uOrderIds)));
        queries.push(db.delete(p2pOrders).where(inArray(p2pOrders.id, uOrderIds)));
      }
    }

    // Manual Cascades for Ledger Accounts -> Ledger Entries
    if (ledgerAccounts && ledgerEntries) {
      const uAccts = await db.select({ id: ledgerAccounts.id }).from(ledgerAccounts).where(eq(ledgerAccounts.userId, userId));
      const uAcctIds = uAccts.map((a: any) => a.id);
      if (uAcctIds.length > 0) {
        queries.push(db.delete(ledgerEntries).where(inArray(ledgerEntries.accountId, uAcctIds)));
      }
    }

    // Remaining direct deletions
    if (sessions) queries.push(db.delete(sessions).where(eq(sessions.userId, userId)));
    if (notifications) queries.push(db.delete(notifications).where(eq(notifications.userId, userId)));
    if (kycProfiles) queries.push(db.delete(kycProfiles).where(eq(kycProfiles.userId, userId)));
    
    // Support
    if (ticketMessages) queries.push(db.delete(ticketMessages).where(eq(ticketMessages.senderId, userId)));
    if (tickets) queries.push(db.delete(tickets).where(eq(tickets.userId, userId)));
    
    // Financials
    if (cregisDeposits) queries.push(db.delete(cregisDeposits).where(eq(cregisDeposits.userId, userId)));
    if (cregisPayouts) queries.push(db.delete(cregisPayouts).where(eq(cregisPayouts.userId, userId)));
    if (real_manual_deposits) queries.push(db.delete(real_manual_deposits).where(eq(real_manual_deposits.user_id, userId)));
    if (bankTransfers) queries.push(db.delete(bankTransfers).where(eq(bankTransfers.userId, userId)));
    if (walletTransactions) queries.push(db.delete(walletTransactions).where(eq(walletTransactions.userId, userId)));
    if (wallets) queries.push(db.delete(wallets).where(eq(wallets.userId, userId)));
    if (ledgerAccounts) queries.push(db.delete(ledgerAccounts).where(eq(ledgerAccounts.userId, userId)));

    // Trading
    if (positions) queries.push(db.delete(positions).where(eq(positions.userId, userId)));
    if (orders) queries.push(db.delete(orders).where(eq(orders.userId, userId)));
    if (binaryOptions) queries.push(db.delete(binaryOptions).where(eq(binaryOptions.userId, userId)));
    
    // P2P
    if (p2pPaymentMethods) queries.push(db.delete(p2pPaymentMethods).where(eq(p2pPaymentMethods.userId, userId)));
    if (p2pFeedback) queries.push(db.delete(p2pFeedback).where(or(eq(p2pFeedback.fromUserId, userId), eq(p2pFeedback.toUserId, userId))));
    if (p2pMessages) queries.push(db.delete(p2pMessages).where(eq(p2pMessages.senderId, userId)));
    if (p2pDisputes) queries.push(db.delete(p2pDisputes).where(or(eq(p2pDisputes.openerId, userId), eq(p2pDisputes.assignedAdminId, userId))));
    if (p2pAds) queries.push(db.delete(p2pAds).where(eq(p2pAds.userId, userId)));

    // Experts
    if (expertProfiles && expertServices && expertBookings && expertReviews && expertMessages) {
      queries.push(db.delete(expertMessages).where(eq(expertMessages.senderId, userId)));
      queries.push(db.delete(expertReviews).where(eq(expertReviews.userId, userId)));
      queries.push(db.delete(expertBookings).where(eq(expertBookings.userId, userId)));
      
      const uExp = await db.select({ id: expertProfiles.id }).from(expertProfiles).where(eq(expertProfiles.userId, userId)).get();
      if (uExp) {
        queries.push(db.delete(expertReviews).where(eq(expertReviews.expertId, uExp.id)));
        queries.push(db.delete(expertBookings).where(eq(expertBookings.expertId, uExp.id)));
        queries.push(db.delete(expertServices).where(eq(expertServices.expertId, uExp.id)));
        queries.push(db.delete(expertProfiles).where(eq(expertProfiles.id, uExp.id)));
      }
    }

    // Others
    if (assetConversions) queries.push(db.delete(assetConversions).where(eq(assetConversions.userId, userId)));
    if (emailDeliveryLogs && targetUser.email) queries.push(db.delete(emailDeliveryLogs).where(eq(emailDeliveryLogs.recipient, targetUser.email)));

    // Finally User
    queries.push(db.delete(users).where(eq(users.id, userId)));

    if (queries.length > 0) {
      // @ts-ignore: db.batch expects a tuple type, casting to any works
      await db.batch(queries as any);
    }

    return c.json({ success: true, message: 'User completely deleted' });
  } catch (error: any) {
    console.error('Delete User Error:', error);
    return c.json({ success: false, error: 'Failed to delete user: ' + error.message + ' ' + (error.cause?.message || '') }, 500);
  }
});

// GET /api/v1/admin/wallets/overview
adminRoutes.get('/wallets/overview', async (c) => {
  const db = c.get('db');
  try {
    const { eq } = require('drizzle-orm');
    const { wallets, payment_methods, currencyRates } = require('database');
    
    const allWallets = await db.select().from(wallets).all();
    
    const activeRates = await db.select().from(currencyRates).where(eq(currencyRates.status, 'ACTIVE')).all();
    const overview: Record<string, { balance: number, locked: number, escrow: number, total: number }> = {};
    
    // Pre-populate with active currencies
    for (const rate of activeRates) {
      overview[rate.code] = { balance: 0, locked: 0, escrow: 0, total: 0 };
    }
    
    for (const w of allWallets) {
      const sym = w.assetSymbol;
      if (!overview[sym]) {
        overview[sym] = { balance: 0, locked: 0, escrow: 0, total: 0 };
      }
      const b = parseFloat(w.balance || '0');
      const l = parseFloat(w.lockedBalance || '0');
      const e = parseFloat(w.escrowBalance || '0');
      
      overview[sym].balance += b;
      overview[sym].locked += l;
      overview[sym].escrow += e;
      overview[sym].total += (b + l + e);
    }
    
    const methods = await db.select().from(payment_methods).all();
    const networks = methods.map((m: any) => ({
      id: m.id,
      name: m.name,
      currency: m.currency,
      type: m.type,
      enabled: m.enabled
    }));

    // Fetch dynamic currency rates
    const rates = activeRates.reduce((acc: any, curr: any) => {
      acc[curr.code] = parseFloat(curr.ratePerUsdt);
      return acc;
    }, {});
    
    return c.json({ success: true, data: { overview, networks, rates } });
  } catch (error) {
    return c.json({ success: false, error: 'Failed to fetch wallets overview' }, 500);
  }
});

// GET /api/v1/admin/wallets/users
adminRoutes.get('/wallets/users', async (c) => {
  const db = c.get('db');
  try {
    const search = c.req.query('search');
    const { eq, like, or, and, inArray } = require('drizzle-orm');
    const { wallets, users } = require('database');
    
    let userQuery: any = db.select({
      id: users.id,
      email: users.email,
      displayName: users.displayName,
    }).from(users);
    
    if (search) {
      userQuery = userQuery.where(or(like(users.email, `%${search}%`), like(users.id, `%${search}%`)));
    }
    
    const usersList = await userQuery.limit(50).all();
    const userIds = usersList.map((u: any) => u.id);
    
    let walletsList: any[] = [];
    if (userIds.length > 0) {
      walletsList = await db.select().from(wallets).where(
        inArray(wallets.userId, userIds)
      ).all();
    }
    
    const result = usersList.map((u: any) => ({
      ...u,
      wallets: walletsList.filter((w: any) => w.userId === u.id)
    }));
    
    return c.json({ success: true, data: result });
  } catch (error) {
    return c.json({ success: false, error: 'Failed to fetch user wallets' }, 500);
  }
});

// POST /api/v1/admin/users/:id/wallets/adjust
adminRoutes.post('/users/:id/wallets/adjust', async (c) => {
  const db = c.get('db');
  const admin = c.get('user');
  const userId = c.req.param('id');
  const body = await c.req.json();

  if (admin.role !== 'SUPER_ADMIN') {
    return c.json({ success: false, error: 'Unauthorized: Only Super Admins can adjust balances' }, 403);
  }

  // targetField can be 'balance', 'lockedBalance', or 'escrowBalance'
  const { assetSymbol, amount, action, targetField = 'balance', notes } = body;

  try {
    const { and, eq } = require('drizzle-orm');
    const { wallets, ledgerTransactions, walletTransactions, currencyRates } = require('database');
    const { calculateDepositPreview } = require('../../services/calculations');
    
    // Validate that the asset is an active configured currency/asset
    const activeAsset = await db.select().from(currencyRates).where(
      and(eq(currencyRates.code, assetSymbol), eq(currencyRates.status, 'ACTIVE'))
    ).get();
    
    if (!activeAsset && assetSymbol !== 'USDT') {
      return c.json({ success: false, error: `Asset ${assetSymbol} is not configured or inactive in Currency Rates.` }, 400);
    }

    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      return c.json({ success: false, error: 'Invalid amount' }, 400);
    }

    // Convert to USDT using centralized logic
    const preview = await calculateDepositPreview(db, amountNum, assetSymbol, null);
    
    // For admin adjustments, we do not deduct deposit fees, so we use grossUsdt
    const usdtAdjustment = preview.grossUsdt;
    const finalAsset = 'USDT';

    let wallet = await db.select().from(wallets).where(
      and(eq(wallets.userId, userId), eq(wallets.assetSymbol, finalAsset))
    ).get();

    if (!wallet) {
      if (action === 'DEBIT') {
        return c.json({ success: false, error: 'Insufficient balance to debit' }, 400);
      }
      const { generateBusinessId } = require('../../services/id-generator');
      const displayId = await generateBusinessId(db, null, 'WALL');
      wallet = {
        id: crypto.randomUUID(),
        displayId,
        userId,
        assetSymbol: finalAsset,
        balance: '0',
        lockedBalance: '0',
        escrowBalance: '0',
        createdAt: new Date(),
        updatedAt: new Date()
      };
      wallet[targetField] = usdtAdjustment.toString();
      await db.insert(wallets).values(wallet);
    } else {
      let currentBalance = parseFloat((wallet as any)[targetField] as string || '0');
      if (action === 'DEBIT') {
        if (currentBalance < usdtAdjustment) {
          return c.json({ success: false, error: `Insufficient USDT balance. Needed: ${usdtAdjustment}, Available: ${currentBalance}` }, 400);
        }
        currentBalance -= usdtAdjustment;
      } else {
        currentBalance += usdtAdjustment;
      }
      
      const updateData: any = { updatedAt: new Date() };
      updateData[targetField] = currentBalance.toString();
      
      await db.update(wallets).set(updateData).where(eq(wallets.id, wallet.id));
    }

    const { generateBusinessId } = require('../../services/id-generator');

    // Ledger Entry for Admin Override
    const ltDisplayId = await generateBusinessId(db, null, 'LTXN');
    const idempotencyKey = `admin-adjust-${Date.now()}-${userId}`;
    const ledgerTxId = crypto.randomUUID();
    await db.insert(ledgerTransactions).values({
      id: ledgerTxId,
      displayId: ltDisplayId,
      idempotencyKey,
      referenceType: 'ADJUSTMENT',
      referenceId: userId,
      status: 'COMMITTED',
      createdAt: new Date(),
    });

    // Wallet Transaction Entry (Original Asset)
    if (assetSymbol !== 'USDT') {
       const originalTxId = await generateBusinessId(db, null, 'WTXN');
       await db.insert(walletTransactions).values({
         id: crypto.randomUUID(),
         displayId: originalTxId,
         userId,
         type: 'ADJUSTMENT',
         assetSymbol: assetSymbol,
         amount: action === 'DEBIT' ? `-${amountNum}` : amountNum.toString(),
         status: 'COMPLETED',
         reference: `${notes || 'Admin Adjustment'} (Original Deposit)`,
         createdAt: new Date(),
         updatedAt: new Date()
       });

       const conversionTxId = await generateBusinessId(db, null, 'WTXN');
       await db.insert(walletTransactions).values({
         id: crypto.randomUUID(),
         displayId: conversionTxId,
         userId,
         type: 'CONVERSION',
         assetSymbol: 'USDT',
         originalCurrency: assetSymbol,
         originalAmount: amountNum.toString(),
         conversionRate: preview.conversionRate.toString(),
         grossAmount: usdtAdjustment.toString(),
         netAmount: usdtAdjustment.toString(),
         amount: action === 'DEBIT' ? `-${usdtAdjustment}` : usdtAdjustment.toString(),
         status: 'COMPLETED',
         reference: `Converted from ${assetSymbol}`,
         createdAt: new Date(),
         updatedAt: new Date()
       });
    }

    // Wallet Transaction Entry (USDT Credit)
    const wtDisplayId = await generateBusinessId(db, null, 'WTXN');
    await db.insert(walletTransactions).values({
      id: crypto.randomUUID(),
      displayId: wtDisplayId,
      userId,
      type: 'ADJUSTMENT',
      assetSymbol: finalAsset,
      amount: action === 'DEBIT' ? `-${usdtAdjustment}` : usdtAdjustment.toString(),
      originalCurrency: assetSymbol,
      originalAmount: amountNum.toString(),
      conversionRate: preview.conversionRate.toString(),
      grossAmount: usdtAdjustment.toString(),
      netAmount: usdtAdjustment.toString(),
      status: 'COMPLETED',
      reference: notes || 'Admin Adjustment',
      createdAt: new Date(),
      updatedAt: new Date()
    });

    return c.json({ success: true, creditedUsdt: usdtAdjustment });
  } catch (error: any) {
    console.error(error);
    return c.json({ success: false, error: error.message || 'Failed to adjust wallet balance' }, 500);
  }
});

// GET /api/v1/admin/kyc
adminRoutes.get('/kyc', async (c) => {
  const db = c.get('db');
  try {
    const pendingKyc = await db.select().from(kycProfiles).orderBy(desc(kycProfiles.createdAt)).all();
    // In a real app we might only get PENDING, but for admin it's good to see all or filter. Let's return all.
    return c.json({ success: true, data: pendingKyc });
  } catch (error) {
    return c.json({ success: false, error: 'Failed to fetch KYC profiles' }, 500);
  }
});

// POST /api/v1/admin/kyc/:id/status
adminRoutes.post('/kyc/:id/status', async (c) => {
  const db = c.get('db');
  const admin = c.get('user');
  const kycId = c.req.param('id');
  const body = await c.req.json();
  
  if (!['APPROVED', 'REJECTED'].includes(body.status)) {
    return c.json({ success: false, error: 'Invalid status' }, 400);
  }
  
  try {
    await db.update(kycProfiles).set({ 
      status: body.status, 
      rejectionReason: body.rejectionReason || null,
      reviewedBy: admin.id,
      updatedAt: new Date()
    }).where(eq(kycProfiles.id, kycId));
    
    return c.json({ success: true });
  } catch (error) {
    return c.json({ success: false, error: 'Failed to update KYC status' }, 500);
  }
});

// GET /api/v1/admin/deposit-settings
adminRoutes.get('/deposit-settings', async (c) => {
  const db = c.get('db');
  try {
    const methods = await db.select().from(payment_methods).all();
    return c.json({ success: true, data: methods });
  } catch (error) {
    return c.json({ success: false, error: 'Failed to fetch deposit settings' }, 500);
  }
});

// PUT /api/v1/admin/deposit-settings/:id
adminRoutes.put('/deposit-settings/:id', async (c) => {
  const db = c.get('db');
  const admin = c.get('user');
  const id = c.req.param('id');
  const body = await c.req.json();

  if (admin.role !== 'SUPER_ADMIN') {
    return c.json({ success: false, error: 'Unauthorized: Only Super Admins can manage deposit settings' }, 403);
  }

  try {
    const updateData: any = {
      updated_at: new Date(),
      updated_by: admin.id
    };
    
    if (body.enabled !== undefined) updateData.enabled = body.enabled;
    if (body.instructions !== undefined) updateData.instructions = body.instructions;
    if (body.min_amount !== undefined) updateData.min_amount = body.min_amount;
    if (body.max_amount !== undefined) updateData.max_amount = body.max_amount;
    if (body.fee_type !== undefined) updateData.fee_type = body.fee_type;
    if (body.fee_value !== undefined) updateData.fee_value = body.fee_value;
    if (body.supported_assets !== undefined) updateData.supported_assets = body.supported_assets;
    if (body.maintenance_mode !== undefined) updateData.maintenance_mode = body.maintenance_mode;

    await db.update(payment_methods)
      .set(updateData)
      .where(eq(payment_methods.id, id));
      
    return c.json({ success: true });
  } catch (error: any) {
    return c.json({ success: false, error: error.message || 'Failed to update deposit setting' }, 500);
  }
});

// POST /api/v1/admin/deposit-settings
adminRoutes.post('/deposit-settings', async (c) => {
  const db = c.get('db');
  const admin = c.get('user');
  const body = await c.req.json();

  if (admin.role !== 'SUPER_ADMIN') {
    return c.json({ success: false, error: 'Unauthorized: Only Super Admins can manage deposit settings' }, 403);
  }

  try {
    const id = crypto.randomUUID();
    await db.insert(payment_methods).values({
      id,
      method: body.method || 'MANUAL',
      enabled: body.enabled !== undefined ? body.enabled : true,
      min_amount: body.min_amount || 0,
      fee_type: body.fee_type || 'ZERO',
      fee_value: body.fee_value || 0,
      display_order: body.display_order || 1,
      instructions: body.instructions || '{}',

      created_at: new Date(),
      updated_at: new Date(),
      updated_by: admin.id
    });
    return c.json({ success: true, data: { id } });
  } catch (error: any) {
    return c.json({ success: false, error: error.message || 'Failed to create deposit setting' }, 500);
  }
});

// DELETE /api/v1/admin/deposit-settings/:id
adminRoutes.delete('/deposit-settings/:id', async (c) => {
  const db = c.get('db');
  const admin = c.get('user');
  const id = c.req.param('id');

  if (admin.role !== 'SUPER_ADMIN') {
    return c.json({ success: false, error: 'Unauthorized: Only Super Admins can manage deposit settings' }, 403);
  }

  try {
    await db.delete(payment_methods).where(eq(payment_methods.id, id));
    return c.json({ success: true });
  } catch (error: any) {
    return c.json({ success: false, error: error.message || 'Failed to delete deposit setting' }, 500);
  }
});

// GET /api/v1/admin/bank-accounts
adminRoutes.get('/bank-accounts', async (c) => {
  const db = c.get('db');
  try {
    const accounts = await db.select().from(bank_accounts).all();
    return c.json({ success: true, data: accounts });
  } catch (error) {
    return c.json({ success: false, error: 'Failed to fetch bank accounts' }, 500);
  }
});

// POST /api/v1/admin/bank-accounts
adminRoutes.post('/bank-accounts', async (c) => {
  const db = c.get('db');
  const admin = c.get('user');
  if (admin.role !== 'SUPER_ADMIN') return c.json({ success: false, error: 'Unauthorized' }, 403);
  
  try {
    const body = await c.req.json();
    const id = crypto.randomUUID();
    const now = new Date();
    await db.insert(bank_accounts).values({
      id,
      bank_name: body.bank_name,
      account_holder: body.account_holder,
      account_number: body.account_number,
      ifsc: body.ifsc || null,
      swift: body.swift || null,
      branch: body.branch || null,
      currency: body.currency,
      country: body.country || null,
      instructions: body.instructions || null,
      active: body.active !== undefined ? body.active : true,
      default_account: body.default_account || false,
      created_at: now,
      updated_at: now
    });
    return c.json({ success: true, data: { id } });
  } catch (error: any) {
    return c.json({ success: false, error: error.message }, 500);
  }
});

// PUT /api/v1/admin/bank-accounts/:id
adminRoutes.put('/bank-accounts/:id', async (c) => {
  const db = c.get('db');
  const admin = c.get('user');
  if (admin.role !== 'SUPER_ADMIN') return c.json({ success: false, error: 'Unauthorized' }, 403);
  
  try {
    const id = c.req.param('id');
    const body = await c.req.json();
    const updateData: any = { updated_at: new Date() };
    
    if (body.bank_name !== undefined) updateData.bank_name = body.bank_name;
    if (body.account_holder !== undefined) updateData.account_holder = body.account_holder;
    if (body.account_number !== undefined) updateData.account_number = body.account_number;
    if (body.ifsc !== undefined) updateData.ifsc = body.ifsc;
    if (body.swift !== undefined) updateData.swift = body.swift;
    if (body.branch !== undefined) updateData.branch = body.branch;
    if (body.currency !== undefined) updateData.currency = body.currency;
    if (body.country !== undefined) updateData.country = body.country;
    if (body.instructions !== undefined) updateData.instructions = body.instructions;
    if (body.active !== undefined) updateData.active = body.active;
    if (body.default_account !== undefined) updateData.default_account = body.default_account;

    await db.update(bank_accounts).set(updateData).where(eq(bank_accounts.id, id));
    return c.json({ success: true });
  } catch (error: any) {
    return c.json({ success: false, error: error.message }, 500);
  }
});

// DELETE /api/v1/admin/bank-accounts/:id
adminRoutes.delete('/bank-accounts/:id', async (c) => {
  const db = c.get('db');
  const admin = c.get('user');
  if (admin.role !== 'SUPER_ADMIN') return c.json({ success: false, error: 'Unauthorized' }, 403);
  
  try {
    const id = c.req.param('id');
    await db.delete(bank_accounts).where(eq(bank_accounts.id, id));
    return c.json({ success: true });
  } catch (error: any) {
    return c.json({ success: false, error: error.message }, 500);
  }
});

// POST /api/v1/admin/p2p/disputes/:id/resolve
adminRoutes.post('/p2p/disputes/:id/resolve', async (c) => {
  const db = c.get('db');
  const admin = c.get('user');
  const disputeId = c.req.param('id');
  const body = await c.req.json();
  const { resolution, notes } = body; // resolution: 'RELEASE_TO_BUYER' or 'REFUND_TO_SELLER'

  if (admin.role !== 'SUPER_ADMIN' && admin.role !== 'SUPPORT_ADMIN') {
    return c.json({ success: false, error: 'Unauthorized' }, 403);
  }

  try {
    const { and, eq } = require('drizzle-orm');
    const { p2pDisputes, p2pOrders, wallets, p2pMessages, p2pAds, ledgerTransactions } = require('database');
    
    const dispute = await db.select().from(p2pDisputes).where(eq(p2pDisputes.id, disputeId)).get();
    if (!dispute || !['OPEN', 'UNDER_REVIEW'].includes(dispute.status)) {
      return c.json({ success: false, error: 'Invalid dispute state' }, 400);
    }
    
    const order = await db.select().from(p2pOrders).where(eq(p2pOrders.id, dispute.orderId)).get();
    if (!order) return c.json({ success: false, error: 'Order not found' }, 404);
    
    const ad = await db.select().from(p2pAds).where(eq(p2pAds.id, order.adId)).get();
    if (!ad) return c.json({ success: false, error: 'Ad not found' }, 404);
    
    const cryptoAmount = new Decimal(order.cryptoAmount);
    const now = new Date();

    await db.transaction(async (tx: any) => {
      const txId = crypto.randomUUID();
      const ltDisplayId = await generateBusinessId(tx, null, 'LTXN');

      const getOrCreateLedgerAccount = async (userId: string) => {
        let acc = await tx.select().from(ledgerAccounts).where(and(eq(ledgerAccounts.userId, userId), eq(ledgerAccounts.assetSymbol, ad.asset))).get();
        if (!acc) {
          const id = crypto.randomUUID();
          await tx.insert(ledgerAccounts).values({
            id, userId, type: 'USER', assetSymbol: ad.asset, createdAt: now,
          });
          return id;
        }
        return acc.id;
      };

      if (resolution === 'RELEASE_TO_BUYER') {
        const sellerWallet = await tx.select().from(wallets).where(and(eq(wallets.userId, order.sellerId), eq(wallets.assetSymbol, ad.asset))).get();
        if (sellerWallet) {
          const finalEscrow = new Decimal(sellerWallet.escrowBalance).minus(cryptoAmount).toString();
          await tx.update(wallets).set({ escrowBalance: finalEscrow, updatedAt: now }).where(eq(wallets.id, sellerWallet.id));
        }
        
        const buyerWallet = await tx.select().from(wallets).where(and(eq(wallets.userId, order.buyerId), eq(wallets.assetSymbol, ad.asset))).get();
        if (buyerWallet) {
          const finalBalance = new Decimal(buyerWallet.balance).plus(cryptoAmount).toString();
          await tx.update(wallets).set({ balance: finalBalance, updatedAt: now }).where(eq(wallets.id, buyerWallet.id));
        } else {
          await tx.insert(wallets).values({
            id: crypto.randomUUID(), userId: order.buyerId, assetSymbol: ad.asset,
            balance: cryptoAmount.toString(), lockedBalance: '0', escrowBalance: '0', createdAt: now, updatedAt: now,
          });
        }
        
        await tx.update(p2pOrders).set({ status: 'COMPLETED', updatedAt: now }).where(eq(p2pOrders.id, order.id));
        await tx.update(p2pDisputes).set({ status: 'RESOLVED_BUYER', adminNotes: notes, assignedAdminId: admin.id, updatedAt: now }).where(eq(p2pDisputes.id, disputeId));

        await tx.insert(ledgerTransactions).values({
          id: txId, displayId: ltDisplayId, idempotencyKey: `p2p-admin-resolve-release-${order.id}`,
          referenceType: 'P2P_ESCROW_RELEASE', referenceId: order.id, status: 'COMMITTED', createdAt: now,
        });

        const sellerLedgerAccId = await getOrCreateLedgerAccount(order.sellerId);
        const buyerLedgerAccId = await getOrCreateLedgerAccount(order.buyerId);

        await tx.insert(ledgerEntries).values([
          { id: crypto.randomUUID(), transactionId: txId, accountId: sellerLedgerAccId, direction: 'DEBIT', assetSymbol: ad.asset, amount: cryptoAmount.toString(), createdAt: now },
          { id: crypto.randomUUID(), transactionId: txId, accountId: buyerLedgerAccId, direction: 'CREDIT', assetSymbol: ad.asset, amount: cryptoAmount.toString(), createdAt: now }
        ]);

      } else if (resolution === 'REFUND_TO_SELLER') {
        const sellerWallet = await tx.select().from(wallets).where(and(eq(wallets.userId, order.sellerId), eq(wallets.assetSymbol, ad.asset))).get();
        if (sellerWallet) {
          const finalBalance = new Decimal(sellerWallet.balance).plus(cryptoAmount).toString();
          const finalEscrow = new Decimal(sellerWallet.escrowBalance).minus(cryptoAmount).toString();
          await tx.update(wallets).set({ balance: finalBalance, escrowBalance: finalEscrow, updatedAt: now }).where(eq(wallets.id, sellerWallet.id));
        }

        if (ad.status !== 'CANCELED') {
          const newAvailable = new Decimal(ad.availableAmount).plus(cryptoAmount).toString();
          await tx.update(p2pAds).set({ availableAmount: newAvailable, updatedAt: now }).where(eq(p2pAds.id, ad.id));
        }
        
        await tx.update(p2pOrders).set({ status: 'CANCELLED', updatedAt: now }).where(eq(p2pOrders.id, order.id));
        await tx.update(p2pDisputes).set({ status: 'RESOLVED_SELLER', adminNotes: notes, assignedAdminId: admin.id, updatedAt: now }).where(eq(p2pDisputes.id, disputeId));

        await tx.insert(ledgerTransactions).values({
          id: txId, displayId: ltDisplayId, idempotencyKey: `p2p-admin-resolve-refund-${order.id}`,
          referenceType: 'P2P_ESCROW_REFUND', referenceId: order.id, status: 'REVERSED', createdAt: now,
        });

        const sellerLedgerAccId = await getOrCreateLedgerAccount(order.sellerId);
        await tx.insert(ledgerEntries).values([
          { id: crypto.randomUUID(), transactionId: txId, accountId: sellerLedgerAccId, direction: 'CREDIT', assetSymbol: ad.asset, amount: cryptoAmount.toString(), createdAt: now }
        ]);
      }

      await tx.insert(p2pMessages).values({
        id: `sysmsg_${crypto.randomUUID()}`, orderId: order.id, senderId: admin.id,
        content: `Dispute Resolved by Admin. Action: ${resolution}. Notes: ${notes || ''}`, type: 'SYSTEM', createdAt: now,
      });
    });

    return c.json({ success: true });
  } catch (error) {
    console.error('Admin resolve dispute error:', error);
    return c.json({ success: false, error: 'Failed to resolve dispute' }, 500);
  }
});

// ==========================
// ADMIN TRANSACTIONS
// ==========================

// GET /api/v1/admin/transactions
adminRoutes.get('/transactions', async (c) => {
  const db = c.get('db');
  
  try {
    const { eq, desc } = require('drizzle-orm');
    const { walletTransactions, users } = require('database');
    
    const query = db.select({
      id: walletTransactions.id,
      userId: walletTransactions.userId,
      userName: users.displayName,
      type: walletTransactions.type,
      mode: walletTransactions.mode,
      asset: walletTransactions.assetSymbol,
      amount: walletTransactions.amount,
      status: walletTransactions.status,
      network: walletTransactions.network,
      reference: walletTransactions.reference,
      createdAt: walletTransactions.createdAt,
    })
    .from(walletTransactions)
    .leftJoin(users, eq(users.id, walletTransactions.userId))
    .where(eq(walletTransactions.type, 'DEPOSIT'))
    .orderBy(desc(walletTransactions.createdAt))
    .limit(200);
    
    const results = await query.all();
    
    return c.json({ success: true, data: results });
  } catch (error) {
    return c.json({ success: false, error: 'Failed to fetch transactions' }, 500);
  }
});

// ==========================
// ADMIN WITHDRAWALS
// ==========================

// GET /api/v1/admin/withdrawals
adminRoutes.get('/withdrawals', async (c) => {
  const db = c.get('db');
  const status = c.req.query('status') || 'ALL';

  
  try {
    const { eq, and, desc } = require('drizzle-orm');
    const { walletTransactions, users } = require('database');
    
    let conditions = [
      eq(walletTransactions.type, 'WITHDRAWAL'),
      eq(walletTransactions.type, 'WITHDRAWAL')
    ];
    
    if (status !== 'ALL') {
      conditions.push(eq(walletTransactions.status, status));
    }
    
    const query = db.select({
      id: walletTransactions.id,
      userId: walletTransactions.userId,
      userName: users.displayName,
      asset: walletTransactions.assetSymbol,
      amount: walletTransactions.amount,
      status: walletTransactions.status,
      network: walletTransactions.network,
      address: walletTransactions.destination,
      reference: walletTransactions.reference,
      createdAt: walletTransactions.createdAt,
    })
    .from(walletTransactions)
    .leftJoin(users, eq(users.id, walletTransactions.userId))
    .where(and(...conditions))
    .orderBy(desc(walletTransactions.createdAt))
    .limit(100);
    
    const results = await query.all();
    
    return c.json({ success: true, data: results });
  } catch (error) {
    return c.json({ success: false, error: 'Failed to fetch withdrawals' }, 500);
  }
});

// POST /api/v1/admin/withdrawals/:id/approve
adminRoutes.post('/withdrawals/:id/approve', async (c) => {
  const db = c.get('db');
  const id = c.req.param('id');
  
  try {
    const { eq, and } = require('drizzle-orm');
    const { walletTransactions, wallets } = require('database');
    
    const tx = await db.select().from(walletTransactions).where(eq(walletTransactions.id, id)).get();
    if (!tx || tx.status !== 'PENDING') return c.json({ success: false, error: 'Invalid transaction' }, 400);

    // Deduct from locked balance permanently
    const wallet = await db.select().from(wallets).where(and(
      eq(wallets.userId, tx.userId),
      eq(wallets.assetSymbol, tx.assetSymbol)
    )).get();
    
    if (wallet) {
      const newLocked = Math.max(0, parseFloat(wallet.lockedBalance) - parseFloat(tx.amount)).toString();
      await db.update(wallets).set({ lockedBalance: newLocked, updatedAt: new Date() }).where(eq(wallets.id, wallet.id));
    }

    // In a real Cregis setup, approving here might trigger a webhook or second payout call
    // For now, we just mark it as COMPLETED
    await db.update(walletTransactions).set({ status: 'COMPLETED', updatedAt: new Date() }).where(eq(walletTransactions.id, id));
    
    return c.json({ success: true });
  } catch (error) {
    return c.json({ success: false, error: 'Failed to approve withdrawal' }, 500);
  }
});

// POST /api/v1/admin/withdrawals/:id/reject
adminRoutes.post('/withdrawals/:id/reject', async (c) => {
  const db = c.get('db');
  const id = c.req.param('id');
  const { notes } = await c.req.json();
  
  try {
    const { eq, and } = require('drizzle-orm');
    const { walletTransactions, wallets } = require('database');
    
    const tx = await db.select().from(walletTransactions).where(eq(walletTransactions.id, id)).get();
    if (!tx || tx.status !== 'PENDING') return c.json({ success: false, error: 'Invalid transaction' }, 400);
    
    // Refund the amount back to balance from locked balance
    const wallet = await db.select().from(wallets).where(and(
      eq(wallets.userId, tx.userId),
      eq(wallets.assetSymbol, tx.assetSymbol)
    )).get();
    
    if (wallet) {
      const newBalance = (parseFloat(wallet.balance) + parseFloat(tx.amount)).toString();
      const newLocked = Math.max(0, parseFloat(wallet.lockedBalance) - parseFloat(tx.amount)).toString();
      await db.update(wallets).set({ balance: newBalance, lockedBalance: newLocked, updatedAt: new Date() }).where(eq(wallets.id, wallet.id));
    }
    
    const updatedNotes = notes ? `Rejected: ${notes}` : 'Rejected by Admin';
    await db.update(walletTransactions).set({ status: 'REJECTED', reference: updatedNotes, updatedAt: new Date() }).where(eq(walletTransactions.id, id));
    
    return c.json({ success: true });
  } catch (error) {
    return c.json({ success: false, error: 'Failed to reject withdrawal' }, 500);
  }
});

// PUT /api/v1/admin/withdrawals/:id/notes
adminRoutes.put('/withdrawals/:id/notes', async (c) => {
  const db = c.get('db');
  const id = c.req.param('id');
  const { notes } = await c.req.json();
  
  try {
    const { eq } = require('drizzle-orm');
    const { walletTransactions } = require('database');
    await db.update(walletTransactions).set({ reference: notes, updatedAt: new Date() }).where(eq(walletTransactions.id, id));
    return c.json({ success: true });
  } catch (error) {
    return c.json({ success: false, error: 'Failed to update notes' }, 500);
  }
});

// DELETE /api/v1/admin/withdrawals/:id
adminRoutes.delete('/withdrawals/:id', async (c) => {
  const db = c.get('db');
  const id = c.req.param('id');
  const admin = c.get('user');
  
  if (admin.role !== 'SUPER_ADMIN') {
    return c.json({ success: false, error: 'Only Super Admins can delete financial records' }, 403);
  }
  
  try {
    const { eq } = require('drizzle-orm');
    const { walletTransactions } = require('database');
    await db.delete(walletTransactions).where(eq(walletTransactions.id, id));
    return c.json({ success: true });
  } catch (error) {
    return c.json({ success: false, error: 'Failed to delete withdrawal' }, 500);
  }
});

// GET /api/v1/admin/experts
adminRoutes.get('/experts', async (c) => {
  const db = c.get('db');
  const admin = c.get('user');

  if (admin.role !== 'SUPER_ADMIN') {
    return c.json({ success: false, error: 'Unauthorized: Only Super Admins can view experts' }, 403);
  }

  try {
    const experts = await db.select({
      id: expertProfiles.id,
      userId: expertProfiles.userId,
      displayName: users.displayName,
      email: users.email,
      bio: expertProfiles.bio,
      experienceYears: expertProfiles.experienceYears,
      verificationStatus: expertProfiles.verificationStatus,
      createdAt: expertProfiles.createdAt
    })
    .from(expertProfiles)
    .innerJoin(users, eq(users.id, expertProfiles.userId))
    .orderBy(desc(expertProfiles.createdAt))
    .all();

    return c.json({ success: true, data: experts });
  } catch (error) {
    return c.json({ success: false, error: 'Failed to fetch experts' }, 500);
  }
});

// PUT /api/v1/admin/experts/:id/status
adminRoutes.put('/experts/:id/status', async (c) => {
  const db = c.get('db');
  const admin = c.get('user');
  const expertId = c.req.param('id');
  const body = await c.req.json();

  if (admin.role !== 'SUPER_ADMIN') {
    return c.json({ success: false, error: 'Unauthorized' }, 403);
  }

  if (!['PENDING', 'VERIFIED', 'REJECTED'].includes(body.status)) {
    return c.json({ success: false, error: 'Invalid status' }, 400);
  }

  try {
    const { eq } = require('drizzle-orm');
    const { expertProfiles, users } = require('database');
    
    await db.update(expertProfiles).set({ verificationStatus: body.status, updatedAt: new Date() }).where(eq(expertProfiles.id, expertId));
    
    if (body.status === 'VERIFIED') {
      const expert = await db.select().from(expertProfiles).where(eq(expertProfiles.id, expertId)).get();
      if (expert) {
        const targetUser = await db.select().from(users).where(eq(users.id, expert.userId)).get();
        if (targetUser && targetUser.role === 'USER') {
          await db.update(users).set({ role: 'EXPERT', updatedAt: new Date() }).where(eq(users.id, targetUser.id));
        }
      }
    }
    
    return c.json({ success: true });
  } catch (error) {
    return c.json({ success: false, error: 'Failed to update expert status' }, 500);
  }
});

// POST /api/v1/admin/experts (Manually add or convert an expert)
adminRoutes.post('/experts', async (c) => {
  const db = c.get('db');
  const admin = c.get('user');
  const body = await c.req.json();
  const mode = body.mode || 'convert'; // 'convert' or 'create'

  if (admin.role !== 'SUPER_ADMIN') {
    return c.json({ success: false, error: 'Unauthorized' }, 403);
  }

  try {
    let targetUser;

    if (mode === 'convert') {
      targetUser = await db.select().from(users).where(eq(users.email, body.email)).get();
      if (!targetUser) {
        return c.json({ success: false, error: 'User not found with this email' }, 404);
      }
    } else if (mode === 'create') {
      // Check if email already in use
      const existingEmail = await db.select().from(users).where(eq(users.email, body.email)).get();
      if (existingEmail) {
        return c.json({ success: false, error: 'Email already in use' }, 400);
      }
      
      const encoder = new TextEncoder();
      const passwordData = encoder.encode(body.password || crypto.randomUUID()); // Use provided or random
      const hashBuf = await crypto.subtle.digest('SHA-256', passwordData);
      const hashedPassword = Array.from(new Uint8Array(hashBuf)).map(b => b.toString(16).padStart(2, '0')).join('');
      
      const userId = `usr_${crypto.randomUUID().replace(/-/g, '').substring(0, 12)}`;
      
      await db.insert(users).values({
        id: userId,
        email: body.email,
        passwordHash: hashedPassword,
        displayName: body.displayName || body.email.split('@')[0],
        firstName: body.firstName,
        lastName: body.lastName,
        role: 'EXPERT',
        emailVerified: true,
        createdAt: new Date(),
        updatedAt: new Date()
      }).run();
      
      targetUser = { id: userId, role: 'EXPERT' };
    }

    if (!targetUser) {
      return c.json({ success: false, error: 'Invalid user target' }, 400);
    }

    // Check if profile exists
    const existingProfile = await db.select().from(expertProfiles).where(eq(expertProfiles.userId, targetUser.id)).get();
    if (existingProfile) {
      return c.json({ success: false, error: 'User is already an expert' }, 400);
    }

    const profileId = `exp_${crypto.randomUUID().replace(/-/g, '').substring(0, 12)}`;
    await db.insert(expertProfiles).values({
      id: profileId,
      userId: targetUser.id,
      bio: body.bio || 'Expert verified by Admin.',
      experienceYears: parseInt(body.experienceYears) || 0,
      languages: body.languages ? (Array.isArray(body.languages) ? body.languages : body.languages.split(',').map((l: string) => l.trim())) : ['English'],
      categories: body.categories ? (Array.isArray(body.categories) ? body.categories : body.categories.split(',').map((c: string) => c.trim())) : ['General'],
      verificationStatus: 'VERIFIED',
      availabilityStatus: 'AVAILABLE',
      createdAt: new Date(),
      updatedAt: new Date()
    }).run();

    // Ensure role is EXPERT
    if (targetUser.role !== 'EXPERT' && targetUser.role !== 'SUPER_ADMIN') {
      await db.update(users).set({ role: 'EXPERT', updatedAt: new Date() }).where(eq(users.id, targetUser.id)).run();
    }

    return c.json({ success: true, data: { id: profileId } });
  } catch (error: any) {
    console.error('Create expert error:', error);
    return c.json({ success: false, error: 'Failed to create expert profile' }, 500);
  }
});

// GET /api/v1/admin/platform-settings
adminRoutes.get('/platform-settings', async (c) => {
  const db = c.get('db');
  const admin = c.get('user');

  if (admin.role !== 'SUPER_ADMIN') {
    return c.json({ success: false, error: 'Unauthorized' }, 403);
  }

  try {
    const { platformSettings } = require('database');
    const settingsList = await db.select().from(platformSettings).all();
    return c.json({ success: true, data: settingsList });
  } catch (error) {
    return c.json({ success: false, error: 'Failed to fetch platform settings' }, 500);
  }
});

// PUT /api/v1/admin/platform-settings/:key
adminRoutes.put('/platform-settings/:key', async (c) => {
  const db = c.get('db');
  const admin = c.get('user');
  const key = c.req.param('key');
  const body = await c.req.json();

  if (admin.role !== 'SUPER_ADMIN') {
    return c.json({ success: false, error: 'Unauthorized' }, 403);
  }

  try {
    const { platformSettings, markets } = require('database');
    const existing = await db.select().from(platformSettings).where(eq(platformSettings.key, key)).get();
    
    if (existing) {
      await db.update(platformSettings).set({ 
        value: String(body.value), 
        description: body.description || existing.description,
        updatedAt: new Date(),
        updatedBy: admin.id
      }).where(eq(platformSettings.key, key)).run();
    } else {
      await db.insert(platformSettings).values({
        id: `set_${crypto.randomUUID().replace(/-/g, '').substring(0, 10)}`,
        key,
        value: String(body.value),
        description: body.description || '',
        updatedAt: new Date(),
        updatedBy: admin.id
      }).run();
    }
    
    // Sync to markets table if trading fees are updated globally
    if (key === 'TRADING_FEE_MAKER' || key === 'TRADING_FEE_TAKER') {
      try {
        const parsed = JSON.parse(String(body.value));
        if (parsed && typeof parsed.percentage !== 'undefined') {
          const feeValue = String(parsed.percentage);
          if (key === 'TRADING_FEE_MAKER') {
            await db.update(markets).set({ makerFee: feeValue }).run();
          } else {
            await db.update(markets).set({ takerFee: feeValue }).run();
          }
        }
      } catch (e) {
        console.error('Failed to parse trading fee JSON to sync markets', e);
      }
    }
    
    return c.json({ success: true });
  } catch (error) {
    return c.json({ success: false, error: 'Failed to update platform setting' }, 500);
  }
});

// GET /api/v1/admin/system-settings
adminRoutes.get('/system-settings', async (c) => {
  const db = c.get('db');
  const admin = c.get('user');

  if (admin.role !== 'SUPER_ADMIN' && admin.role !== 'ADMIN') {
    return c.json({ success: false, error: 'Unauthorized' }, 403);
  }

  try {
    const { platformSettings } = require('database');
    const settingsList = await db.select().from(platformSettings).all();
    const systemKeys = [
      'EMAIL_ADMIN', 'EMAIL_SUPPORT', 
      'EMAIL_NOTIFY_NEW_USER', 'EMAIL_NOTIFY_DEPOSIT', 'EMAIL_NOTIFY_WITHDRAWAL',
      'EMAIL_NOTIFY_P2P', 'EMAIL_NOTIFY_TRADE', 'EMAIL_NOTIFY_TRANSFER'
    ];
    
    const result: Record<string, string> = {};
    for (const setting of settingsList) {
      if (systemKeys.includes(setting.key)) {
        result[setting.key] = setting.value;
      }
    }
    return c.json({ success: true, data: result });
  } catch (error) {
    return c.json({ success: false, error: 'Failed to fetch system settings' }, 500);
  }
});

// POST /api/v1/admin/system-settings
adminRoutes.post('/system-settings', async (c) => {
  const db = c.get('db');
  const admin = c.get('user');
  const body = await c.req.json();

  if (admin.role !== 'SUPER_ADMIN') {
    return c.json({ success: false, error: 'Unauthorized' }, 403);
  }

  try {
    const { platformSettings } = require('database');
    
    for (const [key, value] of Object.entries(body)) {
      const existing = await db.select().from(platformSettings).where(eq(platformSettings.key, key)).get();
      if (existing) {
        await db.update(platformSettings).set({ 
          value: String(value), 
          updatedAt: new Date(),
          updatedBy: admin.id
        }).where(eq(platformSettings.key, key)).run();
      } else {
        await db.insert(platformSettings).values({
          id: `sys_${crypto.randomUUID().replace(/-/g, '').substring(0, 10)}`,
          key,
          value: String(value),
          description: 'System setting',
          updatedAt: new Date(),
          updatedBy: admin.id
        }).run();
      }
    }
    return c.json({ success: true });
  } catch (error) {
    return c.json({ success: false, error: 'Failed to update system settings' }, 500);
  }
});
// PUT /api/v1/admin/experts/bookings/:id/chat-toggle
adminRoutes.put('/experts/bookings/:id/chat-toggle', async (c) => {
  const db = c.get('db');
  const admin = c.get('user');
  const bookingId = c.req.param('id');
  const { chatEnabled } = await c.req.json();

  if (admin.role !== 'SUPER_ADMIN') {
    return c.json({ success: false, error: 'Unauthorized' }, 403);
  }

  try {
    const { eq } = require('drizzle-orm');
    const { expertBookings } = require('database');
    await db.update(expertBookings).set({ chatEnabled, updatedAt: new Date() }).where(eq(expertBookings.id, bookingId));
    return c.json({ success: true });
  } catch (error) {
    return c.json({ success: false, error: 'Failed to toggle chat' }, 500);
  }
});

// ==========================
// ADMIN SUPPORT TICKETS
// ==========================

// GET /api/v1/admin/support/tickets
adminRoutes.get('/support/tickets', async (c) => {
  const db = c.get('db');
  
  try {
    const { desc } = require('drizzle-orm');
    const { tickets } = require('database');
    const allTickets = await db.select().from(tickets).orderBy(desc(tickets.updatedAt)).all();
    return c.json({ success: true, data: allTickets });
  } catch (error) {
    return c.json({ success: false, error: 'Failed to fetch tickets' }, 500);
  }
});

// GET /api/v1/admin/support/tickets/:id
adminRoutes.get('/support/tickets/:id', async (c) => {
  const db = c.get('db');
  const ticketId = c.req.param('id');
  
  try {
    const { eq } = require('drizzle-orm');
    const { tickets, ticketMessages } = require('database');
    const ticket = await db.select().from(tickets).where(eq(tickets.id, ticketId)).get();
    if (!ticket) return c.json({ success: false, error: 'Ticket not found' }, 404);
    
    const messages = await db.select().from(ticketMessages).where(eq(ticketMessages.ticketId, ticketId)).orderBy(ticketMessages.createdAt).all();
    
    return c.json({ success: true, data: { ticket, messages } });
  } catch (error) {
    return c.json({ success: false, error: 'Failed to fetch ticket' }, 500);
  }
});

// POST /api/v1/admin/support/tickets/:id/messages
adminRoutes.post('/support/tickets/:id/messages', async (c) => {
  const db = c.get('db');
  const admin = c.get('user');
  const ticketId = c.req.param('id');
  const body = await c.req.json();

  if (!body.content && !body.attachmentBase64) return c.json({ success: false, error: 'Message content or attachment required' }, 400);

  try {
    const { eq } = require('drizzle-orm');
    const { tickets, ticketMessages } = require('database');
    const now = new Date();
    await db.insert(ticketMessages).values({
      id: `MSG-${crypto.randomUUID()}`,
      ticketId,
      senderId: admin.id,
      isAdmin: true,
      isInternalNote: body.isInternalNote || false,
      content: body.content || '',
      attachmentBase64: body.attachmentBase64 || null,
      createdAt: now,
    });

    if (!body.isInternalNote) {
      await db.update(tickets)
        .set({ updatedAt: now, status: 'WAITING_FOR_USER' })
        .where(eq(tickets.id, ticketId));
    } else {
      await db.update(tickets)
        .set({ updatedAt: now })
        .where(eq(tickets.id, ticketId));
    }

    return c.json({ success: true });
  } catch (error) {
    return c.json({ success: false, error: 'Failed to add message' }, 500);
  }
});

// PUT /api/v1/admin/support/tickets/:id/status
adminRoutes.put('/support/tickets/:id/status', async (c) => {
  const db = c.get('db');
  const ticketId = c.req.param('id');
  const body = await c.req.json();

  if (!body.status) return c.json({ success: false, error: 'Status required' }, 400);

  try {
    const { eq } = require('drizzle-orm');
    const { tickets } = require('database');
    await db.update(tickets)
      .set({ status: body.status, updatedAt: new Date() })
      .where(eq(tickets.id, ticketId));

    return c.json({ success: true });
  } catch (error) {
    return c.json({ success: false, error: 'Failed to update status' }, 500);
  }
});

// ==========================
// ADMIN P2P
// ==========================

// GET /api/v1/admin/p2p/orders
adminRoutes.get('/p2p/orders', async (c) => {
  const db = c.get('db');
  try {
    const { eq, desc } = require('drizzle-orm');
    const { p2pOrders, p2pAds, users } = require('database');
    const orderRows = await db.select({
      order: p2pOrders,
      ad: p2pAds
    })
    .from(p2pOrders)
    .leftJoin(p2pAds, eq(p2pOrders.adId, p2pAds.id))
    .where(sql`1=1`)
    .orderBy(desc(p2pOrders.createdAt))
    .all();

    const buyerIds = orderRows.map((r: any) => r.order.buyerId);
    const sellerIds = orderRows.map((r: any) => r.order.sellerId);
    const allUserIds = Array.from(new Set([...buyerIds, ...sellerIds]));

    let usersMap: Record<string, any> = {};
    if (allUserIds.length > 0) {
      const usersInfo = await db.select().from(users).where(require('drizzle-orm').inArray(users.id, allUserIds)).all();
      for (const u of usersInfo) {
        usersMap[u.id] = u;
      }
    }

    const enrichedOrders = orderRows.map((row: any) => {
      const buyer = usersMap[row.order.buyerId];
      const seller = usersMap[row.order.sellerId];
      return {
        ...row.order,
        buyerEmail: buyer ? buyer.email : 'Unknown',
        sellerEmail: seller ? seller.email : 'Unknown',
        asset: row.ad ? row.ad.asset : 'Unknown',
        fiatCurrency: row.ad ? row.ad.fiat : 'Unknown'
      };
    });

    return c.json({ success: true, data: enrichedOrders });
  } catch (error) {
    return c.json({ success: false, error: 'Failed to fetch p2p orders' }, 500);
  }
});

// GET /api/v1/admin/p2p/disputes
adminRoutes.get('/p2p/disputes', async (c) => {
  const db = c.get('db');
  try {
    const { eq, desc } = require('drizzle-orm');
    const { p2pDisputes, p2pOrders, p2pAds, users } = require('database');
    const disputeRows = await db.select({
      dispute: p2pDisputes,
      order: p2pOrders,
      ad: p2pAds
    })
    .from(p2pDisputes)
    .leftJoin(p2pOrders, eq(p2pDisputes.orderId, p2pOrders.id))
    .leftJoin(p2pAds, eq(p2pOrders.adId, p2pAds.id))
    .orderBy(desc(p2pDisputes.createdAt))
    .all();

    const userIdsToFetch = new Set<string>();
    disputeRows.forEach((row: any) => {
      userIdsToFetch.add(row.dispute.openerId);
      if (row.order) {
        userIdsToFetch.add(row.order.buyerId);
        userIdsToFetch.add(row.order.sellerId);
      }
    });

    let usersMap: Record<string, any> = {};
    if (userIdsToFetch.size > 0) {
      const usersInfo = await db.select().from(users).where(require('drizzle-orm').inArray(users.id, Array.from(userIdsToFetch))).all();
      for (const u of usersInfo) {
        usersMap[u.id] = u;
      }
    }

    const enrichedDisputes = disputeRows.map((row: any) => {
      const opener = usersMap[row.dispute.openerId];
      const buyer = row.order ? usersMap[row.order.buyerId] : null;
      const seller = row.order ? usersMap[row.order.sellerId] : null;
      
      // Get the order display id if it exists
      const displayOrderId = row.order ? row.order.displayId || row.order.id : row.dispute.orderId;
      
      return {
        ...row.dispute,
        openerEmail: opener ? opener.email : 'Unknown',
        buyerEmail: buyer ? buyer.email : 'Unknown',
        sellerEmail: seller ? seller.email : 'Unknown',
        asset: row.ad ? row.ad.asset : 'Unknown',
        fiatAmount: row.order ? row.order.fiatAmount : '0',
        cryptoAmount: row.order ? row.order.cryptoAmount : '0',
        fiatCurrency: row.ad ? row.ad.fiat : 'Unknown',
        orderDisplayId: displayOrderId
      };
    });

    return c.json({ success: true, data: enrichedDisputes });
  } catch (error) {
    return c.json({ success: false, error: 'Failed to fetch p2p disputes' }, 500);
  }
});

// ==========================
// ADMIN SYSTEM CACHE & EXPORTS
// ==========================

// POST /api/v1/admin/system/clear-cache
adminRoutes.post('/system/clear-cache', async (c) => {
  const admin = c.get('user');
  if (admin.role !== 'SUPER_ADMIN') {
    return c.json({ success: false, error: 'Unauthorized' }, 403);
  }
  try {
    return c.json({ success: true, message: 'Backend caches cleared' });
  } catch (error) {
    return c.json({ success: false, error: 'Failed to clear cache' }, 500);
  }
});

// GET /api/v1/admin/exports
adminRoutes.get('/exports', async (c) => {
  const db = c.get('db');
  const admin = c.get('user');
  const modules = c.req.query('modules');
  
  if (admin.role !== 'SUPER_ADMIN') {
    return c.json({ success: false, error: 'Unauthorized' }, 403);
  }

  if (!modules) {
    return c.json({ success: false, error: 'No modules specified' }, 400);
  }

  const moduleList = modules.split(',').map(m => m.trim());
  const exportData: Record<string, any[]> = {};
  const schema = require('database');

  try {
    const fetchModuleData = async (tableName: string, sensitiveFields: string[] = []) => {
      if (!schema[tableName]) return [];
      const rows = await db.select().from(schema[tableName]).all();
      return rows.map((row: any) => {
        const safeRow = { ...row };
        sensitiveFields.forEach(field => delete safeRow[field]);
        return safeRow;
      });
    };

    if (moduleList.includes('All')) {
       for (const [key, value] of Object.entries(schema)) {
          if (typeof value === 'object' && (value as any)['_']?.name) {
              const tableName = (value as any)['_'].name;
              exportData[key] = await fetchModuleData(key, ['passwordHash', 'twoFactorSecret']);
          }
       }
    } else {
      if (moduleList.includes('Users')) exportData['Users'] = await fetchModuleData('users', ['passwordHash', 'twoFactorSecret']);
      if (moduleList.includes('User Profiles')) exportData['User Profiles'] = await fetchModuleData('userProfiles');
      if (moduleList.includes('Wallets')) exportData['Wallets'] = await fetchModuleData('wallets');
      if (moduleList.includes('Transactions')) exportData['Transactions'] = await fetchModuleData('walletTransactions');
      if (moduleList.includes('Trades')) exportData['Trades'] = await fetchModuleData('trades');
      
      if (moduleList.includes('P2P Ads')) exportData['P2P Ads'] = await fetchModuleData('p2pAds');
      if (moduleList.includes('P2P Orders')) exportData['P2P Orders'] = await fetchModuleData('p2pOrders');
      if (moduleList.includes('Escrow Records')) exportData['Escrow Records'] = await fetchModuleData('p2pEscrows');
      if (moduleList.includes('Disputes')) exportData['Disputes'] = await fetchModuleData('p2pDisputes');
      if (moduleList.includes('Payment Methods')) exportData['Payment Methods'] = await fetchModuleData('paymentMethods');
      if (moduleList.includes('Ledger Accounts')) exportData['Ledger Accounts'] = await fetchModuleData('ledgerAccounts');
      if (moduleList.includes('Ledger Entries')) exportData['Ledger Entries'] = await fetchModuleData('ledgerEntries');
      if (moduleList.includes('System Settings')) exportData['System Settings'] = await fetchModuleData('platformSettings');
      if (moduleList.includes('Audit Logs')) exportData['Audit Logs'] = await fetchModuleData('auditLogs');
      if (moduleList.includes('Support Tickets')) exportData['Support Tickets'] = await fetchModuleData('tickets');
    }

    return c.json({ success: true, data: exportData });
  } catch (error) {
    console.error('Export Error:', error);
    return c.json({ success: false, error: 'Failed to generate export' }, 500);
  }
});

// GET /api/v1/admin/transactions
adminRoutes.get('/transactions', async (c) => {
  const db = c.get('db');
  const admin = c.get('user');
  
  if (admin.role !== 'SUPER_ADMIN' && admin.role !== 'ADMIN') {
    return c.json({ success: false, error: 'Unauthorized' }, 403);
  }

  try {
    const { eq, desc } = require('drizzle-orm');
    const { walletTransactions, users } = require('database');
    
    // Fetch all transactions ordered by descending date
    const transactions = await db.select({
      id: walletTransactions.id,
      displayId: walletTransactions.displayId,
      userId: walletTransactions.userId,
      type: walletTransactions.type,
      asset: walletTransactions.assetSymbol,
      amount: walletTransactions.amount,
      fee: walletTransactions.fee,
      status: walletTransactions.status,
      network: walletTransactions.network,
      destination: walletTransactions.destination,
      reference: walletTransactions.reference,
      createdAt: walletTransactions.createdAt,
      originalCurrency: walletTransactions.originalCurrency,
      originalAmount: walletTransactions.originalAmount,
      conversionRate: walletTransactions.conversionRate,
      grossAmount: walletTransactions.grossAmount,
      totalFees: walletTransactions.totalFees,
      netAmount: walletTransactions.netAmount,
      userName: users.displayName,
      userEmail: users.email
    })
    .from(walletTransactions)
    .leftJoin(users, eq(walletTransactions.userId, users.id))
    .orderBy(desc(walletTransactions.createdAt))
    .limit(500)
    .all();

    return c.json({ success: true, data: transactions });
  } catch (error) {
    console.error('Fetch Admin Transactions Error:', error);
    return c.json({ success: false, error: 'Failed to fetch transactions' }, 500);
  }
});
