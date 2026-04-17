const PROVIDERS = {
  gemini: {
    label: "Gemini",
    models: ["gemini-1.5-flash-latest", "gemini-1.5-pro-latest", "gemini-2.0-flash"],
    endpoint: "https://generativelanguage.googleapis.com/v1beta/models",
  },
  groq: {
    label: "Groq",
    models: ["llama-3.3-70b-versatile", "llama-3.1-8b-instant", "mixtral-8x7b-32768"],
    endpoint: "https://api.groq.com/openai/v1/chat/completions",
  },
};

const STORAGE_KEYS = {
  chats: "rishikesh-bastakoti-personal-agent-chats-v1",
};

const state = {
  providerKey: "gemini",
  model: "gemini-1.5-flash-latest",
  chats: [],
  activeChatId: null,
  user: null,
  accessToken: null,
  busy: false,
  tasks: [],
  memory: {},
  cloudSyncTimer: null,
  authMode: "signin",
  authClient: null,
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
  emailInput: document.getElementById("emailInput"),
  passwordInput: document.getElementById("passwordInput"),
  authTitle: document.getElementById("authTitle"),
  authSubtitle: document.getElementById("authSubtitle"),
  authSubmitBtn: document.getElementById("authSubmitBtn"),
  toggleAuthModeBtn: document.getElementById("toggleAuthModeBtn"),
};

async function init() {
  try {
    hydrateState();
    setupProviderOptions();
    setupEvents();
    await initAuth();
    ensureActiveChat();
    renderAuthUI();
    renderHistory();
    renderMessages();
  } catch (error) {
    els.chatMessages.innerHTML = "";
    pushMessage("assistant", `Startup error: ${error?.message || "Unexpected error"}`);
  }
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

    const activeChat = getActiveChat();
    if (!activeChat) return;

    els.messageInput.value = "";
    pushMessage("user", content);
    activeChat.messages.push({ role: "user", content });
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
        messages: activeChat.messages,
      });
      pushMessage("assistant", reply);
      activeChat.messages.push({ role: "assistant", content: reply });
      persistChats();
    } catch (error) {
      pushMessage(
        "assistant",
        `Error: ${error?.message || "Something went wrong while generating response."}`
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
  els.signOutBtn.addEventListener("click", async () => {
    await signOut();
  });

  els.toggleAuthModeBtn.addEventListener("click", () => {
    toggleAuthMode();
  });

  els.signInForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    await submitAuthForm();
  });

  els.authModal.addEventListener("click", (event) => {
    if (event.target === els.authModal) closeSignInModal();
  });
}

function hydrateState() {
  try {
    const chatsRaw = localStorage.getItem(STORAGE_KEYS.chats);
    state.chats = normalizeChats(chatsRaw ? JSON.parse(chatsRaw) : []);
  } catch {
    state.chats = [];
  }
}

function ensureActiveChat() {
  if (state.chats.length === 0) {
    createNewChat();
    return;
  }
  state.activeChatId = state.chats[0].id;
  const activeChat = getActiveChat();
  if (!activeChat || !Array.isArray(activeChat.messages) || activeChat.messages.length === 0) {
    createNewChat();
  }
}

