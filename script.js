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
   VOICES
======================= */

let voices = [];
window.speechSynthesis.onvoiceschanged = () => {
  voices = window.speechSynthesis.getVoices();
};

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

let recognition;
let listening = false;

if (SpeechRecognition) {
  recognition = new SpeechRecognition();
  recognition.lang = "en-IN";
  recognition.continuous = false;
  recognition.interimResults = false;

  micBtn.onclick = () => {
    if (listening) return;

    listening = true;
    micBtn.classList.add("listening");
    micBtn.classList.add("disabled");
    addSystemMessage("Listening...");
    recognition.start();
  };

  recognition.onresult = (event) => {
    const text = event.results[0][0].transcript.toLowerCase();
    addMessage(text, "user");
    addSystemMessage("Thinking...");
    handleCommand(text);
  };

  recognition.onend = () => {
    listening = false;
    micBtn.classList.remove("listening");
    micBtn.classList.remove("disabled");
  };
}

/* =======================
   THINKING
======================= */

function think(text) {
  if (text.includes("tired")) {
    return "You sound tired. Should I keep tomorrow lighter?";
  }
  return null;
}

/* =======================
   COMMAND HANDLER
======================= */

function handleCommand(text) {

  const thought = think(text);
  if (thought) {
    respond(thought);
    return;
  }

  if (text.startsWith("note")) {
    const note = text.replace("note", "").trim();
    memory.notes.push({ text: note, time: new Date().toISOString() });
    saveMemory();
    respond("Note saved.");
    return;
  }

  if (text.startsWith("remind me")) {
    const match = text.match(/at (\d{1,2})(?::(\d{1,2}))?\s?(am|pm)?/);
    if (!match) {
      respond("Please say a time.");
      return;
    }

    let hour = parseInt(match[1]);
    let minute = match[2] ? parseInt(match[2]) : 0;
    const period = match[3];

    if (period === "pm" && hour < 12) hour += 12;
    if (period === "am" && hour === 12) hour = 0;

    const reminderText = text
      .replace(match[0], "")
      .replace("remind me", "")
      .trim();

    const reminderTime = new Date();
    reminderTime.setHours(hour, minute, 0, 0);

    memory.reminders.push({
      text: reminderText,
      time: reminderTime.toISOString(),
      triggered: false
    });

    saveMemory();
    respond(`I will remind you at ${hour}:${minute.toString().padStart(2, "0")}`);
    return;
  }

  respond("I didn’t understand that.");
}

/* =======================
   REMINDERS
======================= */

setInterval(() => {
  const now = new Date();

  memory.reminders.forEach((r) => {
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
