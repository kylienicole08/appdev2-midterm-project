const http = require('http');
const fs = require('fs');
const url = require('url');
const { EventEmitter } = require('events');

const PORT = 3000;
const todosFile = 'todos.json';
const logsFile = 'logs.txt';

const logger = new EventEmitter();


logger.on('log', (message) => {
  const time = new Date().toISOString();
  fs.appendFile(logsFile, `${time} - ${message}\n`, (err) => {
    if (err) console.error('Logging error:', err);
  });
});

// Read
function readTodos(callback) {
  fs.readFile(todosFile, 'utf8', (err, data) => {
    if (err) return callback([]);
    try {
      const todos = JSON.parse(data);
      callback(todos);
    } catch {
      callback([]);
    }
  });
}


function writeTodos(todos, callback) {
  fs.writeFile(todosFile, JSON.stringify(todos, null, 2), (err) => {
    if (err) return callback(err);
    callback(null);
  });
}

const server = http.createServer((req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const { pathname } = parsedUrl;

  
  logger.emit('log', `${req.method} ${pathname}`);

  // GET
  if (req.method === 'GET' && pathname === '/todos') {
    readTodos((todos) => {
      const { completed } = parsedUrl.query;
      if (completed !== undefined) {
        const isDone = completed === 'true';
        todos = todos.filter(todo => todo.completed === isDone);
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(todos));
    });
  }

  
  else if (req.method === 'GET' && pathname.startsWith('/todos/')) {
    const id = parseInt(pathname.split('/')[2]);
    readTodos((todos) => {
      const todo = todos.find(t => t.id === id);
      if (todo) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(todo));
      } else {
        res.writeHead(404);
        res.end('Todo not found');
      }
    });
  }

  // POST
  else if (req.method === 'POST' && pathname === '/todos') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const newTodo = JSON.parse(body);
        if (!newTodo.title) {
          res.writeHead(400);
          return res.end('Missing title');
        }
        readTodos((todos) => {
          newTodo.id = todos.length ? Math.max(...todos.map(t => t.id)) + 1 : 1;
          newTodo.completed = newTodo.completed ?? false;
          todos.push(newTodo);
          writeTodos(todos, (err) => {
            if (err) {
              res.writeHead(500);
              return res.end('Error saving todo');
            }
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(newTodo));
          });
        });
      } catch {
        res.writeHead(400);
        res.end('Invalid JSON');
      }
    });
  }

  // PUT
  else if (req.method === 'PUT' && pathname.startsWith('/todos/')) {
    const id = parseInt(pathname.split('/')[2]);
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const updateData = JSON.parse(body);
        readTodos((todos) => {
          const index = todos.findIndex(t => t.id === id);
          if (index === -1) {
            res.writeHead(404);
            return res.end('Todo not found');
          }
          todos[index] = { ...todos[index], ...updateData };
          writeTodos(todos, (err) => {
            if (err) {
              res.writeHead(500);
              return res.end('Error updating todo');
            }
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(todos[index]));
          });
        });
      } catch {
        res.writeHead(400);
        res.end('Invalid JSON');
      }
    });
  }

  // DELETE
  else if (req.method === 'DELETE' && pathname.startsWith('/todos/')) {
    const id = parseInt(pathname.split('/')[2]);
    readTodos((todos) => {
      const index = todos.findIndex(t => t.id === id);
      if (index === -1) {
        res.writeHead(404);
        return res.end('Todo not found');
      }
      todos.splice(index, 1);
      writeTodos(todos, (err) => {
        if (err) {
          res.writeHead(500);
          return res.end('Error deleting todo');
        }
        res.writeHead(200);
        res.end('Todo deleted');
      });
    });
  }

  // Not Found
  else {
    res.writeHead(404);
    res.end('Route not found');
  }
});

server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
