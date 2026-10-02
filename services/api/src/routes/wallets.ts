import { Hono } from 'hono';
import { eq, desc, and, or } from 'drizzle-orm';
import { Bindings, Variables } from '../db';
import { wallets, walletTransactions, bankTransfers, real_manual_deposits, bank_accounts, payment_methods, assetConversions, users, currencyRates, p2pOrders, p2pAds, expertBookings, expertProfiles } from 'database';
import { jwtMiddleware } from '../middleware/jwt';
import { CregisClient } from '../services/cregis';
import { getFeeConfig, calculateFee, getLimit } from '../services/fees';
import { generateBusinessId } from '../services/id-generator';
import { calculateDepositPreview, calculateWithdrawalPreview } from '../services/calculations';
import { EmailService } from '../services/email';

export const walletRoutes = new Hono<{ Bindings: Bindings; Variables: Variables }>();

const getAssetPrice = (symbol: string) => {
  if (symbol === 'USDT' || symbol === 'USD') return 1;
  // TODO: Integrate live market data Oracle
  return 0; 
};

// Add JWT Middleware to all routes in this router
walletRoutes.use('*', jwtMiddleware);

walletRoutes.get('/asset-conversions', async (c) => {
  const db = c.get('db');
  const user = c.get('user');
  
  const conversions = await db.select().from(assetConversions).where(eq(assetConversions.userId, user.id)).orderBy(desc(assetConversions.createdAt)).limit(50);
  return c.json({ success: true, data: conversions });
});

walletRoutes.get('/deposit-settings', async (c) => {
  const db = c.get('db');
  
  // Get all active payment methods
  const activeMethods = await db.select()
    .from(payment_methods)
    .where(eq(payment_methods.enabled, true))
    .orderBy(desc(payment_methods.updated_at))
    .all();
    
  // Support legacy manualAddresses format for backward compatibility
  const manualMethod = activeMethods.find(m => m.method === 'MANUAL');
  let manualAddresses: Record<string, string> = {};
  if (manualMethod?.instructions) {
    try {
      manualAddresses = JSON.parse(manualMethod.instructions);
    } catch(e) {
      console.error('Failed to parse manual deposit instructions as JSON', e);
    }
  }

  const bankMethod = activeMethods.find(m => m.method === 'BANK_TRANSFER');
  let activeBankAccounts: any[] = [];
  if (bankMethod?.instructions) {
    try {
      activeBankAccounts = JSON.parse(bankMethod.instructions);
      if (!Array.isArray(activeBankAccounts)) activeBankAccounts = [];
    } catch(e) {
      console.error('Failed to parse bank transfer instructions as JSON', e);
    }
  }

  // Get dynamic currencies
  const rates = await db.select().from(currencyRates).where(eq(currencyRates.status, 'ACTIVE')).all();
  
  // Only include bank currencies if they are marked as isBank
  const bankCurrencies = rates.filter(r => r.isBank).map(r => r.code);
  
  // Only include crypto assets if they are marked as isAsset
  const activeCryptoAssets = rates.filter(r => r.isAsset).map(r => r.code);
  
  return c.json({ success: true, activeMethods, manualAddresses, bankCurrencies, activeCryptoAssets, bankAccounts: activeBankAccounts });
});

walletRoutes.get('/deposit/preview', async (c) => {
  try {
    const db = c.get('db');
    const amount = parseFloat(c.req.query('amount') || '0');
    const currency = c.req.query('currency') || 'USDT';
    let methodId = c.req.query('methodId') || null;

    if (amount <= 0) return c.json({ success: false, error: 'Invalid amount' }, 400);

    // If methodId is not a UUID, try to look it up as a string name
    if (methodId && methodId.length < 30) {
      const pm = await db.select().from(payment_methods).where(eq(payment_methods.method, methodId as any)).get();
      if (pm) methodId = pm.id;
    }

    const preview = await calculateDepositPreview(db, amount, currency, methodId);
    
    const minDeposit = await getLimit(db, 'MIN_DEPOSIT', 0);
    if (minDeposit > 0 && preview.grossUsdt < minDeposit) {
      return c.json({ success: false, error: `Minimum deposit amount is ${minDeposit} USDT Equivalent.` }, 400);
    }
    
    return c.json({ success: true, data: preview });
  } catch (error: any) {
    return c.json({ success: false, error: error.message }, 400);
  }
});

