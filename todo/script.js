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

// Function to get today's date in MM-DD-YYYY format
function getTodayDate() {
  const today = new Date();
  const dd = String(today.getDate()).padStart(2, '0');
  const mm = String(today.getMonth() + 1).padStart(2, '0'); // January is 0
  const yyyy = today.getFullYear();
  return `${mm}-${dd}-${yyyy}`;
}

// Display today's date
function displayDate() {
  const todayDate = getTodayDate();
  dateDisplay.innerHTML = `Today's date: ${todayDate} <br> (List is deleted daily)`;
}

// Function to read todos from Firebase
function loadTodos() {
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
      if (todoArray.length > 0 && todoArray[0].date !== getTodayDate()) {
        deleteAllTodos();
      } else {
        todoArray.forEach(todo => {
          addTodo(todo);
        });
      }
    }
  });
}

// Load todos on startup
loadTodos();

form.addEventListener("submit", (e) => {
  e.preventDefault();
  addTodo();
});

function addTodo(todo = { text: input.value, completed: false, date: getTodayDate() }) {
  if (todo.text) {
    const todoEl = document.createElement("li");
    todoEl.classList.add("todo-item");

    const textNode = document.createElement("span");

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = todo.completed;

    const text = document.createTextNode(todo.text);
    textNode.appendChild(checkbox);
    textNode.appendChild(text);

    if (todo.completed) {
      todoEl.classList.add("completed");
    }

    todoEl.appendChild(textNode);

    todoEl.addEventListener("click", () => {
      const isCompleted = !todoEl.classList.contains("completed");
      todoEl.classList.toggle("completed", isCompleted);
      checkbox.checked = isCompleted;
      updateTodo(todo.id, textNode.innerText, isCompleted, todo.date);
    });

    todoEl.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      if (confirm("Are you sure you want to delete this item?")) {
        todoEl.remove();
        deleteTodo(todo.id);
      }
    });

    todosUL.appendChild(todoEl);

    if (!todo.id) {
      const newTodoRef = push(ref(db, 'todos'));
      todo.id = newTodoRef.key;
      set(newTodoRef, todo);
    } else {
      updateTodo(todo.id, todo.text, todo.completed, todo.date);
    }

    input.value = '';
  }
}

function updateTodo(id, text, completed, date) {
  const todoRef = ref(db, `todos/${id}`);
  update(todoRef, { text, completed, date });
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
