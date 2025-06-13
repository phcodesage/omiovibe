from flask import Flask, request
from flask_socketio import SocketIO, emit, join_room, leave_room

app = Flask(__name__)
app.config['SECRET_KEY'] = 'secret!'
socketio = SocketIO(app, cors_allowed_origins="*")

# In-memory data stores
waiting_users = []
paired_users = {}  # sid -> room
user_data = {}  # sid -> {'username': '...'}

def try_pair_users():
    """Attempts to pair users from the waiting queue."""
    while len(waiting_users) >= 2:
        user1_sid = waiting_users.pop(0)
        user2_sid = waiting_users.pop(0)

        room = f"{user1_sid}-{user2_sid}"
        paired_users[user1_sid] = room
        paired_users[user2_sid] = room

        join_room(room, sid=user1_sid)
        join_room(room, sid=user2_sid)

        user1_username = user_data.get(user1_sid, {}).get('username', 'Stranger')
        user2_username = user_data.get(user2_sid, {}).get('username', 'Stranger')

        emit('matched', {'partner_username': user2_username}, to=user1_sid)
        emit('matched', {'partner_username': user1_username}, to=user2_sid)

@socketio.on('connect')
def handle_connect():
    print(f"Client connected: {request.sid}")

@socketio.on('disconnect')
def handle_disconnect():
    sid = request.sid
    print(f"Client disconnected: {request.sid}")

    # If user was in a chat, notify the partner
    if sid in paired_users:
        room = paired_users.pop(sid)
        partner_sid = None
        for p_sid, p_room in list(paired_users.items()):
            if p_room == room:
                partner_sid = p_sid
                break
        
        if partner_sid:
            paired_users.pop(partner_sid)
            emit('partner_disconnected', to=partner_sid)

    # If user was waiting, remove them from the queue
    if sid in waiting_users:
        try:
            waiting_users.remove(sid)
        except ValueError:
            pass # Already removed, race condition

    # Clean up user data
    if sid in user_data:
        del user_data[sid]

@socketio.on('set_username')
def handle_set_username(data):
    sid = request.sid
    if 'username' in data and data['username']:
        user_data[sid] = {'username': data['username']}
        emit('username_set')

@socketio.on('start_searching')
def handle_start_searching():
    sid = request.sid
    if sid not in waiting_users and sid not in paired_users:
        waiting_users.append(sid)
        emit('waiting')
        try_pair_users()

@socketio.on('stop_chat')
def handle_stop_chat():
    sid = request.sid
    
    if sid in waiting_users:
        try:
            waiting_users.remove(sid)
        except ValueError:
            pass
    
    elif sid in paired_users:
        room = paired_users.pop(sid)
        partner_sid = None
        for p_sid, p_room in list(paired_users.items()):
            if p_room == room:
                partner_sid = p_sid
                break
        
        if partner_sid:
            paired_users.pop(partner_sid)
            leave_room(room, sid=sid)
            leave_room(room, sid=partner_sid)
            emit('partner_disconnected', to=partner_sid)
    
    emit('stopped_chat')

@socketio.on('skip_chat')
def handle_skip_chat():
    sid = request.sid
    if sid in paired_users:
        room = paired_users.pop(sid)
        partner_sid = None
        for p_sid, p_room in list(paired_users.items()):
            if p_room == room:
                partner_sid = p_sid
                break
        
        if partner_sid:
            paired_users.pop(partner_sid)
            leave_room(room, sid=sid)
            leave_room(room, sid=partner_sid)
            emit('partner_skipped', to=partner_sid)
            if partner_sid not in waiting_users:
                waiting_users.append(partner_sid)

        if sid not in waiting_users:
            waiting_users.append(sid)
        
        emit('waiting', to=sid)
        emit('waiting', to=partner_sid)
        try_pair_users()

@socketio.on('chat_message')
def handle_chat_message(data):
    sid = request.sid
    if sid in paired_users:
        room = paired_users[sid]
        username = user_data.get(sid, {}).get('username', 'Stranger')
        emit('chat_message', {'text': data['text'], 'username': username}, room=room, skip_sid=sid)

@socketio.on('typing')
def handle_typing():
    sid = request.sid
    if sid in paired_users:
        room = paired_users[sid]
        username = user_data.get(sid, {}).get('username', 'Stranger')
        emit('user_typing', {'username': username}, room=room, skip_sid=sid)

@socketio.on('stop_typing')
def handle_stop_typing():
    sid = request.sid
    if sid in paired_users:
        room = paired_users[sid]
        emit('user_stopped_typing', room=room, skip_sid=sid)

if __name__ == '__main__':
    print(" Server is running on http://localhost:5000 ...")
    socketio.run(app, host='0.0.0.0', port=5000)
