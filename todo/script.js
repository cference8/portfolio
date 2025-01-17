import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import { getDatabase, ref, onValue, push, set, update, remove } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-database.js";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyD7bwY26c19iMTxbZncjQ2iFkKqtcveL3E",
  authDomain: "todo-8c5d9.firebaseapp.com",
  projectId: "todo-8c5d9",
  storageBucket: "todo-8c5d9.appspot.com",
  messagingSenderId: "398660721038",
  appId: "1:398660721038:web:31f0c39e339951926aecdf"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

const form = document.getElementById("form");
const input = document.getElementById("input");
const todosUL = document.getElementById("todos");
const dateDisplay = document.getElementById("date-display");
const overlay = document.getElementById("overlay");
const nameInputDiv = document.getElementById("name-input");
const nameInput = document.getElementById("name");
const saveNameButton = document.getElementById("save-name");

// Function to get today's date in MM-DD-YYYY format
function getTodayDate() {
  const today = new Date();
  const dd = String(today.getDate()).padStart(2, '0');
  const mm = String(today.getMonth() + 1).padStart(2, '0'); // January is 0
  const yyyy = today.getFullYear();
  return `${mm}-${dd}-${yyyy}`;
}

// Function to get the current time using .toLocaleTimeString()
function getCurrentTime() {
  const now = new Date();
  return now.toLocaleTimeString();
}

// Display today's date
function displayDate() {
  const todayDate = getTodayDate();
  dateDisplay.innerHTML = `Today's date: ${todayDate}`;
}

// Save the name to local storage
function saveName() {
  const name = nameInput.value.trim();
  if (name) {
    localStorage.setItem('name', name);
    overlay.style.display = 'none';
    loadTodos();
  }
}

// Function to read todos from Firebase
function loadTodos() {
  const name = localStorage.getItem('name');
  if (!name) {
    overlay.style.display = 'flex';
    return;
  } else {
    overlay.style.display = 'none';
  }

  const todosRef = ref(db, 'todos');
  onValue(todosRef, (snapshot) => {
    const todos = snapshot.val();
    todosUL.innerHTML = '';
    if (todos) {
      const todoArray = Object.keys(todos).map(key => ({
        ...todos[key],
        id: key
      }));

      // Check if the first todo's date is not today, then delete all todos
      // if (todoArray.length > 0 && todoArray[0].date !== getTodayDate()) {
      //   deleteAllTodos();
      // } else {
      //   todoArray.forEach(todo => {
      //     addTodoElement(todo);
      //   });
      // }
      // Display todos without deleting
      todoArray.forEach(todo => {
        addTodoElement(todo);
      });
    }
  });
}

// Load todos on startup
loadTodos();

form.addEventListener("submit", (e) => {
  e.preventDefault();
  addTodo();
});

saveNameButton.addEventListener('click', saveName);

nameInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    saveName();
  }
});

async function addTodo() {
  const text = input.value;
  const completed = false;
  const date = getTodayDate();
  const name = localStorage.getItem('name');
  const time = getCurrentTime();

  if (text) {
    const newTodoRef = push(ref(db, 'todos'));
    const todo = { text, completed, date, name, time, completedTime: null };
    await set(newTodoRef, todo);

    input.value = '';
    loadTodos();
  }
}

function addTodoElement(todo) {
  const todoEl = document.createElement("li");
  todoEl.classList.add("todo-item");

  const textNode = document.createElement("span");

  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.checked = todo.completed;

  const text = document.createTextNode(todo.text);
  textNode.appendChild(checkbox);
  textNode.appendChild(text);

  const nameNode = document.createElement("span");
  nameNode.classList.add("todo-name");
  const completedText = todo.completedTime ? ` | Completed - ${todo.completedTime}` : '';
  nameNode.innerText = `${todo.name} - ${todo.time}${completedText}`;

  if (todo.completed) {
    todoEl.classList.add("completed");
  }

  const editButton = document.createElement("img");
  editButton.src = "./images/edit.png";
  editButton.classList.add("edit-button");
  if (todo.completed) {
    editButton.style.display = "none";
  }
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

  todoEl.addEventListener("contextmenu", (e) => {
    e.preventDefault();
    if (confirm("Are you sure you want to delete this item?")) {
      todoEl.remove();
      deleteTodo(todo.id);
    }
  });

  todosUL.appendChild(todoEl);
}

function editTodoItem(todo) {
  const newText = prompt("Edit your todo item:", todo.text);
  if (newText !== null && newText.trim() !== "") {
    updateTodo(todo.id, newText, todo.completed, todo.date, todo.name, todo.time, todo.completedTime);
    loadTodos();
  }
}

function updateTodo(id, text, completed, date, name, time, completedTime) {
  const todoRef = ref(db, `todos/${id}`);
  update(todoRef, { text, completed, date, name, time, completedTime: completedTime ?? null });
}

function deleteTodo(id) {
  const todoRef = ref(db, `todos/${id}`);
  remove(todoRef);
}

function deleteAllTodos() {
  const todosRef = ref(db, 'todos');
  remove(todosRef);
}

// Display the date on page load
displayDate();