walletRoutes.get('/withdrawal/preview', async (c) => {
  try {
    const db = c.get('db');
    const amount = parseFloat(c.req.query('amount') || '0');
    const currency = c.req.query('currency') || 'USDT';
    let methodId = c.req.query('methodId') || null;

    if (amount <= 0) return c.json({ success: false, error: 'Invalid amount' }, 400);

    if (methodId && methodId.length < 30) {
      const pm = await db.select().from(payment_methods).where(eq(payment_methods.method, methodId as any)).get();
      if (pm) methodId = pm.id;
    }

    const preview = await calculateWithdrawalPreview(db, amount, currency, methodId);
    
    const minWithdrawal = await getLimit(db, 'MIN_WITHDRAWAL', 0);
    if (minWithdrawal > 0 && preview.requestedUsdt < minWithdrawal) {
      return c.json({ success: false, error: `Minimum withdrawal amount is ${minWithdrawal} USDT Equivalent.` }, 400);
    }
    
    return c.json({ success: true, data: preview });
  } catch (error: any) {
    return c.json({ success: false, error: error.message }, 400);
  }
});

walletRoutes.get('/balances', async (c) => {
  const db = c.get('db');
  const user = c.get('user');
  
  const userWallets = await db.select().from(wallets).where(eq(wallets.userId, user.id)).all();
  const activeRates = await db.select().from(currencyRates).where(eq(currencyRates.status, 'ACTIVE')).all();
  const ratesMap = new Map(activeRates.map(r => [r.code, r]));
  
  // Format to AssetBalance structure
  const formattedBalances = userWallets.map(w => {
    const rateInfo = ratesMap.get(w.assetSymbol);
    const type = rateInfo?.isBank ? 'FIAT' : (rateInfo?.isAsset ? 'CRYPTO' : 'UNKNOWN');
    const usdPrice = rateInfo && parseFloat(rateInfo.ratePerUsdt) > 0 ? (1 / parseFloat(rateInfo.ratePerUsdt)) : getAssetPrice(w.assetSymbol);

    const available = parseFloat(w.balance);
    const locked = parseFloat(w.lockedBalance) + parseFloat(w.escrowBalance);
    const total = available + locked;
    
    return {
      assetId: w.assetSymbol.toLowerCase(),
      symbol: w.assetSymbol,
      type,
      available,
      locked,
      total,
      usdPrice,
      usdValue: total * usdPrice,
      change24h: 0, 
      change24hPercent: 0 
    };
  });
  
  return c.json({ success: true, data: formattedBalances });
});
walletRoutes.get('/portfolio', async (c) => {
  const db = c.get('db');
  const user = c.get('user');
  
  const userWallets = await db.select().from(wallets).where(eq(wallets.userId, user.id)).all();
  const activeRates = await db.select().from(currencyRates).where(eq(currencyRates.status, 'ACTIVE')).all();
  const ratesMap = new Map(activeRates.map(r => [r.code, r]));
  
  let totalValueUsd = 0;
  let availableBalanceUsd = 0;
  let lockedBalanceUsd = 0;
  
  const allocations = userWallets.map(w => {
    const rateInfo = ratesMap.get(w.assetSymbol);
    const usdPrice = rateInfo && parseFloat(rateInfo.ratePerUsdt) > 0 ? (1 / parseFloat(rateInfo.ratePerUsdt)) : getAssetPrice(w.assetSymbol);

    const lockedAmt = parseFloat(w.lockedBalance) + parseFloat(w.escrowBalance);
    const total = parseFloat(w.balance) + lockedAmt;
    const usdValue = total * usdPrice;
    
    totalValueUsd += usdValue;
    availableBalanceUsd += parseFloat(w.balance) * usdPrice;
    lockedBalanceUsd += lockedAmt * usdPrice;
    
    return {
      asset: w.assetSymbol,
      usdValue,
      percentage: 0 // Will calculate below
    };
  });
  
  // Calculate percentages
  const finalAllocations = allocations.map(a => ({
    ...a,
    percentage: totalValueUsd > 0 ? (a.usdValue / totalValueUsd) * 100 : 0
  })).filter(a => a.percentage > 0).sort((a, b) => b.usdValue - a.usdValue);
  
  const summary = {
    totalValueUsd,
    change24hUsd: 0,
    change24hPercent: 0,
    availableBalanceUsd,
    lockedBalanceUsd,
  };
  
  return c.json({ success: true, data: { summary, allocations: finalAllocations } });
});
walletRoutes.get('/transactions', async (c) => {
  const db = c.get('db');
  const user = c.get('user');
  
  // 1. Wallet Transactions (Deposits, Withdrawals)
  const transactions = await db.select().from(walletTransactions)
    .where(eq(walletTransactions.userId, user.id))
    .all();
    
  const mappedTxs: any[] = transactions.map(tx => ({
    id: tx.id,
    type: tx.type,
    asset: tx.assetSymbol,
    assetSymbol: tx.assetSymbol,
    // CONVERSION amounts are already stored with the correct sign (negative for Step 2).
    // WITHDRAWAL amounts are stored as positive but represent a debit — negate them.
    // All other types (DEPOSIT, ADJUSTMENT, etc.) are stored as signed correctly.
    amount: tx.type === 'WITHDRAWAL'
      ? -Math.abs(parseFloat(tx.amount))
      : parseFloat(tx.amount),
    fee: parseFloat(tx.fee || '0'),
    status: tx.status,
    destination: tx.destination,
    network: tx.network,
    reference: tx.reference,
    // Pass through breakdown fields so the UI can trace the full conversion chain
    originalCurrency: tx.originalCurrency || null,
    originalAmount: tx.originalAmount ? parseFloat(tx.originalAmount) : null,
    conversionRate: tx.conversionRate ? parseFloat(tx.conversionRate) : null,
    grossAmount: tx.grossAmount ? parseFloat(tx.grossAmount) : null,
    totalFees: tx.totalFees ? parseFloat(tx.totalFees) : null,
    netAmount: tx.netAmount ? parseFloat(tx.netAmount) : null,
    createdAt: tx.createdAt.toISOString(),
    updatedAt: tx.updatedAt.toISOString(),
  }));

  // 2. P2P Orders
  const p2pRows = await db.select({ order: p2pOrders, ad: p2pAds }).from(p2pOrders)
    .leftJoin(p2pAds, eq(p2pOrders.adId, p2pAds.id))
    .where(or(eq(p2pOrders.buyerId, user.id), eq(p2pOrders.sellerId, user.id))).all();

  p2pRows.forEach(row => {
    const isBuyer = row.order.buyerId === user.id;
    mappedTxs.push({
      id: row.order.id,
      type: isBuyer ? 'P2P_BUY' : 'P2P_SELL',
      asset: row.ad?.asset || 'Unknown',
      amount: isBuyer ? parseFloat(row.order.cryptoAmount) : -parseFloat(row.order.cryptoAmount),
      fee: 0,
      status: row.order.status === 'COMPLETED' ? 'COMPLETED' : (row.order.status === 'CANCELLED' ? 'FAILED' : 'PENDING'),
      reference: row.order.displayId,
      createdAt: row.order.createdAt.toISOString(),
      updatedAt: row.order.updatedAt.toISOString(),
    });
  });

  // 3. Asset Conversions
  const conversions = await db.select().from(assetConversions)
      .where(eq(assetConversions.userId, user.id))
      .all();
    
    conversions.forEach(conv => {
      // Add debit side
      mappedTxs.push({
        id: `${conv.id}-OUT`,
        type: 'CONVERT_OUT',
        asset: conv.originalAsset,
        amount: -parseFloat(conv.originalAmount),
        fee: parseFloat(conv.depositFee),
        status: conv.status,
        createdAt: conv.createdAt.toISOString(),
        updatedAt: conv.createdAt.toISOString(),
      });
      // Add credit side
      mappedTxs.push({
        id: `${conv.id}-IN`,
        type: 'CONVERT_IN',
        asset: 'USDT',
        amount: parseFloat(conv.netUsdt),
        fee: 0,
        status: conv.status,
        createdAt: conv.createdAt.toISOString(),
        updatedAt: conv.createdAt.toISOString(),
      });
    });


  // 5. Expert Bookings
  const eProfile = await db.select().from(expertProfiles).where(eq(expertProfiles.userId, user.id)).get();
    const bookings = await db.select().from(expertBookings)
      .where(
        eProfile 
          ? or(eq(expertBookings.userId, user.id), eq(expertBookings.expertId, eProfile.id))
          : eq(expertBookings.userId, user.id)
      ).all();
      
    bookings.forEach(booking => {
      const isClient = booking.userId === user.id;
      mappedTxs.push({
        id: booking.id,
        type: isClient ? 'SERVICE_PAYMENT' : 'SERVICE_EARNING',
        asset: booking.currency,
        amount: isClient ? -parseFloat(booking.price) : parseFloat(booking.expertEarnings),
        fee: isClient ? 0 : parseFloat(booking.platformFee),
        status: booking.status === 'SETTLED' ? 'COMPLETED' : 'PENDING',
        reference: booking.displayId,
        createdAt: booking.createdAt.toISOString(),
        updatedAt: booking.updatedAt.toISOString(),
      });
    });

  // Sort by date descending
  mappedTxs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return c.json({ success: true, data: mappedTxs });
});

