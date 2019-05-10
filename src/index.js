const express = require('express');
const path = require('path');
const http = require('http');
const socketio = require('socket.io');
const Filter = require('bad-words');
const { generateMessage, generateLocationMessage } = require('./utils/messages');
const { addUser, removeUser, getUser, getUsersInRoom} = require('./utils/users');


// Configuring express
const app = express();
const server = http.createServer(app);
const io = socketio(server);

// adding port and public path
const port = process.env.PORT || 3000;
const publicDirectoryPath = path.join(__dirname, '../public');


app.use(express.static(publicDirectoryPath));


// socket.emit -> send to specific client
// socket.io -> send to all
// socket.broadcast.emit -> send to all except this one
// io.to.emit -> all in a specific room
// socket.broadcast.to.emit -> send to all from room except this one


io.on('connection', (socket) => {
    console.log('New Web Socket connection!');

    socket.on('join', (options, callback) => {
        const { error, user } = addUser({id: socket.id, ...options })
        
        if (error) {
            return callback(error);
        }


        socket.join(user.room)

        // emmiting to client
        socket.emit('message', generateMessage ('Admin', 'Welcome to the chat!'));

        // emmiting to all except the client who connected
        socket.broadcast.to(user.room).emit('message', generateMessage('Admin', `${user.username} has joined!`));

        io.to(user.room).emit('roomData', {
            room: user.room,
            users: getUsersInRoom(user.room)
        })
        callback();
    })

    // getting from client
    socket.on('sendMessage', (message, callback) => {

        // gettin the user
        const user = getUser(socket.id);
        // no profane words
        const filter = new Filter();

        if (filter.isProfane(message)) {
            return callback('Profanity is not allowed!')
        }

        // sending to all clients
        io.to(user.room).emit('message', generateMessage(user.username, message));
        callback();
    })

    socket.on('sendLocation', (coords, callback) => {

        // getting the user
        const user = getUser(socket.id);
        const locationUrl = `https://google.com/maps?q=${coords.latitude},${coords.longitude}`;

        io.to(user.room).emit('locationMessage', generateLocationMessage(user.username, locationUrl));
        callback();
    })

    // disconnecting a user
    socket.on('disconnect', () => {
        const user = removeUser(socket.id);

        if (user) {
            io.to(user.room).emit('message', generateMessage('Admin', `${user.username} has left`));
            io.to(user.room).emit('roomData', {
                room: user.room,
                users: getUsersInRoom(user.room)
            })
        }
    })
})


// starting the server
server.listen(port, () => {
    console.log(`Server is up on port ${port}`);
});