function createNewChat() {
  const newChat = {
    id: createId(),
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

function normalizeChats(input) {
  if (!Array.isArray(input)) return [];
  return input
    .filter((chat) => chat && typeof chat.id === "string")
    .map((chat) => ({
      id: chat.id,
      title: typeof chat.title === "string" ? chat.title : "New chat",
      createdAt: Number(chat.createdAt) || Date.now(),
      messages: Array.isArray(chat.messages)
        ? chat.messages.filter(
            (msg) => msg && typeof msg.role === "string" && typeof msg.content === "string"
          )
        : [],
    }));
}

function createId() {
  if (globalThis.crypto && typeof globalThis.crypto.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }
  return `chat-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
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
  queueCloudSync();
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
  renderAuthMode();
  els.authModal.classList.remove("hidden");
}

function closeSignInModal() {
  els.authModal.classList.add("hidden");
  els.signInForm.reset();
}

function toggleAuthMode() {
  state.authMode = state.authMode === "signin" ? "signup" : "signin";
  renderAuthMode();
}

function renderAuthMode() {
  if (state.authMode === "signin") {
    els.authTitle.textContent = "Sign in";
    els.authSubtitle.textContent = "Use your account to sync data across devices.";
    els.authSubmitBtn.textContent = "Sign in";
    els.toggleAuthModeBtn.textContent = "Create account";
  } else {
    els.authTitle.textContent = "Create account";
    els.authSubtitle.textContent = "Create an account with email and password.";
    els.authSubmitBtn.textContent = "Create";
    els.toggleAuthModeBtn.textContent = "Back to sign in";
  }
}

async function submitAuthForm() {
  if (!state.authClient) {
    pushMessage("assistant", "Auth is not configured. Check Supabase env values in Vercel.");
    return;
  }

  const email = els.emailInput.value.trim().toLowerCase();
  const password = els.passwordInput.value;
  if (!email || !password) return;

  let result;
  if (state.authMode === "signin") {
    result = await state.authClient.auth.signInWithPassword({ email, password });
  } else {
    result = await state.authClient.auth.signUp({ email, password });
  }

  if (result.error) {
    pushMessage("assistant", `Auth error: ${result.error.message}`);
    return;
  }

  if (state.authMode === "signup" && !result.data?.session) {
    pushMessage("assistant", "Account created. Verify email if prompted, then sign in.");
    state.authMode = "signin";
    renderAuthMode();
    return;
  }

  await applySession(result.data?.session || null);
  renderAuthUI();
  closeSignInModal();
  renderHistory();
  renderMessages();
}

async function signOut() {
  if (state.authClient) {
    await state.authClient.auth.signOut();
  }
  state.user = null;
  state.accessToken = null;
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
  if (window.location.protocol === "file:") {
    return buildLocalMockReply(payload);
  }

  let response;
  try {
    response = await fetch("/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(state.accessToken ? { Authorization: `Bearer ${state.accessToken}` } : {}),
      },
      body: JSON.stringify(payload),
    });
  } catch {
    return buildLocalMockReply(payload);
  }

  let data = {};
  try {
    data = await response.json();
  } catch {
    data = {};
  }

  if (!response.ok) {
    throw new Error(data?.error || `API request failed with status ${response.status}`);
  }

  return data?.text || "No response returned.";
}

function buildLocalMockReply(payload) {
  const provider = PROVIDERS[payload.providerKey]?.label || payload.providerKey;
  const lastUserText = payload.messages[payload.messages.length - 1]?.content || "";
  return [
    `Local mode reply (${provider} / ${payload.model})`,
    "",
    `You said: "${lastUserText}"`,
    "",
    "Local UI is working. For real AI replies, run from deployed app or API server.",
  ].join("\n");
}

async function initAuth() {
  const response = await fetch("/api/public-config");
  if (!response.ok) return;
  const config = await response.json();
  if (!config?.supabaseUrl || !config?.supabaseAnonKey || !window.supabase?.createClient) return;

  state.authClient = window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey);

  const sessionData = await state.authClient.auth.getSession();
  await applySession(sessionData?.data?.session || null);

  state.authClient.auth.onAuthStateChange(async (_event, session) => {
    await applySession(session || null);
    renderAuthUI();
    renderHistory();
    renderMessages();
  });
}

async function applySession(session) {
  if (!session?.user?.email) {
    state.user = null;
    state.accessToken = null;
    return;
  }

  const email = session.user.email.toLowerCase();
  const name = (session.user.user_metadata?.full_name || email.split("@")[0]).trim();
  state.user = { email, name };
  state.accessToken = session.access_token || null;
  await loadCloudState();
}

async function loadCloudState() {
  if (!state.user?.email || !state.accessToken) return;
  try {
    const response = await fetch("/api/state", {
      headers: {
        Authorization: `Bearer ${state.accessToken}`,
      },
    });
    if (!response.ok) return;

    const data = await response.json();
    const remote = data?.state?.state_json;
    if (!remote || typeof remote !== "object") return;

    const remoteChats = normalizeChats(remote.chats);
    if (remoteChats.length) {
      state.chats = remoteChats;
      state.activeChatId = remoteChats[0].id;
      localStorage.setItem(STORAGE_KEYS.chats, JSON.stringify(state.chats));
    }
    state.tasks = Array.isArray(remote.tasks) ? remote.tasks : [];
    state.memory = remote.memory && typeof remote.memory === "object" ? remote.memory : {};
  } catch {
    return;
  }
}

function queueCloudSync() {
  if (!state.user?.email || !state.accessToken) return;
  if (state.cloudSyncTimer) clearTimeout(state.cloudSyncTimer);
  state.cloudSyncTimer = setTimeout(() => {
    syncCloudState();
  }, 500);
}

async function syncCloudState() {
  if (!state.user?.email || !state.accessToken) return;
  try {
    await fetch("/api/state", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${state.accessToken}`,
      },
      body: JSON.stringify({
        name: state.user.name,
        chats: state.chats,
        tasks: state.tasks,
        memory: state.memory,
      }),
    });
  } catch {
    return;
  }
}

init();
