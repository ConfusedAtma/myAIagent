const micBtn = document.getElementById("micBtn");
const chat = document.getElementById("chat");
const WORKER_URL = "tight-credit-f313my-ai-agent-worker.sarkarkoushik427.workers.dev";

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
   VOICES
======================= */

let voices = [];
speechSynthesis.onvoiceschanged = () => {
  voices = speechSynthesis.getVoices();
};

/* =======================
   SPEECH RECOGNITION
======================= */

const SpeechRecognition =
  window.SpeechRecognition || window.webkitSpeechRecognition;

let recognition;
let listening = false;

if (SpeechRecognition) {
  recognition = new SpeechRecognition();
  recognition.lang = "en-IN";
  recognition.continuous = false;

  micBtn.onclick = () => {
    if (listening) return;
    listening = true;
    micBtn.classList.add("listening", "disabled");
    addSystemMessage("Listening...");
    recognition.start();
  };

  recognition.onresult = async (event) => {
    const text = event.results[0][0].transcript;
    addMessage(text, "user");
    addSystemMessage("Thinking...");
    await aiProcess(text);
  };

  recognition.onend = () => {
    listening = false;
    micBtn.classList.remove("listening", "disabled");
  };
}

/* =======================
   AI PROCESS (SECURE)
======================= */

async function aiProcess(text) {
  try {
    const res = await fetch(WORKER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text })
    });

    const aiJson = await res.json();
    executeIntent(aiJson);

  } catch {
    respond("AI service is not reachable right now.");
  }
}

/* =======================
   EXECUTE INTENT
======================= */

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

/* =======================
   REMINDER LOOP
======================= */

setInterval(() => {
  const now = new Date();
  memory.reminders.forEach(r => {
    if (!r.triggered && new Date(r.time) <= now) {
      respond("Reminder: " + r.text);
      if (Notification.permission === "granted") {
        new Notification("Reminder", { body: r.text });
      }
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
  const heera = voices.find(v => v.name.includes("Heera"));
  if (heera) utter.voice = heera;

  utter.lang = "en-IN";
  utter.rate = 0.95;
  utter.pitch = 1.1;

  speechSynthesis.speak(utter);
}
