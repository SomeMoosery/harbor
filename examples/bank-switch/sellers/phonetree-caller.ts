#!/usr/bin/env tsx

/**
 * PhoneTree - Direct Bank Contact Specialist
 *
 * Company: PhoneTree Connect
 * Specialty: Direct phone calls to banks for latest offers and personalized deals
 * Pricing: Higher cost, faster turnaround, includes unadvertised offers
 *
 * This seller agent monitors Harbor for asks requiring direct bank contact
 * and bids on opportunities where phone research provides value.
 */

import { createLogger } from '@harbor/logger';
import { TenderingClient } from '../../../services/tendering/src/public/client/index.js';
import { WalletClient } from '../../../services/wallet/src/public/client/index.js';

const logger = createLogger({ service: 'phonetree-seller' });

// Agent configuration - Different agent for PhoneTree
const AGENT_ID = 'd106031d-6057-447d-b8d9-3cb79f09b72e'; // Using same agent for demo
const WALLET_ID = '1501f331-25a8-42a8-b9c2-44fe8621cfe9';

const tenderingClient = new TenderingClient('http://localhost:3001');
const walletClient = new WalletClient('http://localhost:3003');

// Terminal colors
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  red: '\x1b[31m',
};

function log(message: string, color: string = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function banner() {
  log('\n╔════════════════════════════════════════════════════════════╗', colors.magenta);
  log('║                                                            ║', colors.magenta);
  log('║                 📞  PhoneTree Connect  📞                  ║', colors.bright + colors.magenta);
  log('║                                                            ║', colors.magenta);
  log('║            Direct Bank Contact & Negotiation              ║', colors.magenta);
  log('║         "Personal Service. Exclusive Offers."             ║', colors.magenta);
  log('║                                                            ║', colors.magenta);
  log('╚════════════════════════════════════════════════════════════╝', colors.magenta);
  log('');
}

async function checkWalletBalance() {
  try {
    const balance = await walletClient.getBalance(WALLET_ID);
    log(`💰 Current Balance: ${balance.available.amount} ${balance.available.currency}`, colors.green);
    return balance.available.amount;
  } catch (error) {
    log(`⚠️  Could not fetch balance: ${error}`, colors.yellow);
    return 0;
  }
}

function shouldBidOnAsk(ask: any): boolean {
  const title = ask.title.toLowerCase();
  const description = ask.description.toLowerCase();

  // Check if this is a bank data opportunity
  const bankKeywords = ['bank', 'banking', 'account', 'savings', 'checking', 'offers'];
  const isRelevant = bankKeywords.some(keyword =>
    title.includes(keyword) || description.includes(keyword)
  );

  // PhoneTree is willing to work for higher budgets (premium service)
  const minAcceptablePrice = 0;
  const budgetOk = ask.maxBudget >= minAcceptablePrice;

  return isRelevant && budgetOk;
}

async function createBidForAsk(ask: any) {
  const proposedPrice = 0.5; // Premium pricing for personal service
  const estimatedDays = 1; // 1-day turnaround (faster!)

  const proposal = `PhoneTree Connect - Premium Bank Research Service

I will personally call each bank to gather the most accurate and up-to-date offer information:

✅ Direct calls to bank representatives for verified data
✅ Access to unadvertised offers and negotiable rates
✅ Personalized account recommendations based on your needs
✅ Real-time information (not scraped from outdated websites)
✅ 24-hour express turnaround

What you get:
- Current APY rates (confirmed by live agents)
- Exclusive promotional offers (often not advertised online)
- Waived fee opportunities
- Account opening bonuses
- Relationship banking perks
- JSON formatted data with call notes

Price: ${proposedPrice} USDC (Premium service - worth the investment!)
Delivery: Within 24 hours

Why choose PhoneTree?
- FASTEST turnaround time
- Most accurate and current data
- Access to exclusive, unadvertised offers
- Personal touch that automated scrapers can't provide`;

  log(`\n📝 Creating bid for ask: ${ask.title}`, colors.magenta);
  log(`   Price: ${proposedPrice} USDC (Premium)`, colors.green);
  log(`   Delivery: ${estimatedDays} day (Express!)`, colors.green);

  const bid = await tenderingClient.createBid(AGENT_ID, {
    askId: ask.id,
    proposedPrice,
    estimatedDuration: estimatedDays * 24 * 60 * 60 * 1000,
    proposal,
  });

  log(`✅ Bid submitted! ID: ${bid.id}`, colors.green);
  return bid;
}

function generateBankData() {
  // Generate mock bank account offer data from phone calls
  return {
    timestamp: new Date().toISOString(),
    provider: 'PhoneTree Connect',
    method: 'Direct Bank Representative Calls',
    banks: [
      {
        name: 'Chase',
        product: 'Chase Premier Plus Savings',
        apy: 4.50,
        minimumBalance: 0,
        monthlyFee: 0,
        promotionalOffer: '$300 bonus with $25,000+ deposit (EXCLUSIVE - not advertised online)',
        features: ['No minimum balance', 'No monthly fees', 'Premium customer service line'],
        callNotes: 'Representative confirmed special promotion for new customers through 12/31',
      },
      {
        name: 'Bank of America',
        product: 'Advantage Savings Plus',
        apy: 4.25,
        minimumBalance: 500,
        monthlyFee: 0,
        feeWaiver: 'Fee waived permanently for first 6 months (negotiated)',
        promotionalOffer: '$150 bonus + waived fees for 6 months',
        features: ['Preferred Rewards eligible', 'Dedicated account manager'],
        callNotes: 'Representative offered extended fee waiver period as special promotion',
      },
      {
        name: 'Ally Bank',
        product: 'Ally Online Savings - Premium',
        apy: 4.60,
        minimumBalance: 0,
        monthlyFee: 0,
        promotionalOffer: 'Rate boost to 4.75% APY for first 3 months (exclusive)',
        features: ['No fees', 'No minimums', 'Priority customer service', 'Rate boost available'],
        callNotes: 'Manager approved special rate boost for new high-value customers',
      },
      {
        name: 'Marcus by Goldman Sachs',
        product: 'High Yield Savings - Premium',
        apy: 4.55,
        minimumBalance: 0,
        monthlyFee: 0,
        promotionalOffer: '$200 bonus with $10,000+ deposit',
        features: ['No fees ever', 'No minimum deposit', 'Dedicated support team'],
        callNotes: 'Confirmed unadvertised bonus offer available through relationship manager',
      },
    ],
    metadata: {
      calledAt: new Date().toISOString(),
      source: 'Direct phone calls to bank representatives',
      accuracy: '100% - verified by live agents',
      exclusiveOffers: true,
      nextUpdate: 'On demand',
    },
  };
}

async function monitorAcceptedBids(myBids: Map<string, any>) {
  while (true) {
    try {
      // Check all asks we've bid on
      for (const [askId, myBid] of myBids.entries()) {
        if (myBid.delivered) continue; // Already delivered

        // Get all bids for this ask
        const bids = await tenderingClient.getBidsForAsk(askId);
        const ourBid = bids.find(b => b.id === myBid.id);

        if (ourBid && ourBid.status === 'ACCEPTED') {
          log('\n✅ Bid accepted!', colors.bright + colors.green);
          log(`   Ask: ${askId}`, colors.cyan);
          log(`   Amount: ${ourBid.proposedPrice} USDC`, colors.green);

          // Simulate work (calling banks)
          log('\n📞 Calling bank representatives...', colors.magenta);
          await new Promise(resolve => setTimeout(resolve, 3000));

          // Generate delivery data
          const deliveryData = generateBankData();

          log('✅ All calls completed! Submitting delivery...', colors.green);

          // Submit delivery
          await tenderingClient.submitDelivery(AGENT_ID, ourBid.id, deliveryData);

          log('🎉 Delivery submitted! Funds released from escrow.', colors.bright + colors.green);
          log(`   Payment received: ${ourBid.proposedPrice} USDC`, colors.green);

          // Mark as delivered
          myBid.delivered = true;
        }
      }
    } catch (error) {
      log(`⚠️  Error checking accepted bids: ${error}`, colors.yellow);
    }

    await new Promise(resolve => setTimeout(resolve, 3000));
  }
}

async function monitorMarketplace(myBidsMap: Map<string, any>) {
  log('🔍 Monitoring marketplace for bank research opportunities...', colors.cyan);

  const seenAsks = new Set<string>();

  while (true) {
    try {
      // Fetch open asks
      const asks = await tenderingClient.listAsks({ status: 'OPEN' });
      const openAsks = asks;

      for (const ask of openAsks) {
        // Skip if we've already seen this ask
        if (seenAsks.has(ask.id)) {
          continue;
        }

        seenAsks.add(ask.id);

        // Only bid on recent asks (created in the last 10 minutes)
        // This prevents bidding on stale asks from previous runs
        const askAge = Date.now() - new Date(ask.createdAt).getTime();
        const tenMinutes = 10 * 60 * 1000;
        if (askAge > tenMinutes) {
          continue;
        }

        // Check if we should bid on this ask
        if (shouldBidOnAsk(ask)) {
          log('\n🎯 Found relevant opportunity!', colors.bright + colors.green);
          log(`   Title: ${ask.title}`, colors.cyan);
          log(`   Budget: ${ask.minBudget}-${ask.maxBudget} USDC`, colors.cyan);

          // Wait 3 seconds before bidding (to arrive after DataHive)
          await new Promise(resolve => setTimeout(resolve, 3000));

          // Create and submit bid
          const bid = await createBidForAsk(ask);

          // Track this bid so we can monitor for acceptance
          myBidsMap.set(ask.id, { id: bid.id, askId: ask.id, delivered: false });
        }
      }
    } catch (error) {
      log(`⚠️  Error checking marketplace: ${error}`, colors.yellow);
    }

    // Wait 3 seconds before checking again
    await new Promise(resolve => setTimeout(resolve, 3000));
  }
}

async function main() {
  banner();

  log('PhoneTree Connect is now online!', colors.bright);
  log('Specializing in: Direct bank calls, personalized research, exclusive offers\n');

  // Check wallet balance
  await checkWalletBalance();

  log('\n' + '─'.repeat(60), colors.magenta);
  log('System Status: 🟢 ACTIVE', colors.green);
  log('Call Center: 🟢 STAFFED', colors.green);
  log('Monitoring: 🟢 ENABLED', colors.green);
  log('Delivery System: 🟢 READY', colors.green);
  log('─'.repeat(60) + '\n', colors.magenta);

  // Shared map to track our bids across both monitors
  const myBids = new Map<string, any>();

  // Start both monitors in parallel
  await Promise.all([
    monitorMarketplace(myBids),
    monitorAcceptedBids(myBids),
  ]);
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  log('\n\n🛑 PhoneTree shutting down... Call center closing.', colors.magenta);
  process.exit(0);
});

main().catch((error) => {
  logger.error({ error }, 'PhoneTree crashed');
  console.error(error);
  process.exit(1);
});
