import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import { getDatabase, ref, onValue, push, set, update, remove, get } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyD7bwY26c19iMTxbZncjQ2iFkKqtcveL3E",
  authDomain: "todo-8c5d9.firebaseapp.com",
  projectId: "todo-8c5d9",
  storageBucket: "todo-8c5d9.appspot.com",
  messagingSenderId: "398660721038",
  appId: "1:398660721038:web:31f0c39e339951926aecdf"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

const form = document.getElementById("form");
const input = document.getElementById("input");
const todosUL = document.getElementById("todos");
const dateDisplay = document.getElementById("date-display");
const overlay = document.getElementById("overlay");
const nameInput = document.getElementById("name");
const saveNameButton = document.getElementById("save-name");
const listSelect = document.getElementById("list-select");
const newListButton = document.getElementById("new-list-button");
const clearListButton = document.getElementById("clear-list-button");
const adminModeButton = document.getElementById("admin-mode-button");
const settingsOverlay = document.getElementById("settings-overlay");
const settingsMode = document.getElementById("settings-mode");
const settingsAllowDeletes = document.getElementById("settings-allow-deletes");
const settingsApplyButton = document.getElementById("settings-apply");
const settingsCancelButton = document.getElementById("settings-cancel");
const settingsListSelect = document.getElementById("settings-list-select");
const settingsDeleteListButton = document.getElementById("settings-delete-list");

const query = new URLSearchParams(window.location.search);
const modeParam = query.get("mode");
const isLocalHost = ["localhost", "127.0.0.1"].includes(window.location.hostname);
const isDevMode = modeParam === "dev" || (isLocalHost && modeParam !== "prod");
const deleteParamByMode = {
  dev: "allowDeletesDev",
  prod: "allowDeletesProd"
};
const currentModeKey = isDevMode ? "dev" : "prod";
const legacyAllowDeletes = query.get("allowDeletes") === "true";
const allowDeletesByMode = {
  dev: query.get(deleteParamByMode.dev) === "true",
  prod: query.get(deleteParamByMode.prod) === "true"
};
if (legacyAllowDeletes && !allowDeletesByMode[currentModeKey]) {
  allowDeletesByMode[currentModeKey] = true;
}
const allowDeletes = allowDeletesByMode[currentModeKey];
const todosRoot = isDevMode ? "todos_dev" : "todos";
const listsRoot = `${todosRoot}/lists`;
const itemsRoot = `${todosRoot}/items`;
const listStorageKey = `${todosRoot}_selectedListId`;
const legacyMigrationKey = `${todosRoot}_legacyMigrated`;
const ADMIN_PASSWORD = "ChangeThisPassword";

let activeListId = localStorage.getItem(listStorageKey);
let stopTodosListener = null;
let creatingDefaultList = false;
let listsInitialized = false;
const settingsListsByMode = {
  dev: [],
  prod: []
};

function isProtectedListName(name) {
  const normalized = String(name || "").trim().toLowerCase();
  return normalized === "general" || normalized === "general list";
}

function getModeRoots(mode) {
  const root = mode === "dev" ? "todos_dev" : "todos";
  return {
    todosRoot: root,
    listsRoot: `${root}/lists`,
    itemsRoot: `${root}/items`,
    listStorageKey: `${root}_selectedListId`
  };
}

function getTodayDate() {
  const today = new Date();
  const dd = String(today.getDate()).padStart(2, "0");
  const mm = String(today.getMonth() + 1).padStart(2, "0");
  const yyyy = today.getFullYear();
  return `${mm}-${dd}-${yyyy}`;
}

function getCurrentTime() {
  return new Date().toLocaleTimeString();
}

function displayDate() {
  const todayDate = getTodayDate();
  const envLabel = isDevMode ? "DEV DATASET" : "LIVE DATASET";
  const deleteLabel = allowDeletes ? "Deletes enabled" : "Deletes blocked";
  dateDisplay.textContent = `Today's date: ${todayDate} | ${envLabel} | ${deleteLabel}`;
}

function updateAdminButtonLabel() {
  adminModeButton.textContent = "Admin Settings";
}

