const PROVIDERS = {
  gemini: {
    label: "Gemini",
    models: ["gemini-1.5-flash", "gemini-1.5-pro", "gemini-2.0-flash-exp"],
    endpoint: "https://generativelanguage.googleapis.com/v1beta/models",
  },
  groq: {
    label: "Groq",
    models: ["llama-3.3-70b-versatile", "llama-3.1-8b-instant", "mixtral-8x7b-32768"],
    endpoint: "https://api.groq.com/openai/v1/chat/completions",
  },
  openai: {
    label: "OpenAI",
    models: ["gpt-4o-mini", "gpt-4.1-mini", "gpt-4o"],
    endpoint: "https://api.openai.com/v1/chat/completions",
  },
};

const STORAGE_KEYS = {
  chats: "rishikesh-bastakoti-personal-agent-chats-v1",
  user: "rishikesh-bastakoti-personal-agent-user-v1",
};

const state = {
  providerKey: "gemini",
  model: "gemini-1.5-flash",
  chats: [],
  activeChatId: null,
  user: null,
  busy: false,
};

const els = {
  sidebar: document.getElementById("sidebar"),
  historyList: document.getElementById("historyList"),
  providerSelect: document.getElementById("providerSelect"),
  modelSelect: document.getElementById("modelSelect"),
  systemPrompt: document.getElementById("systemPrompt"),
  temperature: document.getElementById("temperature"),
  tempValue: document.getElementById("tempValue"),
  newChatBtn: document.getElementById("newChatBtn"),
  toggleSidebarBtn: document.getElementById("toggleSidebarBtn"),
  mobileSidebarBtn: document.getElementById("mobileSidebarBtn"),
  statusPill: document.getElementById("statusPill"),
  chatMessages: document.getElementById("chatMessages"),
  chatForm: document.getElementById("chatForm"),
  messageInput: document.getElementById("messageInput"),
  signInBtn: document.getElementById("signInBtn"),
  userPanel: document.getElementById("userPanel"),
  userName: document.getElementById("userName"),
  signOutBtn: document.getElementById("signOutBtn"),
  authModal: document.getElementById("authModal"),
  signInForm: document.getElementById("signInForm"),
  cancelSignInBtn: document.getElementById("cancelSignInBtn"),
  nameInput: document.getElementById("nameInput"),
  emailInput: document.getElementById("emailInput"),
};

function init() {
  hydrateState();
  setupProviderOptions();
  setupEvents();
  renderAuthUI();
  ensureActiveChat();
  renderHistory();
  renderMessages();
}

function setupProviderOptions() {
  const providerKeys = Object.keys(PROVIDERS);
  els.providerSelect.innerHTML = providerKeys
    .map((key) => `<option value="${key}">${PROVIDERS[key].label}</option>`)
    .join("");
  els.providerSelect.value = state.providerKey;
  renderModelOptions();
}

function renderModelOptions() {
  const provider = PROVIDERS[state.providerKey];
  els.modelSelect.innerHTML = provider.models
    .map((model) => `<option value="${model}">${model}</option>`)
    .join("");

  if (!provider.models.includes(state.model)) {
    state.model = provider.models[0];
  }
  els.modelSelect.value = state.model;
}

function setupEvents() {
  els.providerSelect.addEventListener("change", (event) => {
    state.providerKey = event.target.value;
    renderModelOptions();
  });

  els.modelSelect.addEventListener("change", (event) => {
    state.model = event.target.value;
  });

  els.temperature.addEventListener("input", (event) => {
    els.tempValue.textContent = Number(event.target.value).toFixed(1);
  });

  els.newChatBtn.addEventListener("click", () => {
    createNewChat();
    closeSidebarOnMobile();
  });

  els.chatForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (state.busy) return;

    const content = els.messageInput.value.trim();
    if (!content) return;

    els.messageInput.value = "";
    pushMessage("user", content);
    getActiveChat().messages.push({ role: "user", content });
    touchActiveChatTitle(content);
    persistChats();
    renderHistory();

    setBusy(true);
    try {
      const reply = await requestAssistantResponse({
        providerKey: state.providerKey,
        model: state.model,
        systemPrompt: els.systemPrompt.value.trim(),
        temperature: Number(els.temperature.value),
        messages: getActiveChat().messages,
      });

      pushMessage("assistant", reply);
      getActiveChat().messages.push({ role: "assistant", content: reply });
      persistChats();
    } catch (error) {
      pushMessage(
        "assistant",
        `Error: ${error.message || "Something went wrong while generating response."}`
      );
    } finally {
      setBusy(false);
    }
  });

  els.toggleSidebarBtn.addEventListener("click", () => {
    els.sidebar.classList.toggle("collapsed");
  });

  els.mobileSidebarBtn.addEventListener("click", () => {
    els.sidebar.classList.toggle("mobile-open");
  });

  els.signInBtn.addEventListener("click", openSignInModal);
  els.cancelSignInBtn.addEventListener("click", closeSignInModal);
  els.signOutBtn.addEventListener("click", signOut);

  els.signInForm.addEventListener("submit", (event) => {
    event.preventDefault();
    signIn({
      name: els.nameInput.value.trim(),
      email: els.emailInput.value.trim(),
    });
  });

  els.authModal.addEventListener("click", (event) => {
    if (event.target === els.authModal) {
      closeSignInModal();
    }
  });
}

