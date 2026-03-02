import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import { getDatabase, ref, onValue, push, set, update, remove, get } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-database.js";

const firebaseConfig = window.TODO_FIREBASE_CONFIG;
if (!firebaseConfig) {
  throw new Error("Missing Firebase config. Create todo/config.public.js (or local todo/config.js override).");
}

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
const deleteConfirmOverlay = document.getElementById("delete-confirm-overlay");
const deleteConfirmCancelButton = document.getElementById("delete-confirm-cancel");
const deleteConfirmAcceptButton = document.getElementById("delete-confirm-accept");
const clearListOverlay = document.getElementById("clear-list-overlay");
const clearListInput = document.getElementById("clear-list-input");
const clearListCancelButton = document.getElementById("clear-list-cancel");
const clearListAcceptButton = document.getElementById("clear-list-accept");
const newListOverlay = document.getElementById("new-list-overlay");
const newListInput = document.getElementById("new-list-input");
const newListCancelButton = document.getElementById("new-list-cancel");
const newListCreateButton = document.getElementById("new-list-create");
const noticeOverlay = document.getElementById("notice-overlay");
const noticeTitle = document.getElementById("notice-title");
const noticeText = document.getElementById("notice-text");
const noticeOkButton = document.getElementById("notice-ok");

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
let deletePromptOpen = false;
let lastDeletePromptAt = 0;
let pendingDeleteTodoId = null;
let pendingDeleteTodoEl = null;
let clearListPromptOpen = false;
let newListPromptOpen = false;
let noticeOpen = false;
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
  return formatDate(today);
}

function getCurrentTime() {
  return formatTime(new Date());
}

function getCurrentUserName() {
  const name = localStorage.getItem("name");
  const trimmed = (name || "").trim();
  return trimmed || null;
}

function formatDate(dateObj) {
  const mm = String(dateObj.getMonth() + 1).padStart(2, "0");
  const dd = String(dateObj.getDate()).padStart(2, "0");
  const yy = String(dateObj.getFullYear()).slice(-2);
  return `${mm}/${dd}/${yy}`;
}

function formatTime(dateObj) {
  let hours = dateObj.getHours();
  const minutes = String(dateObj.getMinutes()).padStart(2, "0");
  const period = hours >= 12 ? "PM" : "AM";
  hours = hours % 12 || 12;
  const hoursPadded = String(hours).padStart(2, "0");
  return `${hoursPadded}:${minutes} ${period}`;
}

