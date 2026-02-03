document.addEventListener("DOMContentLoaded", () => {
  console.log("App booted");

  const micBtn = document.getElementById("micBtn");
  const chat = document.getElementById("chat");

  if (!micBtn || !chat) {
    console.error("Critical DOM elements missing");
    return;
  }

  // 🔐 Cloudflare Worker endpoint (PUBLIC, SAFE)
  const WORKER_URL =
    "https://tight-credit-f313my-ai-agent-worker.sarkarkoushik427.workers.dev";

  /* =======================
     SAFETY (GROK-STYLE)
  ======================= */

  const SAFETY = {
    MIN_GAP_MS: 3000, // 3 sec cooldown
    DAILY_LIMIT: 200  // soft limit
  };

  let lastAiCallTime = 0;

  function todayKey() {
    const d = new Date();
    return `ai-usage-${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  }

  function getDailyUsage() {
    return Number(localStorage.getItem(todayKey()) || 0);
  }

  function incrementDailyUsage() {
    const count = getDailyUsage() + 1;
    localStorage.setItem(todayKey(), count);
    return count;
  }

  /* =======================
     MEMORY
  ======================= */

  let memory = JSON.parse(localStorage.getItem("agentMemory")) || {
    notes: [],
    reminders: []
  };

  function saveMemory() {
    localStorage.setItem("agentMemory", JSON.stringify(memory));
  }

  /* =======================
     CHAT UI
  ======================= */

  function addMessage(text, type) {
    const div = document.createElement("div");
    div.className = `message ${type}`;
    div.innerText = text;
    chat.appendChild(div);
    chat.scrollTop = chat.scrollHeight;
  }

  function addSystem(text) {
    const div = document.createElement("div");
    div.className = "system";
    div.innerText = text;
    chat.appendChild(div);
    chat.scrollTop = chat.scrollHeight;
  }

  /* =======================
     SPEECH
  ======================= */

  const SpeechRecognition =
    window.SpeechRecognition || window.webkitSpeechRecognition;

  if (!SpeechRecognition) {
    addSystem("Speech recognition not supported on this device.");
    return;
  }

  const recognition = new SpeechRecognition();
  recognition.lang = "en-IN";
  recognition.continuous = false;
  recognition.interimResults = false;

  micBtn.addEventListener("click", () => {
    addSystem("Listening…");
    recognition.start();
  });

  recognition.onresult = async (event) => {
    const text = event.results[0][0].transcript;
    addMessage(text, "user");
    addSystem("Thinking…");
    await aiProcess(text);
  };

  recognition.onerror = () => {
    addSystem("Mic error. Try again.");
  };

  /* =======================
     AI PROCESS (SAFE)
  ======================= */

  async function aiProcess(text) {
    const now = Date.now();

    // Cooldown
    if (now - lastAiCallTime < SAFETY.MIN_GAP_MS) {
      addSystem("Hold on…");
      return;
    }

    // Daily soft limit
    if (getDailyUsage() >= SAFETY.DAILY_LIMIT) {
      respond("Let’s pause for today. We can continue tomorrow 🙂");
      return;
    }

    lastAiCallTime = now;
    incrementDailyUsage();

    try {
      const res = await fetch(WORKER_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text })
      });

      if (!res.ok) {
        respond("Too many requests. Slow down a bit.");
        return;
      }

      const ai = await res.json();
      executeIntent(ai);

    } catch (e) {
      console.error(e);
      respond("AI not reachable right now.");
    }
  }

  /* =======================
     INTENT EXECUTION
  ======================= */

  function executeIntent(ai) {
    if (ai.intent === "NOTE") {
      memory.notes.push({
        text: ai.text,
        time: new Date().toISOString()
      });
      saveMemory();
      respond("Saved as note.");
      return;
    }

    if (ai.intent === "REMINDER" && ai.time) {
      const [h, m] = ai.time.split(":").map(Number);
      const t = new Date();
      t.setHours(h, m, 0, 0);

      memory.reminders.push({
        text: ai.text,
        time: t.toISOString(),
        triggered: false
      });

      saveMemory();
      respond(`Reminder set for ${ai.time}`);
      return;
    }

    respond("I understood you, but no action matched.");
  }

  /* =======================
     REMINDER LOOP
  ======================= */

  setInterval(() => {
    const now = new Date();

    memory.reminders.forEach(r => {
      if (!r.triggered && new Date(r.time) <= now) {
        respond("Reminder: " + r.text);
        r.triggered = true;
        saveMemory();
      }
    });
  }, 20000);

  /* =======================
     AGENT RESPONSE
  ======================= */

  function respond(message) {
    addMessage(message, "agent");
    const utter = new SpeechSynthesisUtterance(message);
    utter.lang = "en-IN";
    speechSynthesis.speak(utter);
  }
});
