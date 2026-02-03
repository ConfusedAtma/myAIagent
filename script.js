document.addEventListener("DOMContentLoaded", () => {
  console.log("JS loaded, DOM ready");

  const micBtn = document.getElementById("micBtn");
  const chat = document.getElementById("chat");

  if (!micBtn) {
    console.error("Mic button not found");
    return;
  }

  const WORKER_URL = "https://tight-credit-f313my-ai-agent-worker.sarkarkoushik427.workers.dev";

  /* =======================
     MEMORY
  ======================= */

  let memory = JSON.parse(localStorage.getItem("agentMemory")) || {
    notes: [],
    reminders: [],
    schedules: []
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

  function addSystemMessage(text) {
    const div = document.createElement("div");
    div.className = "system";
    div.innerText = text;
    chat.appendChild(div);
    chat.scrollTop = chat.scrollHeight;
  }

  /* =======================
     SPEECH RECOGNITION
  ======================= */

  const SpeechRecognition =
    window.SpeechRecognition || window.webkitSpeechRecognition;

  if (!SpeechRecognition) {
    addSystemMessage("Speech recognition not supported on this device.");
    return;
  }

  const recognition = new SpeechRecognition();
  recognition.lang = "en-IN";
  recognition.continuous = false;
  recognition.interimResults = false;

  micBtn.addEventListener("click", () => {
    console.log("Mic clicked");
    addSystemMessage("Listening...");
    recognition.start();
  });

  recognition.onresult = async (event) => {
    const text = event.results[0][0].transcript;
    addMessage(text, "user");
    addSystemMessage("Thinking...");
    await aiProcess(text);
  };

  recognition.onerror = (e) => {
    console.error("Speech error", e);
    addSystemMessage("Mic error. Try again.");
  };

  /* =======================
     AI PROCESS
  ======================= */

  async function aiProcess(text) {
    try {
      const res = await fetch(WORKER_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text })
      });

      const ai = await res.json();
      executeIntent(ai);
    } catch (err) {
      console.error(err);
      addSystemMessage("AI not reachable.");
    }
  }

  function executeIntent(ai) {
    if (ai.intent === "NOTE") {
      memory.notes.push({ text: ai.text, time: new Date().toISOString() });
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

  function respond(message) {
    addMessage(message, "agent");
    const utter = new SpeechSynthesisUtterance(message);
    utter.lang = "en-IN";
    speechSynthesis.speak(utter);
  }
});
