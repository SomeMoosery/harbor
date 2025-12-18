import { HarborClient } from '@harbor/sdk';

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

async function runSellerAgent() {
  console.log('🛠️  Seller Agent Starting');
  console.log(`📝 Agent ID: ${AGENT_ID}`);
  console.log('');

  // Create SDK client
  const client = new HarborClient({
    apiKey: API_KEY,
    agentId: AGENT_ID,
  });

  // Track accepted bids for delivery (bidId -> contractId mapping)
  const acceptedBids = new Map<string, string>();

  // Set up event listeners
  client.on('connected', (data) => {
    console.log(`✅ Connected to Harbor marketplace`);
    console.log(`👤 Authenticated as agent: ${data.agentId}`);
    console.log('');
    console.log(`👀 Monitoring for new asks...`);
    console.log('');
  });

  client.on('ask_created', async (data) => {
    console.log('');
    console.log(`📬 New ask received!`);
    console.log(`   Ask ID: ${data.askId}`);
    console.log(`   Description: ${data.description}`);
    console.log(`   Max Price: ${data.maxPrice} USDC`);

    await think('Analyzing ask and preparing bid', 1500, 3000);

    // Calculate our bid (let's bid 80% of max price for this example)
    const bidPrice = Math.floor(data.maxPrice * 0.8);
    const estimatedDays = 7;
    const estimatedDurationMs = estimatedDays * 24 * 60 * 60 * 1000;

    try {
      console.log(`💰 Submitting bid for ${bidPrice} USDC...`);

      const bid = await client.createBid({
        agentId: AGENT_ID,
        askId: data.askId,
        proposedPrice: bidPrice,
        estimatedDuration: estimatedDurationMs,
        proposal: `I can complete this work in ${estimatedDays} days for ${bidPrice} USDC. I have extensive experience with web scraping and the technologies required.`,
      });

      console.log(`✅ Bid submitted successfully!`);
      console.log(`   Bid ID: ${bid.id}`);
      console.log(`   Waiting for buyer's decision...`);
      console.log('');
    } catch (error) {
      console.error(`❌ Failed to submit bid:`, error);
    }
  });

  client.on('bid_accepted', async (data) => {
    console.log('');
    console.log(`🎉 My bid was accepted!`);
    console.log(`   Bid ID: ${data.bidId}`);
    console.log(`   Contract ID: ${data.contractId}`);

    // Track this for delivery
    acceptedBids.set(data.bidId, data.contractId);

    await think('Preparing work and delivery', 2000, 4000);

    try {
      console.log(`📦 Submitting delivery for bid ${data.bidId}...`);

      await client.submitDelivery({
        agentId: AGENT_ID,
        bidId: data.bidId,
        deliveryProof: {
          completedAt: new Date().toISOString(),
          results: 'Web scraping service completed successfully',
          dataUrl: 'https://example.com/scraped-data.json',
        },
      });

      console.log(`✅ Delivery submitted successfully!`);
      console.log(`   Payment should be released soon...`);
      console.log('');

      acceptedBids.delete(data.bidId);
    } catch (error) {
      console.error(`❌ Failed to submit delivery:`, error);
    }
  });

  client.on('delivery_submitted', (data) => {
    console.log('');
    console.log(`📬 Delivery confirmation received`);
    console.log(`   Contract ID: ${data.contractId}`);
    console.log(`💰 Payment released!`);
    console.log(`✨ Transaction complete!`);
    console.log('');
    console.log(`👀 Monitoring for new asks...`);
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

  // Keep the process running
  process.on('SIGINT', () => {
    console.log('');
    console.log('👋 Seller agent shutting down...');
    client.disconnect();
    process.exit(0);
  });
}

runSellerAgent().catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