walletRoutes.post('/deposit', async (c) => {
  try {
    const db = c.get('db');
    const user = c.get('user');
    const body = await c.req.json();
    const { assetSymbol, amount, network, destination, depositMethod } = body;

  const transactionId = `TX-${Date.now()}`;
  const now = new Date();
  
  // Check if wallet exists
  let wallet = await db.select().from(wallets).where(and(eq(wallets.userId, user.id), eq(wallets.assetSymbol, assetSymbol))).get();
  
  if (!wallet) {
    const walletId = crypto.randomUUID();
    const displayId = await generateBusinessId(db, user.email, 'WALL');
    await db.insert(wallets).values({
      id: walletId,
      displayId,
      userId: user.id,
      assetSymbol,
      balance: '0',
      lockedBalance: '0',
      escrowBalance: '0',
      createdAt: now,
      updatedAt: now,
    });
    wallet = { id: walletId, displayId, userId: user.id, assetSymbol, balance: '0', lockedBalance: '0', escrowBalance: '0', createdAt: now, updatedAt: now } as any;
  }
  
    // For REAL, we need to generate a Cregis Address or Bank Transfer Request
    const { transactionHash, proofFileUrl, paymentReference } = body;
    
    if (depositMethod === 'CRYPTO' || depositMethod === 'AUTO') {
      const cregis = new CregisClient(c.env);
      // For AUTO deposit (Payment Engine), generate checkout URL instead of direct WaaS address
      const amountNum = Number(amount) || 0;
      if (amountNum > 0) {
        // Calculate fee if needed (e.g., 1%)
        const fee = amountNum * 0.01;
        const totalAmount = amountNum + fee;
        
        // Log transaction to DB with PENDING status
        const paymentReference = `ORD-${Date.now()}`;
        
        try {
          // Call Payment Engine API
          const checkoutUrl = await cregis.createPaymentOrder(totalAmount, 'USD', user.id);
          return c.json({ success: true, checkoutUrl, message: 'Checkout URL generated' });
        } catch (error: any) {
          console.error("Payment Order generation failed:", error);
          return c.json({ success: false, error: error.message || 'Failed to generate checkout link' }, 400);
        }
      } else {
        return c.json({ success: false, error: 'Valid amount required for checkout' }, 400);
      }
    } else if (depositMethod === 'BANK' || depositMethod === 'MANUAL') {
      const amountNum = Number(amount) || 0;
      
      // If BANK and amount is 0, we just return bank details
      if (depositMethod === 'BANK' && amountNum <= 0) {
        const activeBank = await db.select().from(bank_accounts).where(eq(bank_accounts.active, true)).get();
        if (!activeBank) {
          return c.json({ success: false, error: 'No active bank account available for deposits.' }, 400);
        }
        return c.json({ 
          success: true, 
          bankDetails: {
            accountName: activeBank.account_holder,
            accountNumber: activeBank.account_number,
            bankName: activeBank.bank_name,
            swift: activeBank.swift || '',
            ifsc: activeBank.ifsc || '',
            branch: activeBank.branch || '',
            country: activeBank.country || '',
            instructions: activeBank.instructions || 'Please ensure you include your tracking reference when submitting your proof of payment.'
          }
        });
      }

      if (amountNum <= 0) {
        return c.json({ success: false, error: 'Invalid amount' }, 400);
      }

      const mappedDepositMethod = depositMethod === 'BANK' ? 'BANK_TRANSFER' : depositMethod === 'CRYPTO' ? 'AUTO' : depositMethod;
      // We need methodId to calculate fee. We can fetch it by mappedDepositMethod string
      const pm = await db.select().from(payment_methods).where(eq(payment_methods.method, mappedDepositMethod)).get();
      const methodId = pm ? pm.id : null;

      // Centralized Calculation Service!
      const preview = await calculateDepositPreview(db, amountNum, assetSymbol, methodId);
      
      const minDeposit = await getLimit(db, 'MIN_DEPOSIT', 0);
      if (minDeposit > 0 && preview.grossUsdt < minDeposit) {
        return c.json({ success: false, error: `Minimum deposit amount is ${minDeposit} USDT Equivalent.` }, 400);
      }
      
      if (preview.netUsdt <= 0) {
        return c.json({ success: false, error: 'Deposit amount is too low to cover the required transaction fees.' }, 400);
      }
      
      if (depositMethod === 'BANK') {
        // We will store bank transfers in real_manual_deposits as well since we added breakdown fields there,
        // or we store in bankTransfers. We will use bankTransfers but wait, we didn't add breakdown to bankTransfers.
        // Let's store all manual/bank in real_manual_deposits to keep the schema unified.
      }
      
      await db.insert(real_manual_deposits).values({
         id: crypto.randomUUID(),
         deposit_id: transactionId,
         user_id: user.id,
         amount: amountNum,
         asset: assetSymbol,
         payment_reference: paymentReference || `REF-${Date.now()}`,
         transaction_hash: transactionHash || null,
         proof_file_url: proofFileUrl || null,
         
         // Freeze the calculation breakdown
         original_currency: preview.originalCurrency,
         original_amount: preview.originalAmount.toString(),
         conversion_rate: preview.conversionRate.toString(),
         gross_usdt: preview.grossUsdt.toString(),
         deposit_fee: preview.depositFee.toString(),
         other_fees: preview.otherFees.toString(),
         total_fees: preview.totalFees.toString(),
         net_usdt: preview.netUsdt.toString(),
         expected_wallet_credit: preview.netUsdt.toString(),
         
         method: mappedDepositMethod,
         remarks: depositMethod, // Used to distinguish between 'BANK' and 'MANUAL'
         
         status: 'PENDING',
         created_at: now,
         updated_at: now,
      });

      // Async Email Dispatch
      const emailService = new EmailService(c.env, db);
      c.executionCtx.waitUntil((async () => {
        try {
          const appUrl = c.req.header('origin') || `https://${c.req.header('host')}`;
          await emailService.sendAdminDepositAlert({
            id: transactionId,
            userId: user.id,
            amount: amountNum.toString(),
            asset: assetSymbol,
          }, appUrl);

          await emailService.sendUserTransactionAlert(
            user.email,
            'Deposit Request Submitted',
            `Your deposit request for ${amountNum} ${assetSymbol} via ${depositMethod} has been submitted successfully and is awaiting review.`,
            [
              { key: 'Transaction ID', value: transactionId },
              { key: 'Amount', value: `${amountNum} ${assetSymbol}` },
              { key: 'Method', value: depositMethod },
              { key: 'Status', value: 'PENDING' }
            ],
            `${appUrl}/wallet/history`,
            'View Deposit History'
          );
        } catch (e) {
          console.error("Background email failed for deposit", e);
        }
      })());

      return c.json({ success: true, message: `${depositMethod} deposit submitted successfully. Awaiting admin review.` });
    } else {
      return c.json({ success: false, error: 'Invalid deposit method' }, 400);
    }
  } catch (globalError: any) {
    console.error("FATAL DEPOSIT ROUTE ERROR:", globalError);
    return c.json({ success: false, error: `Server Crash: ${globalError?.message || String(globalError)}` }, 500);
  }
});

