const TestDriver = require("./sdk.js");

async function test() {
  console.log("Testing sandbox rendering...");

  const client = new TestDriver(process.env.TD_API_KEY, {
    os: process.env.TEST_PLATFORM || "linux",
    logging: true,
  });

  try {
    console.log("Connecting to sandbox...");
    const instance = await client.connect();
    console.log("Connected to instance:", instance);

    // Wait a bit to see if browser opens
    await new Promise((resolve) => setTimeout(resolve, 5000));

    await client.disconnect();
    console.log("Test completed successfully");
  } catch (error) {
    console.error("Test failed:", error);
    process.exit(1);
  }
}

test();