async function openAdminSettings() {
  const enteredPassword = prompt("Enter admin password:");
  if (enteredPassword === null) return;

  if (enteredPassword !== ADMIN_PASSWORD) {
    alert("Incorrect password.");
    return;
  }

  settingsMode.value = isDevMode ? "dev" : "prod";
  syncSettingsDeleteCheckbox();
  await loadManagedLists(settingsMode.value);
  settingsOverlay.style.display = "flex";
}

function closeAdminSettings() {
  settingsOverlay.style.display = "none";
}

function applyAdminSettings() {
  const targetMode = settingsMode.value;
  const enableDeletes = settingsAllowDeletes.checked;
  const nextUrl = new URL(window.location.href);
  nextUrl.searchParams.set("mode", targetMode);

  // Legacy combined flag is no longer used.
  nextUrl.searchParams.delete("allowDeletes");

  const targetDeleteParam = deleteParamByMode[targetMode];
  if (enableDeletes) {
    nextUrl.searchParams.set(targetDeleteParam, "true");
  } else {
    nextUrl.searchParams.delete(targetDeleteParam);
  }

  window.location.assign(nextUrl.toString());
}

function syncSettingsDeleteCheckbox() {
  const selectedMode = settingsMode.value;
  settingsAllowDeletes.checked = allowDeletesByMode[selectedMode];
}

function updateManagedListButtons() {
  const hasList = Boolean(settingsListSelect.value);
  settingsDeleteListButton.disabled = !hasList;
}

function renderManagedLists(mode) {
  const lists = settingsListsByMode[mode];
  settingsListSelect.innerHTML = "";

  if (lists.length === 0) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = "No deletable lists";
    settingsListSelect.appendChild(option);
    settingsListSelect.value = "";
    updateManagedListButtons();
    return;
  }

  lists.forEach((list) => {
    const option = document.createElement("option");
    option.value = list.id;
    option.textContent = list.name;
    settingsListSelect.appendChild(option);
  });

  settingsListSelect.value = lists[0].id;
  updateManagedListButtons();
}

async function loadManagedLists(mode) {
  try {
    const { listsRoot } = getModeRoots(mode);
    const snapshot = await get(ref(db, listsRoot));
    const lists = snapshot.val() || {};

    settingsListsByMode[mode] = Object.entries(lists)
      .map(([id, list]) => ({ id, name: list?.name || "Untitled List" }))
      .filter((list) => !isProtectedListName(list.name))
      .sort((a, b) => a.name.localeCompare(b.name));

    renderManagedLists(mode);
  } catch (error) {
    settingsListsByMode[mode] = [];
    renderManagedLists(mode);
    alert("Unable to load lists for the selected dataset.");
  }
}

async function deleteManagedList() {
  const mode = settingsMode.value;
  const listId = settingsListSelect.value;
  if (!listId) return;

  const targetList = settingsListsByMode[mode].find((list) => list.id === listId);
  if (!targetList || isProtectedListName(targetList.name)) {
    alert("General list cannot be deleted.");
    return;
  }
  const name = targetList?.name || "this list";
  const confirmed = confirm(`Delete "${name}" and all items in it?`);
  if (!confirmed) return;

  try {
    const { listsRoot, itemsRoot, listStorageKey: modeListStorageKey } = getModeRoots(mode);
    await remove(ref(db, `${itemsRoot}/${listId}`));
    await remove(ref(db, `${listsRoot}/${listId}`));

    if (localStorage.getItem(modeListStorageKey) === listId) {
      localStorage.removeItem(modeListStorageKey);
    }

    await loadManagedLists(mode);
  } catch (error) {
    alert("Unable to delete this list.");
  }
}

function saveName() {
  const name = nameInput.value.trim();
  if (!name) return;
  localStorage.setItem("name", name);
  overlay.style.display = "none";
  initializeLists();
}

function initializeLists() {
  if (listsInitialized) return;
  listsInitialized = true;

  const listsRef = ref(db, listsRoot);
  onValue(listsRef, async (snapshot) => {
    const lists = snapshot.val() || {};
    const listIds = Object.keys(lists);

    if (listIds.length === 0 && !creatingDefaultList) {
      creatingDefaultList = true;
      await createList("General");
      creatingDefaultList = false;
      return;
    }

    if (!activeListId || !lists[activeListId]) {
      activeListId = listIds[0];
      localStorage.setItem(listStorageKey, activeListId);
    }

    await migrateLegacyTodos(activeListId);
    renderListOptions(lists);
    subscribeToTodos();
  });
}

