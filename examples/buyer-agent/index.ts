import { HarborClient } from '@harbor/sdk';
import * as readline from 'readline';

// Configuration from environment variables
const API_KEY = process.env.HARBOR_API_KEY || '';
const AGENT_ID = process.env.HARBOR_AGENT_ID || '';

if (!API_KEY || !AGENT_ID) {
  console.error('❌ Error: HARBOR_API_KEY and HARBOR_AGENT_ID environment variables are required');
  process.exit(1);
}

// Utility to simulate thinking/processing time
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Utility to simulate thinking with random delay
const think = async (message: string, minMs = 500, maxMs = 2000) => {
  const thinkTime = Math.floor(Math.random() * (maxMs - minMs)) + minMs;
  console.log(`🤔 ${message}...`);
  await delay(thinkTime);
};

// Utility to prompt user for yes/no decision
const promptYesNo = async (question: string): Promise<boolean> => {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(`${question} (y/n): `, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
    });
  });
};

async function runBuyerAgent() {
  console.log('🏪 Buyer Agent Starting');
  console.log(`📝 Agent ID: ${AGENT_ID}`);
  console.log('');

  // Create SDK client
  const client = new HarborClient({
    apiKey: API_KEY,
    agentId: AGENT_ID,
  });

  // Set up event listeners
  client.on('connected', (data) => {
    console.log(`✅ Connected to Harbor marketplace`);
    console.log(`👤 Authenticated as agent: ${data.agentId}`);
    console.log('');
  });

  client.on('bid_created', async (data) => {
    console.log('');
    console.log(`📬 New bid received!`);
    console.log(`   Bid ID: ${data.bidId}`);
    console.log(`   Price: ${data.price} ${data.currency}`);
    console.log(`   Seller Agent: ${data.agentId}`);
    console.log('');

    await think('Evaluating bid');

    const shouldAccept = await promptYesNo('Accept this bid?');

    if (!shouldAccept) {
      console.log(`⏭️  Bid declined`);
      console.log('');
      return;
    }

    try {
      console.log(`✅ Accepting bid ${data.bidId}...`);
      const result = await client.acceptBid({
        agentId: AGENT_ID,
        askId: data.askId,
        bidId: data.bidId,
      });

      console.log(`🎉 Bid accepted successfully!`);
      console.log(`   Contract created`);
      console.log('');
    } catch (error) {
      console.error(`❌ Failed to accept bid:`, error);
    }
  });

  client.on('bid_accepted', (data) => {
    console.log('');
    console.log(`🤝 Bid accepted event received`);
    console.log(`   Contract ID: ${data.contractId}`);
    console.log(`   Awaiting delivery...`);
    console.log('');
  });

  client.on('delivery_submitted', (data) => {
    console.log('');
    console.log(`📦 Delivery received!`);
    console.log(`   Contract ID: ${data.contractId}`);
    console.log('');
    console.log(`📄 Delivery Details:`);
    console.log(JSON.stringify(data.deliveryData, null, 2));
    console.log('');
    console.log(`✨ Transaction complete!`);
    console.log('');
  });

  client.on('error', (data) => {
    console.error(`❌ Error:`, data.message);
  });

  client.on('disconnected', (data) => {
    console.log(`⚠️  Disconnected from marketplace`);
    if (data.reason) {
      console.log(`   Reason: ${data.reason}`);
    }
  });

  // Connect to the WebSocket server
  try {
    await client.connect();
  } catch (error) {
    console.error('❌ Failed to connect:', error);
    process.exit(1);
  }

  // Wait a bit before posting ask
  await think('Preparing to post ask', 1000, 2000);

  // Create an ask
  try {
    console.log('📝 Creating ask...');
    console.log('   Description: Looking for a web scraping service');
    console.log('   Max Budget: 100 USDC');
    console.log('');

    const ask = await client.createAsk({
      agentId: AGENT_ID,
      title: 'Web Scraping Service Needed',
      description: 'Looking for a web scraping service to extract data from e-commerce sites',
      requirements: {
        tech: 'Python or Node.js',
        experience: 'Must have experience with e-commerce sites',
      },
      minBudget: 50,
      maxBudget: 100,
    });

    console.log(`✅ Ask created successfully!`);
    console.log(`   Ask ID: ${ask.id}`);
    console.log(`   Status: ${ask.status}`);
    console.log('');
    console.log(`⏳ Waiting for bids...`);
    console.log('');
  } catch (error) {
    console.error('❌ Failed to create ask:', error);
    process.exit(1);
  }

  // Keep the process running
  process.on('SIGINT', () => {
    console.log('');
    console.log('👋 Buyer agent shutting down...');
    client.disconnect();
    process.exit(0);
  });
}

runBuyerAgent().catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
