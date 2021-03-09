const socket = io();

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

class Message {
  constructor(from, content, strong = false) {
    this.from = from;
    this.content = content;
    this.strong = strong;
  }
}

const ROOM_CONVERSATION_TYPE = 'ROOM';
const USER_CONVERSATION_TYPE = 'USER';

class Conversation {
  constructor(type, id, name) {
    this.type = type;
    this.id = id;
    this.name = name;
    this.messages = [];
  }
}

let userName = ''; // Name of current user
let focusedConversationId = null; // Id of conversation currently in focus
const conversations = new Map(); // user id -> Conversation object
const usersRooms = []; // List of room id's where user is a member

$(document).ready(() => {
  const mainView = $('#main-view');
  const mainCardTitle = $('#main-card-title');

  const registrationCard = $('#registration-card');
  const registrationForm = $('#registration-form');
  const registrationNameInput = $('#registration-name');

  const messageForm = $('#message-form');
  const messageInput = $('#message-input');
  const messageList = $('#message-list');
  const userList = $('#user-list');

  const addRoomModalButton = $('#add-room-modal-button');
  const roomList = $('#room-list');
  const listUsersButton = $('#list-users-button');

  // Enable tooltips
  $("[data-toggle='tooltip']").tooltip();

  /**
  * Clears all the messages in the main message view
  */
  function clearMessages() {
    $('#message-list').empty();
  }

  /**
   * Initialize multiselects
   */
  $('.multi-select').each(function () {
    $(this).select2({
      theme: 'bootstrap4',
    });
  });

  /**
  *
  * @param {Message} message message to be added to the message view
  */
  function renderMessage(message) {
    let messageToAdd = '';
    if (message.strong) {
      messageToAdd = `
        <li class="list-group-item">
          <strong>${message.from}: ${message.content}</strong> 
        </li>`;
    } else {
      messageToAdd = `
        <li class="list-group-item">
          <strong>${message.from}:</strong> ${message.content}
        </li>`;
    }
    messageList.append(messageToAdd);
  }

  /**
  * Given a list of messages, renders them in the main view
  *
  * @param {Message[]} messages
  */
  function loadMessages(messages) {
    messageList.empty();
    messages.forEach((message) => { renderMessage(message); });
  }

  /**
  * Focus a user for direct messaging
  *
  * @param {string} userId id of user to be focused
  */
  function focusUser(userId) {
    focusedConversationId = userId;
    mainCardTitle.html(`Private conversation with ${conversations.get(userId).name}`);
    clearMessages();
    loadMessages(conversations.get(userId).messages);
    $(`#${userId}-unread`).css('display', 'none');
    $(`#${userId}-read`).css('display', 'inline');
    $('#list-users-button').css('display', 'none');
  }

  /**
  * Focus a room
  *
  * @param {string} roomId id of room to be focused
  */
  function focusRoom(roomId) {
    focusedConversationId = roomId;
    mainCardTitle.html(`In room: ${conversations.get(roomId).name}`);
    clearMessages();
    loadMessages(conversations.get(roomId).messages);
    $(`#${roomId}-unread`).css('display', 'none');
    $(`#${roomId}-read`).css('display', 'inline');
    $('#list-users-button').css('display', 'inline');
  }

  function addUser(newUserId, newUserName) {
    conversations.set(newUserId, new Conversation(USER_CONVERSATION_TYPE, newUserId, newUserName));
    const userEntryToAdd = `
    <li class="list-group-item" id="${newUserId}">
      <div id="${newUserId}-read">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-envelope-openm" viewBox="0 0 16 16">
        <path d="M8.47 1.318a1 1 0 0 0-.94 0l-6 3.2A1 1 0 0 0 1 5.4v.818l5.724 3.465L8 8.917l1.276.766L15 6.218V5.4a1 1 0 0 0-.53-.882l-6-3.2zM15 7.388l-4.754 2.877L15 13.117v-5.73zm-.035 6.874L8 10.083l-6.965 4.18A1 1 0 0 0 2 15h12a1 1 0 0 0 .965-.738zM1 13.117l4.754-2.852L1 7.387v5.73zM7.059.435a2 2 0 0 1 1.882 0l6 3.2A2 2 0 0 1 16 5.4V14a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V5.4a2 2 0 0 1 1.059-1.765l6-3.2z"/>
        </svg>
        ${newUserName}
      </div>
      <div id="${newUserId}-unread" style="display:none;">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-envelope-fill" viewBox="0 0 16 16">
        <path d="M.05 3.555A2 2 0 0 1 2 2h12a2 2 0 0 1 1.95 1.555L8 8.414.05 3.555zM0 4.697v7.104l5.803-3.558L0 4.697zM6.761 8.83l-6.57 4.027A2 2 0 0 0 2 14h12a2 2 0 0 0 1.808-1.144l-6.57-4.027L8 9.586l-1.239-.757zm3.436-.586L16 11.801V4.697l-5.803 3.546z"/>
        </svg>
        ${newUserName}
      </div>
    </li>`;
    userList.append(userEntryToAdd);
    $(`#${newUserId}`).on('click', () => {
      focusUser(newUserId);
    });
  }

  function joinRoom(roomId) {
    usersRooms.push(roomId);
    $(`#${roomId}-join`).css('display', 'none');
    $(`#${roomId}-leave`).css('display', 'inline');
    socket.emit(EVENT_USER_JOINED_ROOM_CLIENT, roomId);
    focusRoom(roomId);
  }

  function leaveRoom(roomId) {
    focusedConversationId = null;
    $(`#${roomId}-join`).css('display', 'inline');
    $(`#${roomId}-leave`).css('display', 'none');
    $(`#${roomId}-read`).css('display', 'inline');
    $(`#${roomId}-unread`).css('display', 'none');
    usersRooms.splice(usersRooms.indexOf(roomId), 1);
    socket.emit(EVENT_USER_LEFT_ROOM_CLIENT, roomId);
  }

  /**
   *
   * @param {string} roomId
   * @param {string} roomName
   * @param {boolean} joinAutomatically
   */
  function addRoom(roomId, roomName, joinAutomatically = false) {
    conversations.set(roomId, new Conversation(ROOM_CONVERSATION_TYPE, roomId, roomName));
    const roomEntryToAdd = `
    <li class="list-group-item" id="${roomId}">
      <div id="${roomId}-read" style="display:inline;">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-envelope-openm" viewBox="0 0 16 16">
        <path d="M8.47 1.318a1 1 0 0 0-.94 0l-6 3.2A1 1 0 0 0 1 5.4v.818l5.724 3.465L8 8.917l1.276.766L15 6.218V5.4a1 1 0 0 0-.53-.882l-6-3.2zM15 7.388l-4.754 2.877L15 13.117v-5.73zm-.035 6.874L8 10.083l-6.965 4.18A1 1 0 0 0 2 15h12a1 1 0 0 0 .965-.738zM1 13.117l4.754-2.852L1 7.387v5.73zM7.059.435a2 2 0 0 1 1.882 0l6 3.2A2 2 0 0 1 16 5.4V14a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V5.4a2 2 0 0 1 1.059-1.765l6-3.2z"/>
        </svg>
      </div>

      <div id="${roomId}-unread" style="display:none;">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-envelope-fill" viewBox="0 0 16 16">
        <path d="M.05 3.555A2 2 0 0 1 2 2h12a2 2 0 0 1 1.95 1.555L8 8.414.05 3.555zM0 4.697v7.104l5.803-3.558L0 4.697zM6.761 8.83l-6.57 4.027A2 2 0 0 0 2 14h12a2 2 0 0 0 1.808-1.144l-6.57-4.027L8 9.586l-1.239-.757zm3.436-.586L16 11.801V4.697l-5.803 3.546z"/>
        </svg>
      </div>

      <div id="${roomId}-join" style="display:none;">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-plus-circle" viewBox="0 0 16 16">
          <path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16z"/>
          <path d="M8 4a.5.5 0 0 1 .5.5v3h3a.5.5 0 0 1 0 1h-3v3a.5.5 0 0 1-1 0v-3h-3a.5.5 0 0 1 0-1h3v-3A.5.5 0 0 1 8 4z"/>
        </svg>
      </div>

      <div id="${roomId}-leave" style="display:none;">
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-x-circle" viewBox="0 0 16 16">
        <path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16z"/>
        <path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708z"/>
      </svg>
      </div>

      ${roomName}
    </li>`;

    roomList.append(roomEntryToAdd);

    if (joinAutomatically) {
      joinRoom(roomId);
    } else {
      $(`#${roomId}-join`).css('display', 'inline');
    }

    $(`#${roomId}`).on('click', () => {
      if (!usersRooms.includes(roomId)) {
        alert('Join the room before you can view it');
      } else {
        focusRoom(roomId);
      }
    });

    $(`#${roomId}-join`).on('click', (event) => {
      event.stopPropagation();
      joinRoom(roomId);
    });

    $(`#${roomId}-leave`).on('click', (event) => {
      event.stopPropagation();
      leaveRoom(roomId);
    });
  }

  function createRoom(roomId, roomName) {
    addRoom(roomId, roomName);
    usersRooms.push(roomId);
    $(`#${roomId}-join`).css('display', 'none');
    $(`#${roomId}-leave`).css('display', 'inline');
    focusRoom(roomId);
  }

  // Registration form is submitted
  registrationForm.submit((event) => {
    event.preventDefault();
    userName = registrationNameInput.val();
    socket.emit(EVENT_USERNAME, userName, (response) => {
      if (response.status === STATUS_ACCEPETED) {
        userList.empty();
        JSON.parse(response.activeUsers).forEach((entry) => {
          if (entry[0] !== socket.id) { addUser(entry[0], entry[1]); }
        });

        JSON.parse(response.rooms).forEach((entry) => {
          addRoom(entry[0], entry[1]);
        });

        alert(`Welcome ${userName}`);
        registrationCard.css('display', 'none');
        mainView.css('display', 'flex');
      } else {
        registrationNameInput.val('');
        alert('Username already taken');
      }
    });
  });

  // User sends a message
  messageForm.submit((event) => {
    event.preventDefault();
    if (focusedConversationId != null) {
      const message = messageInput.val();
      const messageObject = new Message(userName, message);
      const conversation = conversations.get(focusedConversationId);
      conversation.messages.push(messageObject);
      renderMessage(messageObject);
      if (conversation.type === ROOM_CONVERSATION_TYPE) {
        socket.emit(EVENT_ROOM_MESSAGE_CLIENT, focusedConversationId, message);
      } else {
        socket.emit(EVENT_DIRECT_MESSAGE_CLIENT, focusedConversationId, message);
      }
    }
  });

  addRoomModalButton.click(() => {
    const roomTitleInput = $('#room-name-input');
    const roomName = roomTitleInput.val();
    if (roomName !== '') {
      socket.emit(EVENT_ADD_ROOM_CLIENT, roomName, (response) => {
        if (response.status === STATUS_ACCEPETED) {
          createRoom(response.roomId, roomName);
          $('#add-room-modal').modal('hide');
        } else {
          roomTitleInput.val('');
          $('#add-room-input-error').html('Room name already taken');
          $('#add-room-input-error').css('display', 'flex');
        }
      });
    } else {
      $('#add-room-input-error').html('Input must be non-empty');
      $('#add-room-input-error').css('display', 'flex');
    }
  });

  $('#join-multiple-rooms-button').click(() => {
    const joinMultipleRoomsSelect = $('#join-multiple-rooms-select');
    joinMultipleRoomsSelect.empty();

    conversations.forEach((conversation) => {
      if (conversation.type === ROOM_CONVERSATION_TYPE && !usersRooms.includes(conversation.id)) {
        joinMultipleRoomsSelect.append(`<option value="${conversation.id}">${conversation.name}</option>`);
      }
    });
    $('#join-multiple-rooms-input-error').css('display', 'none');
  });

  $('#submit-join-multiple-rooms-modal-button').click(() => {
    const selectedRooms = [];
    const multipleRoomsSelectData = $('#join-multiple-rooms-select').select2('data');

    if (multipleRoomsSelectData.length !== 0) {
      multipleRoomsSelectData.forEach((selectedOption) => {
        const roomId = selectedOption.element.value;
        selectedRooms.push(roomId);
        usersRooms.push(roomId);
        $(`#${roomId}-join`).css('display', 'none');
        $(`#${roomId}-leave`).css('display', 'inline');
      });
      socket.emit(EVENT_USER_JOIN_MULTIPLE_ROOMS_CLIENT, selectedRooms);
      $('#add-join-multiple-rooms-modal').modal('hide');
    } else {
      $('#join-multiple-rooms-input-error').html('Select at least one room');
      $('#join-multiple-rooms-input-error').css('display', 'flex');
    }
  });

  $('#message-multiple-rooms-button').click(() => {
    const messageMultipleRoomsSelect = $('#message-multiple-rooms-select');
    messageMultipleRoomsSelect.empty();

    usersRooms.forEach((roomId) => {
      messageMultipleRoomsSelect.append(`<option value="${roomId}">${conversations.get(roomId).name}</option>`);
    });
    $('#message-multiple-rooms-input-error').css('display', 'none');
  });

  $('#submit-message-multiple-rooms-modal-button').click(() => {
    const selectedRooms = [];
    const multipleRoomsSelectData = $('#message-multiple-rooms-select').select2('data');
    const message = $('#multiple-room-message-input').val();

    if (message !== '') {
      if (multipleRoomsSelectData.length !== 0) {
        multipleRoomsSelectData.forEach((selectedOption) => {
          selectedRooms.push(selectedOption.element.value);
        });
        socket.emit(EVENT_USER_MESSAGE_MULTIPLE_ROOMS_CLIENT, selectedRooms, message);
        $('#message-multiple-rooms-modal').modal('hide');
      } else {
        $('#message-multiple-rooms-input-error').html('Select at least one room');
        $('#message-multiple-rooms-input-error').css('display', 'flex');
      }
    } else {
      $('#message-multiple-rooms-input-error').html('Provide a message to send');
      $('#message-multiple-rooms-input-error').css('display', 'flex');
    }
  });

  $('#add-room-button').click(() => {
    $('#input-error').css('display', 'none');
  });

  $('#disconnect-button').on('click', () => {
    location.reload();
  });

  $('#list-users-button').on('click', () => {
    $('#room-members').empty();
    socket.emit(EVENT_FETCH_ROOM_MEMBERS_CLIENT, focusedConversationId, (response) => {
      JSON.parse(response.roomMembersIds).forEach((roomMemberId) => {
        if (roomMemberId !== socket.id) {
          $('#room-members').append(`<li class="list-group-item">${conversations.get(roomMemberId).name}</li>`);
        }
      });
    });
    $('#list-users-modal').modal('show');
  });

  socket.on(EVENT_USER_JOINED, (newUserId, newUserName) => {
    addUser(newUserId, newUserName);
  });

  socket.on(EVENT_USER_LEFT, (userId) => {
    focusedConversationId = null;
    if (focusedConversationId === userId) {
      renderMessage(new Message(conversations.get(userId).name, 'Left the chat', true));
    }
    $(`#${userId}`).remove();
  });

  socket.on(EVENT_DIRECT_MESSAGE_SERVER, (sourceUserId, message) => {
    const messageObject = new Message(conversations.get(sourceUserId).name, message);
    conversations.get(sourceUserId).messages.push(messageObject);
    if (focusedConversationId === sourceUserId) {
      renderMessage(messageObject);
    } else {
      $(`#${sourceUserId}-read`).css('display', 'none');
      $(`#${sourceUserId}-unread`).css('display', 'block');
    }
  });

  socket.on(EVENT_USER_ROOM_CREATED, (roomId, roomName) => {
    conversations.set(roomId, new Conversation(ROOM_CONVERSATION_TYPE, roomId, roomName));
    addRoom(roomId, roomName);
  });

  socket.on(EVENT_USER_JOINED_ROOM_SERVER, (userId, roomId) => {
    const newMessage = new Message(conversations.get(userId).name, 'Joined the chat', true);
    conversations.get(roomId).messages.push(newMessage);
    if (focusedConversationId === roomId) {
      renderMessage(newMessage);
    }
  });

  socket.on(EVENT_USER_LEFT_ROOM_SERVER, (userId, roomId) => {
    const newMessage = new Message(conversations.get(userId).name, 'Left the chat', true);
    conversations.get(roomId).messages.push(newMessage);
    if (focusedConversationId === roomId) {
      renderMessage(newMessage);
    }
  });

  socket.on(EVENT_ROOM_MESSAGE_SERVER, (roomId, userId, message) => {
    const newMessage = new Message(conversations.get(userId).name, message);
    conversations.get(roomId).messages.push(newMessage);
    if (focusedConversationId === roomId) {
      renderMessage(newMessage);
    } else {
      $(`#${roomId}-read`).css('display', 'none');
      $(`#${roomId}-unread`).css('display', 'inline');
    }
  });
});
