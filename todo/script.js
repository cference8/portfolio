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

// Function to read todos from Firebase
function loadTodos() {
  const todosRef = ref(db, 'todos');
  onValue(todosRef, (snapshot) => {
    const todos = snapshot.val();
    todosUL.innerHTML = '';
    if (todos) {
      Object.keys(todos).forEach(key => {
        addTodo({
          text: todos[key].text,
          completed: todos[key].completed,
          id: key
        });
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

function addTodo(todo = { text: input.value, completed: false }) {
  if (todo.text) {
    const todoEl = document.createElement("li");
    todoEl.classList.add("todo-item");

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = todo.completed;

    const textNode = document.createElement("span");
    textNode.innerText = todo.text;

    if (todo.completed) {
      todoEl.classList.add("completed");
    }

    todoEl.appendChild(checkbox);
    todoEl.appendChild(textNode);

    todoEl.addEventListener("click", () => {
      const isCompleted = !todoEl.classList.contains("completed");
      todoEl.classList.toggle("completed", isCompleted);
      checkbox.checked = isCompleted;
      updateTodo(todo.id, textNode.innerText, isCompleted);
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
      updateTodo(todo.id, todo.text, todo.completed);
    }

    input.value = '';
  }
}

function updateTodo(id, text, completed) {
  const todoRef = ref(db, `todos/${id}`);
  update(todoRef, { text, completed });
}

function deleteTodo(id) {
  const todoRef = ref(db, `todos/${id}`);
  remove(todoRef);
}
