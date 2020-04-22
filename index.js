require("dotenv").config();
const path = require("path");
const express = require("express");
const http = require("http");
const cors = require("cors");
const socketio = require("socket.io");
const app = express();
const server = http.createServer(app);
const io = socketio(server);
const PORT = process.env.PORT || "3001";

app.use(cors());

// Serve static files
app.use("/static", express.static(path.join(__dirname, "public")));

// Routes
app.use("/api", require("./routes/api"));
app.use("/", require("./routes/index"));

class User {
  constructor(id, name) {
    this.id = id;
    this.name = name || `anonymous`;
  }
}

let state = {
  get numUsers() {
    return this.users.length;
  },
  users: [],
};

io.on("connection", (socket) => {
  let isUserAdded = false;

  console.log(`[EVENT: connection]: ${socket.id}`);

  socket.on("add user", ({ name }) => {
    if (isUserAdded) {
      return;
    }

    console.log("[add user]");

    state.users = [...state.users, new User(socket.id, name)];

    isUserAdded = true;

    console.log(state.users);

    // Send data to the new user.
    socket.emit("user login", {
      numUsers: state.numUsers,
      users: state.users,
      user: state.users.filter(({ id }) => id === socket.id)[0],
    });

    // Send data to all clients expect the current one.
    socket.broadcast.emit("user joined", {
      numUsers: state.numUsers,
      users: state.users,
      user: state.users.filter(({ id }) => id === socket.id)[0],
    });
  });

  socket.on("sound", (data) => {
    console.log("[EVENT: sound]", data.sound.name);
    socket.broadcast.emit("sound", { sound: data.sound, user: data.user });
  });

  // Listen for events FROM the client.
  // socket.on("new user", () => {});
  // socket.on("update user", () => {});
  // socket.on("play sound", () => {});

  socket.on("update user", (data) => {
    if (
      !data.username ||
      data.username.length <= 0 ||
      data.username.length > 46 ||
      typeof data.username !== "string"
    ) {
      return;
    }
    state.users = state.users.filter((user) => {
      if (user.id === data.id) {
        user.name = data.username;
      }
      return true;
    });
    console.log(
      "[update user]",
      state.users.filter(({ id }) => id === data.id)
    );
    socket.broadcast.emit("users updated", {
      users: state.users,
    });
    socket.emit("user updated", {
      user: state.users.filter(({ id }) => id === socket.id)[0],
    });
    // socket.broadcast.emit("user updated", {
    //   users: state.users,
    //   user: state.users.filter(({ id }) => id === socket.id)[0],
    // });
  });

  socket.on("disconnect", () => {
    console.log(`[EVENT: disconnect]: ${socket.id}`);
    const filteredUsers = state.users.filter(({ id }) => id !== socket.id);

    userLeft = state.users.filter(({ id }) => id === socket.id)[0];
    state.users = filteredUsers;

    console.log(state.users);

    socket.broadcast.emit("user left", {
      numUsers: state.numUsers,
      users: state.users,
      user: userLeft,
    });
  });
});

// Run server and listen on port: `PORT`
server.listen(PORT, () => {
  console.log(`listening on *:${PORT}`);
});
