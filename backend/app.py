import eventlet
eventlet.monkey_patch()

from flask import Flask, request, jsonify
from flask_socketio import SocketIO, emit, join_room, leave_room
from flask_bcrypt import Bcrypt
from pymongo import MongoClient
import os
from dotenv import load_dotenv
from flask_cors import CORS

load_dotenv()

# Get allowed origins from .env, split by comma, and strip whitespace
allowed_origins = os.getenv('CORS_ALLOWED_ORIGINS', '').split(',')
allowed_origins = [origin.strip() for origin in allowed_origins if origin.strip()]

if not allowed_origins:
    print("Warning: CORS_ALLOWED_ORIGINS is not set. Frontend connections may fail.")
    allowed_origins = []

app = Flask(__name__)
app.config['SECRET_KEY'] = os.getenv('SECRET_KEY', 'a-fallback-secret-key')
bcrypt = Bcrypt(app)
CORS(app, origins=allowed_origins)
socketio = SocketIO(app, cors_allowed_origins=allowed_origins)

# MongoDB Configuration
MONGO_URI = os.getenv('MONGO_URI')
if not MONGO_URI:
    raise RuntimeError("MONGO_URI not set in .env file")
client = MongoClient(MONGO_URI)
db = client['omegle_clone']
users_collection = db['users']
print("MongoDB connected successfully.")

# In-memory data stores for active users
users = {}  # sid -> {'username': '...'}
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

@app.route('/register', methods=['POST'])
def register():
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')

    if not username or not password:
        return jsonify({'error': 'Username and password are required'}), 400

    if users_collection.find_one({'username': username}):
        return jsonify({'error': 'Username already exists'}), 409

    hashed_password = bcrypt.generate_password_hash(password).decode('utf-8')
    users_collection.insert_one({'username': username, 'password': hashed_password})
    
    return jsonify({'message': 'User registered successfully'}), 201

@app.route('/login', methods=['POST'])
def login():
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')

    if not username or not password:
        return jsonify({'error': 'Username and password are required'}), 400

    user = users_collection.find_one({'username': username})

    if user and bcrypt.check_password_hash(user['password'], password):
        return jsonify({'message': 'Login successful', 'username': username}), 200
    
    return jsonify({'error': 'Invalid username or password'}), 401

@app.route('/forgot_password', methods=['POST'])
def forgot_password():
    data = request.get_json()
    username = data.get('username')
    new_password = data.get('new_password')

    if not username or not new_password:
        return jsonify({'error': 'Username and new password are required'}), 400

    user = users_collection.find_one({'username': username})
    if not user:
        return jsonify({'error': 'Username not found'}), 404

    hashed_password = bcrypt.generate_password_hash(new_password).decode('utf-8')
    users_collection.update_one({'username': username}, {'$set': {'password': hashed_password}})
    
    return jsonify({'message': 'Password updated successfully'}), 200

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
def handle_start_searching(data):
    sid = request.sid
    username = data.get('username')
    if not username:
        return

    users[sid] = {'username': username}

    if sid in paired_users:
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
