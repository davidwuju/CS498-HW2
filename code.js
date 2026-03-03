const US = "http://34.173.250.176:8080";
const EU = "http://34.22.204.210:8080";

async function request(url, options) {
  const start = Date.now();
  const res = await fetch(url, options);
  const text = await res.text();
  const timeMs = Date.now() - start;
  return { timeMs, status: res.status, text };
}

async function avgLatency(baseUrl, trials) {
  await request(baseUrl + "/clear", { method: "POST" });
  let registerTimes = [];
  for (let i = 0; i < trials; i++) {
    const username = `lat_${Date.now()}_${i}`;
    const r = await request(baseUrl + "/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username }),
    });
    registerTimes.push(r.timeMs);
  }

  let listTimes = [];
  for (let i = 0; i < trials; i++) {
    const r = await request(baseUrl + "/list", { method: "GET" });
    listTimes.push(r.timeMs);
  }

  let regSum = 0;
  for (const t of registerTimes) regSum += t;
  let listSum = 0;
  for (const t of listTimes) listSum += t;

  return {
    registerAvgMs: Math.round(regSum / registerTimes.length),
    listAvgMs: Math.round(listSum / listTimes.length),
  };
}

async function consistencyTest(iterations) {
  await request(US + "/clear", { method: "POST" });

  let misses = 0;

  for (let i = 0; i < iterations; i++) {
    const username = `ec_${Date.now()}_${i}`;

    await request(US + "/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username }),
    });

    const listRes = await request(EU + "/list", { method: "GET" });

    let users = [];
    try {
      users = JSON.parse(listRes.text).users;
    } catch (e) {
      console.log("Could not parse EU /list response:", listRes.text);
      continue;
    }

    if (!users.includes(username)) {
      misses++;
    }
  }

  return { iterations, misses };
}

(async () => {
  const trials = 10;

  console.log("Latency test (" + trials + " trials each)\n");

  const usLat = await avgLatency(US, trials);
  console.log("US:", usLat);

  const euLat = await avgLatency(EU, trials);
  console.log("EU:", euLat);

  console.log("\nEventual consistency test (100 iterations)\n");

  const result = await consistencyTest(100);
  console.log("Result:", result);
})();