async function migrateLegacyTodos(targetListId) {
  if (!targetListId) return;
  if (localStorage.getItem(legacyMigrationKey) === "true") return;

  const rootSnapshot = await get(ref(db, todosRoot));
  const rootData = rootSnapshot.val();
  if (!rootData || typeof rootData !== "object") {
    localStorage.setItem(legacyMigrationKey, "true");
    return;
  }

  const legacyTodos = Object.entries(rootData).filter(([key, value]) => {
    if (key === "lists" || key === "items") return false;
    return value && typeof value === "object" && typeof value.text === "string";
  });

  for (const [legacyId, legacyTodo] of legacyTodos) {
    await set(ref(db, `${itemsRoot}/${targetListId}/${legacyId}`), legacyTodo);
  }

  localStorage.setItem(legacyMigrationKey, "true");
}

function renderListOptions(lists) {
  listSelect.innerHTML = "";
  const sorted = Object.entries(lists).sort((a, b) => {
    return (a[1]?.name || "").localeCompare(b[1]?.name || "");
  });

  sorted.forEach(([id, list]) => {
    const option = document.createElement("option");
    option.value = id;
    option.textContent = list?.name || "Untitled List";
    listSelect.appendChild(option);
  });

  if (activeListId) {
    listSelect.value = activeListId;
  }
}

async function createList(name) {
  const trimmed = name.trim();
  if (!trimmed) return null;
  const newListRef = push(ref(db, listsRoot));
  await set(newListRef, {
    name: trimmed,
    createdAt: Date.now()
  });
  activeListId = newListRef.key;
  localStorage.setItem(listStorageKey, activeListId);
  return activeListId;
}

function subscribeToTodos() {
  if (!activeListId) return;
  if (stopTodosListener) {
    stopTodosListener();
  }

  const todosRef = ref(db, `${itemsRoot}/${activeListId}`);
  stopTodosListener = onValue(todosRef, (snapshot) => {
    const todos = snapshot.val() || {};
    const todoArray = Object.keys(todos).map((id) => ({
      ...todos[id],
      id
    }));
    todosUL.innerHTML = "";
    todoArray.forEach((todo) => addTodoElement(todo));
  });
}

form.addEventListener("submit", (e) => {
  e.preventDefault();
  addTodo();
});

saveNameButton.addEventListener("click", saveName);

nameInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    saveName();
  }
});

listSelect.addEventListener("change", () => {
  activeListId = listSelect.value;
  localStorage.setItem(listStorageKey, activeListId);
  subscribeToTodos();
});

newListButton.addEventListener("click", async () => {
  const listName = prompt("New list name:");
  if (!listName || !listName.trim()) return;
  await createList(listName);
});
clearListButton.addEventListener("click", async () => {
  if (!activeListId) return;
  const typed = prompt("Are you sure you want to clear all items from this list? Type clear-list");
  if (typed !== "clear-list") {
    alert("Clear cancelled.");
    return;
  }

  try {
    await remove(ref(db, `${itemsRoot}/${activeListId}`));
    alert("List items cleared.");
  } catch (error) {
    alert("Unable to clear this list.");
  }
});

adminModeButton.addEventListener("click", openAdminSettings);
settingsApplyButton.addEventListener("click", applyAdminSettings);
settingsCancelButton.addEventListener("click", closeAdminSettings);
settingsMode.addEventListener("change", async () => {
  syncSettingsDeleteCheckbox();
  await loadManagedLists(settingsMode.value);
});
settingsDeleteListButton.addEventListener("click", deleteManagedList);
settingsOverlay.addEventListener("click", (e) => {
  if (e.target === settingsOverlay) closeAdminSettings();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && settingsOverlay.style.display === "flex") {
    closeAdminSettings();
  }
});