walletRoutes.post('/withdraw', async (c) => {
  const db = c.get('db');
  const user = c.get('user');
  const body = await c.req.json();
  const { assetSymbol, amount, destination, network } = body;
  
  const parsedAmount = parseFloat(amount);

  let wallet = await db.select().from(wallets).where(and(eq(wallets.userId, user.id), eq(wallets.assetSymbol, assetSymbol))).get();
  
  if (!wallet || parseFloat(wallet.balance) < parsedAmount) {
    return c.json({ success: false, error: 'Insufficient balance' }, 400);
  }

  // 1. Validate withdrawal limits
  const minWithdrawal = await getLimit(db, 'MIN_WITHDRAWAL', 10);
  if (parsedAmount < minWithdrawal) {
    return c.json({ success: false, error: `Minimum withdrawal is ${minWithdrawal}` }, 400);
  }

  // 2. Calculate dynamic withdrawal fee using the centralized service
  // We need methodId to calculate fee. We can fetch it by network or we assume null for crypto for now.
  let methodId = null; 
  try {
     // Defaulting crypto withdrawals to MANUAL method for fee calculation if not specified
     const pm = await db.select().from(payment_methods).where(eq(payment_methods.method, 'MANUAL')).get();
     if (pm) methodId = pm.id;
  } catch(e) {}

  const preview = await calculateWithdrawalPreview(db, parsedAmount, assetSymbol, methodId);
  
  if (preview.netUsdtReceived <= 0) {
    return c.json({ success: false, error: 'Amount must be greater than withdrawal fee' }, 400);
  }
  
  const now = new Date();
  const transactionId = `TX-${Date.now()}`;
  
    // --- REAL MODE WITHDRAWAL (CREGIS WAAS) ---
    try {
      let finalTxId = transactionId;
      await db.transaction(async (tx: any) => {
        // Step 1: Re-fetch wallet inside transaction to ensure lock and latest state
        const currentWallet = await tx.select().from(wallets).where(eq(wallets.id, wallet.id)).get();
        if (!currentWallet || parseFloat(currentWallet.balance) < parsedAmount) {
          throw new Error('Insufficient balance during transaction processing');
        }

        const newBalance = (parseFloat(currentWallet.balance) - parsedAmount).toString();
        const newLocked = (parseFloat(currentWallet.lockedBalance) + parsedAmount).toString();
        await tx.update(wallets).set({ balance: newBalance, lockedBalance: newLocked, updatedAt: now }).where(eq(wallets.id, wallet.id));
        
        const dbUser = await tx.select().from(users).where(eq(users.id, user.id)).get();
        const txDisplayId = await generateBusinessId(tx, dbUser?.email, 'WTXN');
        
        // Step 2: Record transaction as PENDING (Wait for Cregis Webhook to mark COMPLETED)
        await tx.insert(walletTransactions).values({
          id: transactionId,
          displayId: txDisplayId,
          userId: user.id,
          type: 'WITHDRAWAL',
          assetSymbol,
          amount: parsedAmount.toString(),
          fee: preview.totalFees.toString(),
          status: 'PENDING',
          destination,
          network: network || 'External',
          reference: 'Pending API Submission', // Initial state
          
          // Detailed breakdown
          originalCurrency: preview.currencyCode,
          originalAmount: parsedAmount.toString(),
          conversionRate: preview.conversionRate.toString(),
          grossAmount: parsedAmount.toString(),
          totalFees: preview.totalFees.toString(),
          netAmount: preview.netUsdtReceived.toString(),
          
          createdAt: now,
          updatedAt: now,
        });
      });

      // Async Email Dispatch
      const emailService = new EmailService(c.env, db);
      c.executionCtx.waitUntil((async () => {
        try {
          const appUrl = c.req.header('origin') || `https://${c.req.header('host')}`;
    
          // Admin Alert
          c.executionCtx.waitUntil(emailService.sendAdminWithdrawalAlert({
            id: transactionId,
            userId: user.id,
            amount: parsedAmount.toString(),
            asset: assetSymbol,
          }, appUrl).catch(e => console.error(e)));

          // User Alert
          c.executionCtx.waitUntil(emailService.sendUserTransactionAlert(
            user.email,
            'Withdrawal Request Submitted',
            `Your withdrawal request for ${parsedAmount} ${assetSymbol} has been successfully submitted and is being processed.`,
            [
              { key: 'Transaction ID', value: transactionId },
              { key: 'Amount', value: `${parsedAmount} ${assetSymbol}` },
              { key: 'Destination', value: destination },
              { key: 'Network/Bank', value: network },
              { key: 'Status', value: 'PENDING' }
            ],
            `${appUrl}/wallet/history`,
            'View Withdrawal History'
          ).catch(e => console.error(e)));
        } catch (e) {
          console.error("Background email failed for withdrawal", e);
        }
      })());

      // Step 3: Call Cregis Payout API via PHP Proxy (payout actual net amount)
      try {
        const cregis = new CregisClient(c.env);
        const payoutId = await cregis.createPayout(preview.netUsdtReceived, assetSymbol, destination, user.id);
        
        // Successfully submitted to Cregis, update reference
        await db.update(walletTransactions)
          .set({ reference: payoutId, updatedAt: new Date() })
          .where(eq(walletTransactions.id, transactionId));
          
      } catch (cregisError: any) {
        console.error("Cregis Auto-withdrawal failed, keeping as pending for manual review:", cregisError);
        
        // Update the transaction reference with the error message for admin visibility
        // Limit string length just in case the error is huge
        const errorMsg = cregisError?.message || 'Unknown Cregis Error';
        const updatedReference = `Auto-fail: ${errorMsg}`.substring(0, 250);
        
        await db.update(walletTransactions)
          .set({ reference: updatedReference, updatedAt: new Date() })
          .where(eq(walletTransactions.id, transactionId));
      }

      return c.json({ 
        success: true, 
        transactionId,
        message: 'Withdrawal initiated successfully. It will be processed by the network shortly.'
      });
      
    } catch (error: any) {
      console.error("Real Withdrawal Error:", error);
      return c.json({ success: false, error: error.message || 'Failed to process withdrawal.' }, 400);
    }
});
