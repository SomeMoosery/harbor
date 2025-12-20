#!/usr/bin/env tsx

/**
 * SwiftSwitch - AI Bank Account Switching Assistant
 *
 * Company: SwiftSwitch Inc.
 * Mission: Make switching bank accounts effortless
 *
 * This buyer agent helps users switch bank accounts by:
 * - Finding the best bank offers
 * - Moving funds between accounts
 * - Switching over subscriptions
 * - Closing old accounts
 */

import { createLogger } from '@harbor/logger';
import { TenderingClient } from '../../../services/tendering/src/public/client/index.js';
import { WalletClient } from '../../../services/wallet/src/public/client/index.js';
import { SettlementClient } from '../../../services/settlement/src/public/client/index.js';
import readline from 'readline';

const logger = createLogger({ service: 'swiftswitch-buyer' });

// Agent configuration
const AGENT_ID = 'cd818885-4024-433d-9b09-802b8df56306'; // Your buyer agent ID
const WALLET_ID = '58879470-6cfd-482a-a746-a710c6dec9fa'; // Your wallet ID

const tenderingClient = new TenderingClient('http://localhost:3001');
const walletClient = new WalletClient('http://localhost:3003');
const settlementClient = new SettlementClient('http://localhost:3004');

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
  log('\n╔════════════════════════════════════════════════════════════╗', colors.cyan);
  log('║                                                            ║', colors.cyan);
  log('║              🏦  SwiftSwitch Bank Assistant  🏦             ║', colors.bright + colors.cyan);
  log('║                                                            ║', colors.cyan);
  log('║        Making bank account switching effortless!          ║', colors.cyan);
  log('║                                                            ║', colors.cyan);
  log('╚════════════════════════════════════════════════════════════╝', colors.cyan);
  log('');
}

async function promptUser(question: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(`${colors.bright}${question}${colors.reset} `, (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase());
    });
  });
}

async function checkWalletBalance() {
  try {
    const balance = await walletClient.getBalance(WALLET_ID);
    log(`\n💰 Current Balance: ${balance.available.amount} ${balance.available.currency}`, colors.green);
    return balance.available.amount;
  } catch (error) {
    log(`⚠️  Could not fetch balance: ${error}`, colors.yellow);
    return 0;
  }
}

async function postAskForBankData() {
  log('\n📝 Posting ask to marketplace...', colors.blue);

  const ask = await tenderingClient.createAsk(AGENT_ID, {
    title: 'Get Latest Bank Account Offers - High Yield Savings',
    description: `SwiftSwitch needs comprehensive, up-to-date information on bank account offers for high-yield savings accounts. We need current APY rates, minimum balances, fees, and promotional offers from major banks.

Required data:
- Current APY rates for savings accounts
- Minimum balance requirements
- Monthly fees (if any)
- Promotional offers (bonus cash, rate boosts, etc.)
- Account opening requirements

Target banks: Chase, Bank of America, Ally Bank, Marcus by Goldman Sachs, Capital One, Discover, American Express Savings

Deliverable: JSON file with structured bank offer data`,
    requirements: {
      format: 'JSON',
      banks: ['Chase', 'BofA', 'Ally', 'Marcus', 'Capital One', 'Discover', 'AmEx'],
      includePromotions: true,
    },
    minBudget: 30,
    maxBudget: 80,
  });

  log(`✅ Ask created! ID: ${ask.id}`, colors.green);
  log(`   Budget: ${ask.minBudget} - ${ask.maxBudget} USDC`, colors.green);
  return ask;
}