async function addTodo() {
  const text = input.value.trim();
  const name = localStorage.getItem("name");

  if (!text || !activeListId) return;

  const todo = {
    text,
    completed: false,
    date: getTodayDate(),
    name,
    time: getCurrentTime(),
    completedTime: null
  };

  const newTodoRef = push(ref(db, `${itemsRoot}/${activeListId}`));
  await set(newTodoRef, todo);
  input.value = "";
}

function addTodoElement(todo) {
  const todoEl = document.createElement("li");
  todoEl.classList.add("todo-item");

  const textNode = document.createElement("span");
  textNode.classList.add("todo-text");

  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.checked = !!todo.completed;

  const text = document.createTextNode(todo.text);
  textNode.appendChild(checkbox);
  textNode.appendChild(text);

  const nameNode = document.createElement("span");
  nameNode.classList.add("todo-name");
  const completedText = todo.completedTime ? ` | Completed - ${todo.completedTime}` : "";
  nameNode.innerText = `${todo.name || "Unknown"} - ${todo.time || ""}${completedText}`;

  if (todo.completed) {
    todoEl.classList.add("completed");
  }

  const editButton = document.createElement("img");
  editButton.src = "./images/edit.png";
  editButton.classList.add("edit-button");
  editButton.style.display = todo.completed ? "none" : "block";
  editButton.addEventListener("click", (e) => {
    e.stopPropagation();
    editTodoItem(todo);
  });

  todoEl.appendChild(textNode);
  todoEl.appendChild(nameNode);
  todoEl.appendChild(editButton);

  todoEl.addEventListener("click", () => {
    const isCompleted = !todoEl.classList.contains("completed");
    todoEl.classList.toggle("completed", isCompleted);
    checkbox.checked = isCompleted;
    const completedTime = isCompleted ? getCurrentTime() : null;
    updateTodo(todo.id, todo.text, isCompleted, todo.date, todo.name, todo.time, completedTime);
    editButton.style.display = isCompleted ? "none" : "block";
  });

  addDeleteHandlers(todoEl, todo.id);
  todosUL.appendChild(todoEl);
}

function addDeleteHandlers(todoEl, todoId) {
  const promptDelete = () => {
    if (!allowDeletes) {
      alert("Delete is disabled for this dataset. Enable it in Admin Settings.");
      return;
    }
    if (confirm("Are you sure you want to delete this item?")) {
      todoEl.remove();
      deleteTodo(todoId);
    }
  };

  todoEl.addEventListener("contextmenu", (e) => {
    e.preventDefault();
    promptDelete();
  });

  let pressTimer = null;
  let longPressTriggered = false;

  todoEl.addEventListener("touchstart", () => {
    longPressTriggered = false;
    pressTimer = setTimeout(() => {
      longPressTriggered = true;
      promptDelete();
    }, 650);
  }, { passive: true });

  todoEl.addEventListener("touchend", () => {
    clearTimeout(pressTimer);
  });

  todoEl.addEventListener("touchmove", () => {
    clearTimeout(pressTimer);
  }, { passive: true });

  todoEl.addEventListener("touchcancel", () => {
    clearTimeout(pressTimer);
  });

  todoEl.addEventListener("click", (e) => {
    if (longPressTriggered) {
      e.preventDefault();
      e.stopPropagation();
      longPressTriggered = false;
    }
  }, true);
}

function editTodoItem(todo) {
  const newText = prompt("Edit your todo item:", todo.text);
  if (!newText || !newText.trim()) return;
  updateTodo(todo.id, newText.trim(), todo.completed, todo.date, todo.name, todo.time, todo.completedTime);
}

function updateTodo(id, text, completed, date, name, time, completedTime) {
  if (!activeListId) return;
  const todoRef = ref(db, `${itemsRoot}/${activeListId}/${id}`);
  update(todoRef, { text, completed, date, name, time, completedTime: completedTime ?? null });
}

function deleteTodo(id) {
  if (!allowDeletes || !activeListId) return;
  const todoRef = ref(db, `${itemsRoot}/${activeListId}/${id}`);
  remove(todoRef);
}

displayDate();
updateAdminButtonLabel();

if (!localStorage.getItem("name")) {
  overlay.style.display = "flex";
} else {
  overlay.style.display = "none";
  initializeLists();
}
