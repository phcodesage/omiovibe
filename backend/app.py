from flask import Flask, request
from flask_socketio import SocketIO, emit, join_room, leave_room

app = Flask(__name__)
app.config['SECRET_KEY'] = 'secret!'
socketio = SocketIO(app, cors_allowed_origins="*")

# In-memory data stores
users = {}
waiting_users = []  # List of sids
paired_users = {}  # sid -> room_id

def _try_pair_users():
    if len(waiting_users) >= 2:
        user1_sid = waiting_users.pop(0)
        user2_sid = waiting_users.pop(0)

        room = f"{user1_sid}-{user2_sid}"

        paired_users[user1_sid] = room
        paired_users[user2_sid] = room

        join_room(room, sid=user1_sid)
        join_room(room, sid=user2_sid)

        user1_username = users.get(user1_sid, {}).get('username', 'Stranger')
        user2_username = users.get(user2_sid, {}).get('username', 'Stranger')

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
    if sid in users:
        del users[sid]

@socketio.on('set_username')
def handle_set_username(data):
    sid = request.sid
    if 'username' in data and data['username']:
        users[sid] = {'username': data['username']}
        emit('username_set')

@socketio.on('start_searching')
def handle_start_searching():
    sid = request.sid
    if sid not in users or sid in paired_users:
        return

    if sid not in waiting_users:
        waiting_users.append(sid)

    emit('waiting', to=sid)
    _try_pair_users()

@socketio.on('stop_chat')
def handle_stop_chat():
    sid = request.sid

    if sid in waiting_users:
        waiting_users.remove(sid)
        emit('stopped_chat', to=sid)
        return

    room = paired_users.pop(sid, None)
    if room:
        emit('stopped_chat', to=sid)

        partner_sid = None
        for p_sid, p_room in list(paired_users.items()):
            if p_room == room:
                partner_sid = p_sid
                break

        if partner_sid:
            paired_users.pop(partner_sid)
            emit('partner_disconnected', to=partner_sid)

            if partner_sid not in waiting_users:
                waiting_users.append(partner_sid)

            emit('waiting', to=partner_sid)
            _try_pair_users()

@socketio.on('skip_chat')
def handle_skip_chat():
    sid = request.sid
    room = paired_users.get(sid)

    if not room:
        return

    partner_sid = None
    for p_sid, p_room in list(paired_users.items()):
        if p_room == room and p_sid != sid:
            partner_sid = p_sid
            break

    paired_users.pop(sid, None)
    if partner_sid:
        paired_users.pop(partner_sid, None)
        emit('partner_skipped', to=partner_sid)

    if sid not in waiting_users:
        waiting_users.append(sid)
    emit('waiting', to=sid)

    if partner_sid and partner_sid not in waiting_users:
        waiting_users.append(partner_sid)
        emit('waiting', to=partner_sid)

    _try_pair_users()
    _try_pair_users()

@socketio.on('chat_message')
def handle_chat_message(data):
    sid = request.sid
    if sid in paired_users:
        room = paired_users[sid]
        username = users.get(sid, {}).get('username', 'Stranger')
        emit('chat_message', {'text': data['text'], 'username': username}, room=room, skip_sid=sid)

@socketio.on('typing')
def handle_typing():
    sid = request.sid
    if sid in paired_users:
        room = paired_users[sid]
        username = users.get(sid, {}).get('username', 'Stranger')
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