function hydrateState() {
  try {
    const chatsRaw = localStorage.getItem(STORAGE_KEYS.chats);
    const userRaw = localStorage.getItem(STORAGE_KEYS.user);
    state.chats = chatsRaw ? JSON.parse(chatsRaw) : [];
    state.user = userRaw ? JSON.parse(userRaw) : null;
  } catch {
    state.chats = [];
    state.user = null;
  }
}

function ensureActiveChat() {
  if (state.chats.length === 0) {
    createNewChat();
    return;
  }
  state.activeChatId = state.chats[0].id;
}

function createNewChat() {
  const newChat = {
    id: crypto.randomUUID(),
    title: "New chat",
    createdAt: Date.now(),
    messages: [
      {
        role: "assistant",
        content:
          "Hello! This is Rishikesh Bastakoti Personal Agent. Choose provider/model and start chatting.",
      },
    ],
  };
  state.chats.unshift(newChat);
  state.activeChatId = newChat.id;
  persistChats();
  renderHistory();
  renderMessages();
}

function getActiveChat() {
  return state.chats.find((chat) => chat.id === state.activeChatId);
}

function touchActiveChatTitle(firstUserMessage) {
  const chat = getActiveChat();
  if (!chat) return;
  if (chat.title === "New chat") {
    chat.title = firstUserMessage.slice(0, 36) || "New chat";
  }
}

function persistChats() {
  localStorage.setItem(STORAGE_KEYS.chats, JSON.stringify(state.chats));
}

function renderHistory() {
  if (!state.chats.length) {
    els.historyList.innerHTML = "<li class='history-item'>No chats yet</li>";
    return;
  }

  els.historyList.innerHTML = state.chats
    .map((chat) => {
      const activeClass = chat.id === state.activeChatId ? "active" : "";
      return `<li class="history-item ${activeClass}" data-chat-id="${chat.id}">${escapeHtml(
        chat.title
      )}</li>`;
    })
    .join("");

  els.historyList.querySelectorAll(".history-item").forEach((item) => {
    item.addEventListener("click", () => {
      const chatId = item.getAttribute("data-chat-id");
      if (!chatId) return;
      state.activeChatId = chatId;
      renderHistory();
      renderMessages();
      closeSidebarOnMobile();
    });
  });
}

function renderMessages() {
  const chat = getActiveChat();
  els.chatMessages.innerHTML = "";
  if (!chat) return;
  chat.messages.forEach((message) => pushMessage(message.role, message.content));
}

function renderAuthUI() {
  if (state.user) {
    els.signInBtn.classList.add("hidden");
    els.userPanel.classList.remove("hidden");
    els.userName.textContent = `${state.user.name} (${state.user.email})`;
  } else {
    els.signInBtn.classList.remove("hidden");
    els.userPanel.classList.add("hidden");
    els.userName.textContent = "";
  }
}

function openSignInModal() {
  els.authModal.classList.remove("hidden");
}

function closeSignInModal() {
  els.authModal.classList.add("hidden");
  els.signInForm.reset();
}

function signIn(user) {
  if (!user.name || !user.email) return;
  state.user = user;
  localStorage.setItem(STORAGE_KEYS.user, JSON.stringify(user));
  renderAuthUI();
  closeSignInModal();
}

function signOut() {
  state.user = null;
  localStorage.removeItem(STORAGE_KEYS.user);
  renderAuthUI();
}

function closeSidebarOnMobile() {
  if (window.innerWidth <= 880) {
    els.sidebar.classList.remove("mobile-open");
  }
}

function setBusy(isBusy) {
  state.busy = isBusy;
  els.statusPill.className = `status ${isBusy ? "busy" : "ready"}`;
  els.statusPill.textContent = isBusy ? "Thinking..." : "Ready";
}

function pushMessage(role, text) {
  const article = document.createElement("article");
  article.className = `message ${role}`;
  article.innerHTML = `<p>${escapeHtml(text)}</p>`;
  els.chatMessages.appendChild(article);
  els.chatMessages.scrollTop = els.chatMessages.scrollHeight;
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

async function requestAssistantResponse(payload) {
  // Frontend-only placeholder adapter.
  // Later you can replace this with a backend call:
  // return fetch("/api/chat", { method: "POST", body: JSON.stringify(payload) })
  // and handle provider keys server-side for security.
  await wait(700);
  const provider = PROVIDERS[payload.providerKey];
  const lastUserText = payload.messages[payload.messages.length - 1]?.content || "";

  return [
    `Mock response from ${provider.label} (${payload.model})`,
    "",
    `You said: "${lastUserText}"`,
    "",
    "Frontend is ready with history and auth UI. Next step: connect secure APIs.",
  ].join("\n");
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

init();