function formatTimestamp(dateObj) {
  return `${formatDate(dateObj)} ${formatTime(dateObj)}`;
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

function openNotice(message, title = "Notice") {
  noticeTitle.textContent = title;
  noticeText.textContent = message;
  noticeOpen = true;
  noticeOverlay.style.display = "flex";
}

function closeNotice() {
  noticeOpen = false;
  noticeOverlay.style.display = "none";
}

function openDeleteConfirm(todoId, todoEl) {
  const now = Date.now();
  if (deletePromptOpen || now - lastDeletePromptAt < 400) return;
  lastDeletePromptAt = now;
  pendingDeleteTodoId = todoId;
  pendingDeleteTodoEl = todoEl;
  deletePromptOpen = true;
  deleteConfirmOverlay.style.display = "flex";
}

function closeDeleteConfirm() {
  deletePromptOpen = false;
  pendingDeleteTodoId = null;
  pendingDeleteTodoEl = null;
  deleteConfirmOverlay.style.display = "none";
}

function acceptDeleteConfirm() {
  if (pendingDeleteTodoId) {
    if (pendingDeleteTodoEl) pendingDeleteTodoEl.remove();
    deleteTodo(pendingDeleteTodoId);
  }
  closeDeleteConfirm();
}

function syncClearListAcceptState() {
  clearListAcceptButton.disabled = clearListInput.value.trim() !== "clear-list";
}

function openClearListConfirm() {
  if (!activeListId || clearListPromptOpen) return;
  clearListPromptOpen = true;
  clearListInput.value = "";
  syncClearListAcceptState();
  clearListOverlay.style.display = "flex";
  clearListInput.focus();
}

function closeClearListConfirm() {
  clearListPromptOpen = false;
  clearListInput.value = "";
  syncClearListAcceptState();
  clearListOverlay.style.display = "none";
}

async function acceptClearListConfirm() {
  if (clearListInput.value.trim() !== "clear-list" || !activeListId) return;
  try {
    await remove(ref(db, `${itemsRoot}/${activeListId}`));
    alert("List items cleared.");
  } catch (error) {
    alert("Unable to clear this list.");
  } finally {
    closeClearListConfirm();
  }
}

function syncNewListCreateState() {
  newListCreateButton.disabled = !newListInput.value.trim();
}

function openNewListModal() {
  if (newListPromptOpen) return;
  newListPromptOpen = true;
  newListInput.value = "";
  syncNewListCreateState();
  newListOverlay.style.display = "flex";
  newListInput.focus();
}

function closeNewListModal() {
  newListPromptOpen = false;
  newListInput.value = "";
  syncNewListCreateState();
  newListOverlay.style.display = "none";
}

async function createListFromModal() {
  const listName = newListInput.value.trim();
  if (!listName) return;
  const createdListId = await createList(listName);
  if (!createdListId) return;
  listSelect.value = createdListId;
  subscribeToTodos();
  closeNewListModal();
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

newListButton.addEventListener("click", openNewListModal);
clearListButton.addEventListener("click", async () => {
  openClearListConfirm();
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
deleteConfirmCancelButton.addEventListener("click", closeDeleteConfirm);
deleteConfirmAcceptButton.addEventListener("click", acceptDeleteConfirm);
deleteConfirmOverlay.addEventListener("click", (e) => {
  if (e.target === deleteConfirmOverlay) closeDeleteConfirm();
});
clearListInput.addEventListener("input", syncClearListAcceptState);
clearListCancelButton.addEventListener("click", closeClearListConfirm);
clearListAcceptButton.addEventListener("click", acceptClearListConfirm);
clearListOverlay.addEventListener("click", (e) => {
  if (e.target === clearListOverlay) closeClearListConfirm();
});
newListInput.addEventListener("input", syncNewListCreateState);
newListInput.addEventListener("keydown", async (e) => {
  if (e.key === "Enter" && !newListCreateButton.disabled) {
    await createListFromModal();
  }
});
newListCancelButton.addEventListener("click", closeNewListModal);
newListCreateButton.addEventListener("click", createListFromModal);
newListOverlay.addEventListener("click", (e) => {
  if (e.target === newListOverlay) closeNewListModal();
});
noticeOkButton.addEventListener("click", closeNotice);
noticeOverlay.addEventListener("click", (e) => {
  if (e.target === noticeOverlay) closeNotice();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && settingsOverlay.style.display === "flex") {
    closeAdminSettings();
  }
  if (e.key === "Escape" && deleteConfirmOverlay.style.display === "flex") {
    closeDeleteConfirm();
  }
  if (e.key === "Escape" && clearListOverlay.style.display === "flex") {
    closeClearListConfirm();
  }
  if (e.key === "Escape" && newListOverlay.style.display === "flex") {
    closeNewListModal();
  }
  if (e.key === "Escape" && noticeOpen) {
    closeNotice();
  }
});

async function addTodo() {
  const text = input.value.trim();
  const createdBy = getCurrentUserName() || "Unknown";

  if (!text || !activeListId) return;

  const now = new Date();
  const createdTimestamp = formatTimestamp(now);

  const todo = {
    text,
    completed: false,
    date: formatDate(now),
    name: createdBy,
    createdBy,
    time: formatTime(now),
    createdTimestamp,
    completedTime: null,
    completedTimestamp: null,
    completedBy: null
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
  const createdBy = todo.createdBy || todo.name || "Unknown";
  const createdTimestamp = todo.createdTimestamp || [todo.date, todo.time].filter(Boolean).join(" ");
  const completedTimestamp = todo.completedTimestamp || todo.completedTime || "";
  const completedBy = todo.completedBy || "Unknown";
  nameNode.innerText = `Created by ${createdBy} - ${createdTimestamp}`;

  const completedNode = document.createElement("span");
  completedNode.classList.add("completed-time");
  completedNode.innerText = completedTimestamp ? `Completed by ${completedBy} - ${completedTimestamp}` : "";

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
  if (completedTimestamp) {
    todoEl.appendChild(completedNode);
  }
  todoEl.appendChild(editButton);

  todoEl.addEventListener("click", () => {
    const isCompleted = !todoEl.classList.contains("completed");
    const currentUserName = getCurrentUserName();
    if (isCompleted && !currentUserName) {
      alert("Please set your name before completing items.");
      overlay.style.display = "flex";
      return;
    }
    todoEl.classList.toggle("completed", isCompleted);
    checkbox.checked = isCompleted;
    const completedTimestamp = isCompleted ? formatTimestamp(new Date()) : null;
    const completedBy = isCompleted ? currentUserName : null;

    // Keep local object in sync to avoid stale follow-up writes before realtime refresh.
    todo.completed = isCompleted;
    todo.completedTimestamp = completedTimestamp;
    todo.completedTime = completedTimestamp;
    todo.completedBy = completedBy;

    updateTodo(
      todo.id,
      todo.text,
      isCompleted,
      todo.date,
      todo.name,
      todo.time,
      todo.completedTime,
      todo.createdTimestamp,
      completedTimestamp,
      todo.createdBy,
      completedBy
    );
    editButton.style.display = isCompleted ? "none" : "block";
  });

  addDeleteHandlers(todoEl, todo.id);
  todosUL.appendChild(todoEl);
}

function addDeleteHandlers(todoEl, todoId) {
  const promptDelete = () => {
    if (!allowDeletes) {
      openNotice("Delete is disabled for this dataset. Enable it in Admin Settings.");
      return;
    }
    openDeleteConfirm(todoId, todoEl);
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
  updateTodo(
    todo.id,
    newText.trim(),
    todo.completed,
    todo.date,
    todo.name,
    todo.time,
    todo.completedTime,
    todo.createdTimestamp,
    todo.completedTimestamp,
    todo.createdBy,
    todo.completedBy
  );
}

function updateTodo(
  id,
  text,
  completed,
  date,
  name,
  time,
  completedTime,
  createdTimestamp,
  completedTimestamp,
  createdBy,
  completedBy
) {
  if (!activeListId) return;
  const todoRef = ref(db, `${itemsRoot}/${activeListId}/${id}`);
  const safeCreatedBy = createdBy || name || "Unknown";
  const safeCompletedBy = completed ? (completedBy || getCurrentUserName() || safeCreatedBy) : null;
  update(todoRef, {
    text,
    completed,
    date,
    name: safeCreatedBy,
    createdBy: safeCreatedBy,
    time,
    createdTimestamp: createdTimestamp ?? [date, time].filter(Boolean).join(" "),
    completedTimestamp: completedTimestamp ?? null,
    completedTime: completedTimestamp ?? completedTime ?? null,
    completedBy: safeCompletedBy
  });
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
