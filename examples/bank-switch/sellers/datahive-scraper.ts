#!/usr/bin/env tsx

/**
 * DataHive - Web Scraping Specialist
 *
 * Company: DataHive Analytics
 * Specialty: Real-time web scraping and data extraction
 * Pricing: Lower cost, slightly longer turnaround (automated scraping)
 *
 * This seller agent monitors Harbor for asks requiring web scraping
 * and automatically bids on relevant opportunities.
 */

import { createLogger } from '@harbor/logger';
import { TenderingClient } from '../../../services/tendering/src/public/client/index.js';
import { WalletClient } from '../../../services/wallet/src/public/client/index.js';

const logger = createLogger({ service: 'datahive-seller' });

// Agent configuration
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
};

function log(message: string, color: string = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function banner() {
  log('\n╔════════════════════════════════════════════════════════════╗', colors.blue);
  log('║                                                            ║', colors.blue);
  log('║                  🕷️   DataHive Analytics  🕷️                ║', colors.bright + colors.blue);
  log('║                                                            ║', colors.blue);
  log('║             Web Scraping & Data Extraction                ║', colors.blue);
  log('║           "Automated. Accurate. Always On."               ║', colors.blue);
  log('║                                                            ║', colors.blue);
  log('╚════════════════════════════════════════════════════════════╝', colors.blue);
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

  // Check if this is a data scraping opportunity
  // Look for bank-related data gathering OR explicit scraping requests
  const bankDataKeywords = ['bank', 'account', 'savings', 'offers', 'rates'];
  const scrapingKeywords = ['scrape', 'scraping', 'web data', 'extract', 'crawl'];

  const isBankData = bankDataKeywords.some(keyword =>
    title.includes(keyword) || description.includes(keyword)
  );

  const isScrapingRequest = scrapingKeywords.some(keyword =>
    title.includes(keyword) || description.includes(keyword)
  );

  const isRelevant = isBankData || isScrapingRequest;

  // Check if budget is acceptable
  const minAcceptablePrice = 0;
  const budgetOk = ask.maxBudget >= minAcceptablePrice;

  return isRelevant && budgetOk;
}

async function createBidForAsk(ask: any) {
  const proposedPrice = 0.5; // Competitive pricing for automated scraping
  const estimatedDays = 2; // 2-day turnaround

  const proposal = `DataHive Analytics - Automated Web Scraping Solution

I can deliver comprehensive bank account offer data using our proprietary web scraping infrastructure:

✅ Real-time data extraction from all major bank websites
✅ Structured JSON output with complete offer details
✅ APY rates, fees, minimums, and promotional offers
✅ Automated validation and accuracy checks
✅ 2-day turnaround time

Our scraping bots run 24/7 and can gather data from:
- Public bank websites
- Rate comparison sites
- Financial news sources

Price: ${proposedPrice} USDC (Automated scraping - lower cost!)
Delivery: Within 2 days

Why choose DataHive?
- Lower cost than manual research
- Automated and scalable
- Proven track record with 99.8% accuracy`;

  log(`\n📝 Creating bid for ask: ${ask.title}`, colors.blue);
  log(`   Price: ${proposedPrice} USDC`, colors.green);
  log(`   Delivery: ${estimatedDays} days`, colors.green);

  const bid = await tenderingClient.createBid(AGENT_ID, {
    askId: ask.id,
    proposedPrice,
    estimatedDuration: estimatedDays * 24 * 60 * 60 * 1000, // Convert to milliseconds
    proposal,
  });

  log(`✅ Bid submitted! ID: ${bid.id}`, colors.green);
  return bid;
}

function generateBankData() {
  // Generate mock bank account offer data
  return {
    timestamp: new Date().toISOString(),
    provider: 'DataHive Analytics',
    method: 'Automated Web Scraping',
    banks: [
      {
        name: 'Chase',
        product: 'Chase Premier Savings',
        apy: 4.35,
        minimumBalance: 0,
        monthlyFee: 0,
        promotionalOffer: '$200 bonus with $15,000+ deposit',
        features: ['No minimum balance', 'No monthly fees', 'Mobile app access'],
      },
      {
        name: 'Bank of America',
        product: 'Advantage Savings',
        apy: 4.10,
        minimumBalance: 500,
        monthlyFee: 8,
        feeWaiver: 'Waived with $500+ balance or $25+ monthly deposits',
        promotionalOffer: '$100 bonus with qualifying direct deposit',
        features: ['Preferred Rewards eligible', 'ATM access nationwide'],
      },
      {
        name: 'Ally Bank',
        product: 'Ally Online Savings',
        apy: 4.50,
        minimumBalance: 0,
        monthlyFee: 0,
        promotionalOffer: 'None',
        features: ['No fees', 'No minimums', '24/7 customer service', 'Rate among highest in industry'],
      },
      {
        name: 'Marcus by Goldman Sachs',
        product: 'High Yield Savings',
        apy: 4.40,
        minimumBalance: 0,
        monthlyFee: 0,
        promotionalOffer: 'None',
        features: ['No fees ever', 'No minimum deposit', 'Easy transfers'],
      },
    ],
    metadata: {
      scrapedAt: new Date().toISOString(),
      source: 'Public bank websites',
      accuracy: '99.8%',
      nextUpdate: 'Daily',
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

          // Simulate work (in reality, scrape the bank websites)
          log('\n🕷️  Starting web scraping...', colors.blue);
          await new Promise(resolve => setTimeout(resolve, 2000));

          // Generate delivery data
          const deliveryData = generateBankData();

          log('✅ Data collected! Submitting delivery...', colors.green);

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
  log('🔍 Monitoring marketplace for scraping opportunities...', colors.cyan);

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

          // Wait 1 second before bidding (stagger bids)
          await new Promise(resolve => setTimeout(resolve, 1000));

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

  log('DataHive Analytics is now online!', colors.bright);
  log('Specializing in: Web scraping, data extraction, and automated research\n');

  // Check wallet balance
  await checkWalletBalance();

  log('\n' + '─'.repeat(60), colors.blue);
  log('System Status: 🟢 ACTIVE', colors.green);
  log('Scraping Bots: 🟢 ONLINE', colors.green);
  log('Monitoring: 🟢 ENABLED', colors.green);
  log('Delivery System: 🟢 READY', colors.green);
  log('─'.repeat(60) + '\n', colors.blue);

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
  log('\n\n🛑 DataHive shutting down... Scraping bots deactivated.', colors.blue);
  process.exit(0);
});

main().catch((error) => {
  logger.error({ error }, 'DataHive crashed');
  console.error(error);
  process.exit(1);
});
