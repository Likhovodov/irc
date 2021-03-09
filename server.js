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
const STATUS_REJECTED = 'REJECTED';
const STATUS_ACCEPETED = 'ACCEPTED';

// Client side events
const EVENT_USERNAME = 'USERNAME';
const EVENT_DIRECT_MESSAGE_CLIENT = 'DIRECT_MESSAGE_CLIENT';
const EVENT_ADD_ROOM_CLIENT = 'ADD_ROOM_CLIENT';
const EVENT_USER_JOINED_ROOM_CLIENT = 'USER_JOINED_ROOM_CLIENT';
const EVENT_USER_LEFT_ROOM_CLIENT = 'USER_LEFT_ROOM_CLIENT';
const EVENT_ROOM_MESSAGE_CLIENT = 'EVENT_ROOM_MESSAGE_CLIENT';
const EVENT_USER_JOIN_MULTIPLE_ROOMS_CLIENT = 'EVENT_USER_JOIN_MULTIPLE_ROOMS_CLIENT';
const EVENT_USER_MESSAGE_MULTIPLE_ROOMS_CLIENT = 'EVENT_USER_MESSAGE_MULTIPLE_ROOMS_CLIENT';
const EVENT_FETCH_ROOM_MEMBERS_CLIENT = 'EVENT_FETCH_ROOM_MEMBERS_CLIENT';

// Server side events
const EVENT_USER_JOINED = 'USER_JOINED';
const EVENT_USER_LEFT = 'USER_LEFT';
const EVENT_DIRECT_MESSAGE_SERVER = 'DIRECT_MESSAGE_SERVER';
const EVENT_USER_ROOM_CREATED = 'ROOM_CREATED';
const EVENT_USER_JOINED_ROOM_SERVER = 'USER_JOINED_ROOM_SERVER';
const EVENT_USER_LEFT_ROOM_SERVER = 'USER_LEFT_ROOM_SERVER';
const EVENT_ROOM_MESSAGE_SERVER = 'EVENT_ROOM_MESSAGE_SERVER';

const users = new Map(); // Map from socket id to user name
const rooms = new Map(); // Map from random uuid to room name

app.get('/', (req, res) => {
  res.redirect('index.html');
});

io.on('connection', (socket) => {
  const usersRooms = []; // List of rooms where user is a member

  socket.on('disconnect', () => {
    if (users.has(socket.id)) {
      users.delete(socket.id);
      socket.broadcast.emit(EVENT_USER_LEFT, socket.id);
    }
  });

  socket.on(EVENT_USERNAME, (userName, callback) => {
    let callbackStatus = '';

    if (Array.from(users.values()).includes(userName)) {
      callbackStatus = STATUS_REJECTED;
    } else {
      users.set(socket.id, userName);
      socket.broadcast.emit(EVENT_USER_JOINED, socket.id, userName);
      callbackStatus = STATUS_ACCEPETED;
    }

    callback({
      status: callbackStatus,
      activeUsers: JSON.stringify(Array.from(users)),
      rooms: JSON.stringify(Array.from(rooms)),
    });
  });

  socket.on(EVENT_DIRECT_MESSAGE_CLIENT, (userId, message) => {
    io.to(userId).emit(EVENT_DIRECT_MESSAGE_SERVER, socket.id, message);
  });

  socket.on(EVENT_ADD_ROOM_CLIENT, (roomName, callback) => {
    let callbackStatus = STATUS_REJECTED;
    const newRoomId = uuid.v4();
    if (!Array.from(rooms.values()).includes(roomName)) {
      callbackStatus = STATUS_ACCEPETED;
      socket.join(newRoomId);
      rooms.set(newRoomId, roomName);
      usersRooms.push(newRoomId);
      socket.broadcast.emit(EVENT_USER_ROOM_CREATED, newRoomId, roomName);
    }
    callback({
      status: callbackStatus,
      roomId: newRoomId,
    });
  });

  socket.on(EVENT_USER_JOINED_ROOM_CLIENT, (roomId) => {
    socket.join(roomId);
    usersRooms.push(roomId);
    socket.to(roomId).emit(EVENT_USER_JOINED_ROOM_SERVER, socket.id, roomId);
  });

  socket.on(EVENT_USER_LEFT_ROOM_CLIENT, (roomId) => {
    usersRooms.splice(usersRooms.indexOf(roomId), 1);
    socket.to(roomId).emit(EVENT_USER_LEFT_ROOM_SERVER, socket.id, roomId);
    socket.leave(roomId);
  });

  socket.on(EVENT_ROOM_MESSAGE_CLIENT, (roomId, message) => {
    socket.to(roomId).emit(EVENT_ROOM_MESSAGE_SERVER, roomId, socket.id, message);
  });

  socket.on(EVENT_USER_JOIN_MULTIPLE_ROOMS_CLIENT, (roomsToJoin) => {
    roomsToJoin.forEach((roomId) => {
      socket.join(roomId);
      usersRooms.push(roomId);
      socket.to(roomId).emit(EVENT_USER_JOINED_ROOM_SERVER, socket.id, roomId);
    });
  });

  socket.on(EVENT_USER_MESSAGE_MULTIPLE_ROOMS_CLIENT, (roomsToMessage, message) => {
    roomsToMessage.forEach((roomId) => {
      socket.to(roomId).emit(EVENT_ROOM_MESSAGE_SERVER, roomId, socket.id, message);
    });
  });

  socket.on(EVENT_FETCH_ROOM_MEMBERS_CLIENT, (roomId, callback) => {
    console.log(JSON.stringify(Array.from(io.of('/').adapter.rooms.get(roomId))));
    callback({
      roomMembersIds: JSON.stringify(Array.from(io.of('/').adapter.rooms.get(roomId))),
    });
  });
});

server.listen(3000, () => {
  console.log('listening on *:3000');
});
