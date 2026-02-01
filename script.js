import "./config.js";

const micBtn = document.getElementById("micBtn");
const chat = document.getElementById("chat");

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
   AI PROCESSING
======================= */

async function aiProcess(text) {
  try {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${AI_CONFIG.API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "llama3-8b-8192",
        messages: [
          {
            role: "system",
            content: `
You are an intent extractor.
Return ONLY valid JSON.
Possible intents: REMINDER, NOTE, SCHEDULE, UNKNOWN.
Time format: HH:MM (24h) or null.
`
          },
          {
            role: "user",
            content: text
          }
        ]
      })
    });

    const data = await response.json();
    const aiText = data.choices[0].message.content;
    const parsed = JSON.parse(aiText);

    executeIntent(parsed);

  } catch (e) {
    respond("I had trouble understanding that.");
  }
}

/* =======================
   EXECUTE INTENT (SAFE)
======================= */

function executeIntent(ai) {
  if (ai.intent === "NOTE") {
    memory.notes.push({ text: ai.text, time: new Date().toISOString() });
    saveMemory();
    respond("Saved as a note.");
    return;
  }

  if (ai.intent === "REMINDER" && ai.time) {
    const [hour, minute] = ai.time.split(":").map(Number);
    const time = new Date();
    time.setHours(hour, minute, 0, 0);

    memory.reminders.push({
      text: ai.text,
      time: time.toISOString(),
      triggered: false
    });

    saveMemory();
    respond(`Reminder set for ${ai.time}`);
    return;
  }

  respond("I understood you, but didn’t find an action.");
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

  const utterance = new SpeechSynthesisUtterance(message);
  const heera = voices.find(v => v.name === "Microsoft Heera - English (India)");
  if (heera) utterance.voice = heera;

  utterance.lang = "en-IN";
  utterance.rate = 0.95;
  utterance.pitch = 1.1;

  speechSynthesis.speak(utterance);
}
