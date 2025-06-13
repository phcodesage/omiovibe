# ✅ First thing in the file
import eventlet
eventlet.monkey_patch()

# ✅ Then import everything else
from flask import Flask, request
from flask_socketio import SocketIO, emit, join_room, leave_room
from flask_cors import CORS

app = Flask(__name__)
CORS(app)
socketio = SocketIO(app, cors_allowed_origins="*")

waiting_users = []
paired_users = {}
user_data = {}

@socketio.on('join')
def handle_join():
    sid = request.sid
    if waiting_users:
        partner_sid = waiting_users.pop(0)
        room = f"{sid}-{partner_sid}"
        paired_users[sid] = room
        paired_users[partner_sid] = room
        join_room(room, sid)
        join_room(room, partner_sid)
        
        # Get usernames
        user1_data = user_data.get(sid, {'username': 'Stranger'})
        user2_data = user_data.get(partner_sid, {'username': 'Stranger'})
        
        # Notify both users with each other's usernames
        emit("matched", {
            "room": room,
            "partner_username": user2_data['username']
        }, to=sid)
        
        emit("matched", {
            "room": room,
            "partner_username": user1_data['username']
        }, to=partner_sid)
    else:
        waiting_users.append(sid)

@socketio.on('set_username')
def handle_set_username(data):
    sid = request.sid
    username = data.get('username', 'Stranger')
    user_data[sid] = {'username': username}

@socketio.on("chat_message")
def handle_message(data):
    sender_sid = request.sid
    room = paired_users.get(sender_sid)

    if room and "text" in data:
        # Get the sender's username
        sender_username = user_data.get(sender_sid, {}).get('username', 'Stranger')
        # Get all users in the room except the sender
        for user_sid, user_room in paired_users.items():
            if user_room == room and user_sid != sender_sid:
                socketio.emit("chat_message", {
                    "text": data["text"],
                    "username": sender_username
                }, to=user_sid)



@socketio.on('typing')
def handle_typing():
    sender_sid = request.sid
    room = paired_users.get(sender_sid)
    
    if room:
        # Get the sender's username
        sender_username = user_data.get(sender_sid, {}).get('username', 'Stranger')
        # Send to all other users in the room
        for user_sid, user_room in paired_users.items():
            if user_room == room and user_sid != sender_sid:
                socketio.emit('user_typing', {
                    'username': sender_username
                }, to=user_sid)

@socketio.on('stop_typing')
def handle_stop_typing():
    sender_sid = request.sid
    room = paired_users.get(sender_sid)
    
    if room:
        # Send to all other users in the room
        for user_sid, user_room in paired_users.items():
            if user_room == room and user_sid != sender_sid:
                socketio.emit('user_stopped_typing', to=user_sid)

@socketio.on('disconnect')
def handle_disconnect():
    sid = request.sid
    room = paired_users.pop(sid, None)
    if sid in waiting_users:
        waiting_users.remove(sid)
    if room:
        emit("partner_disconnected", {}, room=room)
        for user, r in list(paired_users.items()):
            if r == room:
                paired_users.pop(user, None)

if __name__ == '__main__':
    print("🚀 Server is running on http://localhost:5000 ...")
    socketio.run(app, host='0.0.0.0', port=5000)