async function waitForBids(askId: string) {
  log(`\n⏳ Waiting for bids...`, colors.yellow);
  log(`   (Sellers will submit bids as they see your request)`, colors.yellow);
  log(`   Press Enter when you're ready to review and select a bid.\n`, colors.cyan);

  const seenBidIds = new Set<string>();
  let bids: any[] = [];
  let keepPolling = true;

  // Start polling for new bids in the background
  const pollForBids = async () => {
    while (keepPolling) {
      try {
        const currentBids = await tenderingClient.getBidsForAsk(askId);

        // Check for new bids
        for (const bid of currentBids) {
          if (!seenBidIds.has(bid.id)) {
            seenBidIds.add(bid.id);
            const estimatedDays = Math.round(bid.estimatedDuration / (1000 * 60 * 60 * 24));
            log(`📬 New bid received! ${bid.proposedPrice} USDC, ${estimatedDays} day(s)`, colors.green);
          }
        }

        bids = currentBids;
      } catch (error) {
        // Continue waiting
      }

      // Wait 2 seconds before checking again
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  };

  // Start background polling
  pollForBids();

  // Wait for user to press Enter
  await promptUser('');

  // Stop polling
  keepPolling = false;

  return bids;
}

function displayBids(bids: any[]) {
  log('\n╔════════════════════════════════════════════════════════════╗', colors.magenta);
  log('║                     📋 BIDS RECEIVED                       ║', colors.magenta);
  log('╚════════════════════════════════════════════════════════════╝', colors.magenta);

  bids.forEach((bid, index) => {
    const estimatedDays = Math.round(bid.estimatedDuration / (1000 * 60 * 60 * 24));

    log(`\n${colors.bright}Bid #${index + 1}${colors.reset}`, colors.cyan);
    log(`  ID: ${bid.id}`);
    log(`  Agent: ${bid.agentId}`);
    log(`  💵 Price: ${bid.proposedPrice} USDC`, colors.green);
    log(`  ⏱️  Estimated Time: ${estimatedDays} days`);
    log(`  📄 Proposal:`);
    log(`     ${bid.proposal}`);
  });
}

async function selectAndAcceptBid(askId: string, bids: any[]) {
  log('\n' + '='.repeat(60), colors.cyan);
  const choice = await promptUser(`Which bid would you like to accept? (1-${bids.length}, or 'n' to cancel):`);

  if (choice === 'n' || choice === 'no') {
    log('❌ Cancelled bid selection', colors.yellow);
    return null;
  }

  const bidIndex = parseInt(choice) - 1;
  if (bidIndex < 0 || bidIndex >= bids.length) {
    log('❌ Invalid selection', colors.yellow);
    return null;
  }

  const selectedBid = bids[bidIndex];
  log(`\n✨ Accepting bid from agent ${selectedBid.agentId}...`, colors.blue);

  try {
    await tenderingClient.acceptBid(AGENT_ID, selectedBid.id);
    log(`✅ Bid accepted! Funds locked in escrow.`, colors.green);
    log(`   Contract ID: ${selectedBid.id}`, colors.green);
    log(`   Amount: ${selectedBid.proposedPrice} USDC`, colors.green);
    return selectedBid;
  } catch (error) {
    log(`❌ Failed to accept bid: ${error}`, colors.yellow);
    return null;
  }
}

function analyzeBankOffers(deliveryData: any) {
  if (!deliveryData || !deliveryData.banks) {
    log('\n⚠️  Delivery data format not recognized', colors.yellow);
    return;
  }

  log('\n╔════════════════════════════════════════════════════════════╗', colors.cyan);
  log('║           📊  BANK ACCOUNT OFFERS ANALYSIS  📊             ║', colors.bright + colors.cyan);
  log('╚════════════════════════════════════════════════════════════╝', colors.cyan);

  log(`\n📦 Received from: ${deliveryData.provider}`, colors.blue);
  log(`   Method: ${deliveryData.method}`, colors.blue);
  log(`   ${deliveryData.banks.length} banks analyzed\n`);

  // Find best APY
  const bestApy = deliveryData.banks.reduce((best: any, bank: any) =>
    bank.apy > (best?.apy || 0) ? bank : best, null);

  // Find best promotional offer
  const bestPromo = deliveryData.banks.find((bank: any) =>
    bank.promotionalOffer && bank.promotionalOffer !== 'None');

  log('🏆 TOP RECOMMENDATIONS:', colors.bright + colors.green);
  if (bestApy) {
    log(`\n   Best Rate: ${bestApy.name} - ${bestApy.product}`, colors.green);
    log(`   💰 APY: ${bestApy.apy}%`, colors.bright + colors.green);
    log(`   💵 Monthly Fee: $${bestApy.monthlyFee}`, bestApy.monthlyFee === 0 ? colors.green : colors.yellow);
    if (bestApy.minimumBalance > 0) {
      log(`   📊 Minimum Balance: $${bestApy.minimumBalance.toLocaleString()}`, colors.cyan);
    }
  }

  if (bestPromo && bestPromo.name !== bestApy?.name) {
    log(`\n   Best Promotion: ${bestPromo.name}`, colors.green);
    log(`   🎁 ${bestPromo.promotionalOffer}`, colors.bright + colors.green);
  }

  log('\n📋 ALL OFFERS:', colors.cyan);
  deliveryData.banks.forEach((bank: any, index: number) => {
    log(`\n   ${index + 1}. ${bank.name} - ${bank.product}`, colors.bright);
    log(`      APY: ${bank.apy}% | Min: $${bank.minimumBalance} | Fee: $${bank.monthlyFee}/mo`, colors.reset);
    if (bank.promotionalOffer && bank.promotionalOffer !== 'None') {
      log(`      🎁 ${bank.promotionalOffer}`, colors.yellow);
    }
    if (bank.callNotes) {
      log(`      📞 ${bank.callNotes}`, colors.magenta);
    }
  });

  log('\n' + '─'.repeat(60), colors.cyan);
  log('✨ You can now use this data to switch to a better bank account!', colors.bright + colors.green);
  log('─'.repeat(60), colors.cyan);
}

async function waitForDelivery(askId: string) {
  log('\n⏳ Waiting for seller to deliver...', colors.yellow);
  log('   (The seller is now working on your request)', colors.yellow);

  while (true) {
    try {
      const ask = await tenderingClient.getAsk(askId);

      if (ask.status === 'COMPLETED') {
        log('\n🎉 Delivery received!', colors.bright + colors.green);
        log('   The seller has completed the work.', colors.green);
        log('   Funds have been released from escrow to the seller.', colors.green);

        // Display and analyze the delivery data
        if (ask.deliveryData) {
          analyzeBankOffers(ask.deliveryData);
        } else {
          log('\n⚠️  No delivery data received', colors.yellow);
          log('   (This might be a system issue - delivery data should be included)', colors.yellow);
        }

        return ask;
      }
    } catch (error) {
      // Continue waiting
    }

    // Wait 2 seconds before checking again
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
}

async function main() {
  banner();

  log('Welcome! I\'m SwiftSwitch, your AI bank account switching assistant.', colors.bright);
  log('I help you find the best bank offers and manage the entire switching process.\n');

  // Check wallet balance
  const balance = await checkWalletBalance();

  if (balance < 30) {
    log('\n⚠️  Warning: Your balance is low. You may need to deposit funds to post asks.', colors.yellow);
    log('   Run the deposit example to add funds to your wallet.\n', colors.yellow);
  }

  // Main interaction loop
  while (true) {
    log('\n' + '─'.repeat(60), colors.cyan);
    const answer = await promptUser('\n🔍 Would you like me to get the latest bank account offers? (yes/no):');

    if (answer === 'yes' || answer === 'y') {
      try {
        // Post the ask
        const ask = await postAskForBankData();

        // Wait for bids
        const bids = await waitForBids(ask.id);

        if (bids.length === 0) {
          log('\n😞 No bids received yet. You can wait longer and check again.', colors.yellow);
          continue;
        }

        // Display bids
        displayBids(bids);

        // Let user select and accept a bid
        const acceptedBid = await selectAndAcceptBid(ask.id, bids);

        if (acceptedBid) {
          // Wait for the seller to deliver
          await waitForDelivery(ask.id);

          // Check updated wallet balance
          log('\n💰 Updated wallet balance:', colors.cyan);
          await checkWalletBalance();
        }
      } catch (error) {
        log(`\n❌ Error: ${error}`, colors.yellow);
        logger.error({ error }, 'Failed to process ask');
      }
    } else if (answer === 'no' || answer === 'n') {
      log('\n👋 No problem! Let me know if you need anything else.', colors.cyan);
      continue;
    } else if (answer === 'quit' || answer === 'exit') {
      log('\n👋 Thank you for using SwiftSwitch! Goodbye!', colors.cyan);
      process.exit(0);
    } else {
      log('\n❓ Please answer yes or no (or type "quit" to exit)', colors.yellow);
    }
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  log('\n\n👋 SwiftSwitch shutting down... Goodbye!', colors.cyan);
  process.exit(0);
});

main().catch((error) => {
  logger.error({ error }, 'SwiftSwitch crashed');
  console.error(error);
  process.exit(1);
});
