const express = require('express');
const path = require('path');
const http = require('http');
const socketio = require('socket.io');
const uuid = require('uuid');

const app = express();
const server = http.createServer(app);
const io = socketio(server);

app.use(express.static(path.join(__dirname, 'public')));

// Status constants
const STATUS_REJECTED = 'STATUS_REJECTED';
const STATUS_ACCEPETED = 'STATUS_ACCEPETED';

// Client side events
const CLIENT_EVENT_USERNAME = 'CLIENT_EVENT_USERNAME';
const CLIENT_EVENT_DIRECT_MESSAGE = 'CLIENT_EVENT_DIRECT_MESSAGE';
const CLIENT_EVENT_ADD_ROOM = 'CLIENT_EVENT_ADD_ROOM';
const CLIENT_EVENT_USER_JOIN_ROOM = 'CLIENT_EVENT_USER_JOIN_ROOM';
const CLIENT_EVENT_USER_LEAVE_ROOM = 'CLIENT_EVENT_USER_LEAVE_ROOM';
const CLIENT_EVENT_ROOM_MESSAGE = 'CLIENT_EVENT_ROOM_MESSAGE';
const CLIENT_EVENT_USER_JOIN_MULTIPLE_ROOMS = 'CLIENT_EVENT_USER_JOIN_MULTIPLE_ROOMS';
const CLIENT_EVENT_USER_MESSAGE_MULTIPLE_ROOMS = 'CLIENT_EVENT_USER_MESSAGE_MULTIPLE_ROOMS';
const CLIENT_EVENT_FETCH_ROOM_MEMBERS = 'CLIENT_EVENT_FETCH_ROOM_MEMBERS';

// Server side events
const SERVER_EVENT_USER_JOINED = 'SERVER_EVENT_USER_JOINED';
const SERVER_EVENT_USER_LEFT = 'SERVER_EVENT_USER_LEFT';
const SERVER_EVENT_DIRECT_MESSAGE = 'SERVER_EVENT_DIRECT_MESSAGE';
const SERVER_EVENT_ROOM_CREATED = 'SERVER_EVENT_ROOM_CREATED';
const SERVER_EVENT_USER_JOINED_ROOM = 'SERVER_EVENT_USER_JOINED_ROOM';
const SERVER_EVENT_USER_LEFT_ROOM = 'SERVER_EVENT_USER_LEFT_ROOM';
const SERVER_EVENT_ROOM_MESSAGE = 'SERVER_EVENT_ROOM_MESSAGE';

const users = new Map(); // Map from socket id to user name
const rooms = new Map(); // Map from random uuid to room name

app.get('/', (req, res) => {
  res.redirect('index.html');
});

io.on('connection', (socket) => {
  const usersRooms = []; // List of rooms where user is a member

  // When client disconnects
  socket.on('disconnect', () => {
    if (users.has(socket.id)) {
      users.delete(socket.id);
      socket.broadcast.emit(SERVER_EVENT_USER_LEFT, socket.id);
      usersRooms.forEach((roomId) => {
        socket.to(roomId).emit(SERVER_EVENT_USER_LEFT_ROOM, socket.id, roomId);
      });
    }
  });

  // When client registers with a username
  socket.on(CLIENT_EVENT_USERNAME, (userName, callback) => {
    let callbackStatus = '';

    if (Array.from(users.values()).includes(userName)) {
      callbackStatus = STATUS_REJECTED;
    } else {
      users.set(socket.id, userName);
      socket.broadcast.emit(SERVER_EVENT_USER_JOINED, socket.id, userName);
      callbackStatus = STATUS_ACCEPETED;
    }

    callback({
      status: callbackStatus,
      activeUsers: JSON.stringify(Array.from(users)),
      rooms: JSON.stringify(Array.from(rooms)),
    });
  });

  // When client sends a direct message to some user
  socket.on(CLIENT_EVENT_DIRECT_MESSAGE, (userId, message) => {
    io.to(userId).emit(SERVER_EVENT_DIRECT_MESSAGE, socket.id, message);
  });

  // When client adds a room
  socket.on(CLIENT_EVENT_ADD_ROOM, (roomName, callback) => {
    let callbackStatus = STATUS_REJECTED;
    const newRoomId = uuid.v4();
    if (!Array.from(rooms.values()).includes(roomName)) {
      callbackStatus = STATUS_ACCEPETED;
      socket.join(newRoomId);
      rooms.set(newRoomId, roomName);
      usersRooms.push(newRoomId);
      socket.broadcast.emit(SERVER_EVENT_ROOM_CREATED, newRoomId, roomName);
    }
    callback({
      status: callbackStatus,
      roomId: newRoomId,
    });
  });

  // When client joins a room
  socket.on(CLIENT_EVENT_USER_JOIN_ROOM, (roomId) => {
    socket.join(roomId);
    usersRooms.push(roomId);
    socket.to(roomId).emit(SERVER_EVENT_USER_JOINED_ROOM, socket.id, roomId);
  });

  // When client leaves a room
  socket.on(CLIENT_EVENT_USER_LEAVE_ROOM, (roomId) => {
    usersRooms.splice(usersRooms.indexOf(roomId), 1);
    socket.to(roomId).emit(SERVER_EVENT_USER_LEFT_ROOM, socket.id, roomId);
    socket.leave(roomId);
  });

  // When client sends a message to a room
  socket.on(CLIENT_EVENT_ROOM_MESSAGE, (roomId, message) => {
    socket.to(roomId).emit(SERVER_EVENT_ROOM_MESSAGE, roomId, socket.id, message);
  });

  // When client sends a 'bulk' join room message
  socket.on(CLIENT_EVENT_USER_JOIN_MULTIPLE_ROOMS, (roomsToJoin) => {
    roomsToJoin.forEach((roomId) => {
      socket.join(roomId);
      usersRooms.push(roomId);
      socket.to(roomId).emit(SERVER_EVENT_USER_JOINED_ROOM, socket.id, roomId);
    });
  });

  // When client sends a 'bulk' sends messages to rooms
  socket.on(CLIENT_EVENT_USER_MESSAGE_MULTIPLE_ROOMS, (roomsToMessage, message) => {
    roomsToMessage.forEach((roomId) => {
      socket.to(roomId).emit(SERVER_EVENT_ROOM_MESSAGE, roomId, socket.id, message);
    });
  });

  // When client requests the members of some room
  socket.on(CLIENT_EVENT_FETCH_ROOM_MEMBERS, (roomId, callback) => {
    let roomMembers = io.of('/').adapter.rooms.get(roomId);
    if (roomMembers !== undefined) {
      roomMembers = JSON.stringify(Array.from(io.of('/').adapter.rooms.get(roomId)));
    } else {
      roomMembers = JSON.stringify([]);
    }

    callback({
      roomMembersIds: roomMembers,
    });
  });
});

server.listen(3000, () => {
  console.log('listening on *:3000');
});
