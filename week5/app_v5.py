from flask import Flask, request, jsonify, make_response
from flask_sqlalchemy import SQLAlchemy
from flask import send_from_directory
from flask_cors import CORS
import hashlib
from datetime import datetime, timedelta
import jwt
import requests
import time

app = Flask(__name__)
CORS(app)
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///library_v5.db'
app.config['JWT_SECRET_KEY'] = 'your-secret-key-change-in-production'
app.config['JWT_ACCESS_TOKEN_EXPIRES'] = timedelta(hours=1)
db = SQLAlchemy(app)

class Book(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(100))
    author = db.Column(db.String(100))
    available = db.Column(db.Integer, default=1)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def __repr__(self):
        return f'<Book {self.title}>'

class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100))
    email = db.Column(db.String(100), unique=True)
    password = db.Column(db.String(100))

    def __repr__(self):
        return f'<User {self.email}>'

class Borrow(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'))
    book_id = db.Column(db.Integer, db.ForeignKey('book.id'))
    borrow_date = db.Column(db.String(20))
    return_date = db.Column(db.String(20))
    actual_return_date = db.Column(db.String(20))
    status = db.Column(db.String(20), default='borrowed')

    def __repr__(self):
        return f'<Borrow {self.id}>'

# Token cache for external API calls
token_cache = {}

@app.route("/static/openapi.yml")
def serve_openapi():
    return send_from_directory("static", "openapi.yml")

@app.route("/swagger")
def swagger_ui():
    # Trang Swagger UI
    return '''
    <!DOCTYPE html>
    <html>
    <head>
      <title>Swagger UI</title>
      <link rel="stylesheet" type="text/css" href="https://unpkg.com/swagger-ui-dist/swagger-ui.css" />
      <script src="https://unpkg.com/swagger-ui-dist/swagger-ui-bundle.js"></script>
    </head>
    <body>
      <div id="swagger-ui"></div>
      <script>
        const ui = SwaggerUIBundle({
          url: "/static/openapi.yml", // load file YAML
          dom_id: '#swagger-ui'
        });
      </script>
    </body>
    </html>
    '''

# JWT Helper functions
def generate_jwt_token(user_id, email):
    payload = {
        'user_id': user_id,
        'email': email,
        'exp': datetime.utcnow() + app.config['JWT_ACCESS_TOKEN_EXPIRES'],
        'iat': datetime.utcnow()
    }
    return jwt.encode(payload, app.config['JWT_SECRET_KEY'], algorithm='HS256')

def verify_jwt_token(token):
    try:
        payload = jwt.decode(token, app.config['JWT_SECRET_KEY'], algorithms=['HS256'])
        return payload
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None

def get_cached_token(api_name):
    if api_name in token_cache:
        token_data = token_cache[api_name]
        # Check if token is still valid (not expired)
        if time.time() < token_data['expires_at']:
            return token_data['token']
        else:
            # Remove expired token
            del token_cache[api_name]
    return None

def cache_token(api_name, token, expires_in_seconds=3600):
    token_cache[api_name] = {
        'token': token,
        'expires_at': time.time() + expires_in_seconds
    }

def require_auth(f):
    def decorated_function(*args, **kwargs):
        token = request.headers.get('Authorization')
        if not token:
            return jsonify({'error': 'Token is missing'}), 401
        
        if token.startswith('Bearer '):
            token = token[7:]
        
        user_info = verify_jwt_token(token)
        if not user_info:
            return jsonify({'error': 'Invalid or expired token'}), 401
        
        # Add user info to request context
        request.current_user = user_info
        return f(*args, **kwargs)
    
    decorated_function.__name__ = f.__name__
    return decorated_function

# Helper function to generate ETag
def generate_etag(data):
    # Generate ETag based on data content
    content = str(data)
    return hashlib.md5(content.encode('utf-8')).hexdigest()

# Helper function to check if client has cached version
def check_cache_headers(last_modified, etag):
    # Check if client has cached version
    if_modified_since = request.headers.get('If-Modified-Since')
    if_none_match = request.headers.get('If-None-Match')
    
    # Check ETag first
    if if_none_match and if_none_match == etag:
        return True
    
    # Check Last-Modified
    if if_modified_since:
        try:
            client_modified = datetime.strptime(if_modified_since, '%a, %d %b %Y %H:%M:%S GMT')
            if client_modified >= last_modified:
                return True
        except ValueError:
            pass
    
    return False

# Authentication endpoints
@app.route('/register', methods=['POST'])
def register():
    data = request.get_json()
    
    # Check if user already exists
    if User.query.filter_by(email=data['email']).first():
        return jsonify({'error': 'User already exists'}), 409
    
    # Create new user
    new_user = User(
        name=data['name'],
        email=data['email'],
        password=data['password']  # In production, hash the password
    )
    
    db.session.add(new_user)
    db.session.commit()
    
    return jsonify({'message': 'User registered successfully'}), 201

@app.route('/login', methods=['POST'])
def login():
    data = request.get_json()
    
    # Validate user credentials
    user = User.query.filter_by(email=data['email'], password=data['password']).first()
    if not user:
        return jsonify({'error': 'Invalid credentials'}), 401
    
    # Generate JWT token
    token = generate_jwt_token(user.id, user.email)
    
    return jsonify({
        'message': 'Login successful',
        'token': token,
        'user': {
            'id': user.id,
            'name': user.name,
            'email': user.email
        }
    })

@app.route('/users', methods=['GET'])
@require_auth
def get_users():
    users = User.query.all()
    return jsonify([{
        'id': u.id, 
        'name': u.name, 
        'email': u.email
    } for u in users])

# External API integration with token cache
@app.route('/external-api/<api_name>', methods=['GET'])
@require_auth
def call_external_api(api_name):
    
    # Try to get cached token first
    cached_token = get_cached_token(api_name)
    
    if not cached_token:
        # Simulate getting token from external API
        # In real scenario, you would call the external API's auth endpoint
        external_token = f"external_token_{api_name}_{int(time.time())}"
        cache_token(api_name, external_token, expires_in_seconds=3600)
        cached_token = external_token
    
    # Simulate calling external API with token
    # In real scenario, you would make actual HTTP request
    external_data = {
        'api_name': api_name,
        'token_used': cached_token,
        'timestamp': datetime.utcnow().isoformat(),
        'user_id': request.current_user['user_id']
    }
    
    return jsonify({
        'message': f'Called external API {api_name}',
        'data': external_data
    })

# Create book
@app.route('/books', methods=['POST'])
@require_auth
def create_book():
    data = request.get_json()
    new_book = Book(title=data['title'], author=data['author'])
    db.session.add(new_book)
    db.session.commit()
    
    response = make_response(jsonify({"message": "Book created"}), 201)
    
    # Set cache invalidation headers
    response.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate'
    response.headers['Pragma'] = 'no-cache'
    response.headers['Expires'] = '0'
    
    return response

# Read book
@app.route('/books', methods=['GET'])
@require_auth
def get_books():

    books = Book.query.all()
    books_data = [{"id": b.id, "title": b.title, "author": b.author} for b in books]
    
    # Get the most recent update time
    last_modified = datetime.utcnow()
    if books:
        last_modified = max([book.updated_at for book in books if book.updated_at])
    
    # Generate ETag
    etag = generate_etag(books_data)
    
    # Check if client has cached version
    if check_cache_headers(last_modified, etag):
        response = make_response('', 304)  # Not Modified
        response.headers['ETag'] = etag
        return response
    
    # Prepare response with cache headers
    response = make_response(jsonify(books_data))
    
    # Set cache headers
    response.headers['ETag'] = etag
    response.headers['Last-Modified'] = last_modified.strftime('%a, %d %b %Y %H:%M:%S GMT')
    response.headers['Cache-Control'] = 'public, max-age=300'  # Cache for 5 minutes
    response.headers['Vary'] = 'Accept, Accept-Encoding'
    
    return response

# Update book
@app.route('/books/<int:id>', methods=['PUT'])
@require_auth
def update_book(id):
    data = request.get_json()
    book = Book.query.get_or_404(id)
    book.title = data.get('title', book.title)
    book.author = data.get('author', book.author)
    book.updated_at = datetime.utcnow()  # Update timestamp
    db.session.commit()
    
    response = make_response(jsonify({"message": "Book updated"}))
    
    # Set cache invalidation headers
    response.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate'
    response.headers['Pragma'] = 'no-cache'
    response.headers['Expires'] = '0'
    
    return response

# Delete book
@app.route('/books/<int:id>', methods=['DELETE'])
@require_auth
def delete_book(id):
    book = Book.query.get_or_404(id)
    db.session.delete(book)
    db.session.commit()
    
    response = make_response(jsonify({"message": "Book deleted"}))
    
    # Set cache invalidation headers
    response.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate'
    response.headers['Pragma'] = 'no-cache'
    response.headers['Expires'] = '0'
    
    return response

# Read book by ID
@app.route('/books/<int:id>', methods=['GET'])
@require_auth
def get_book(id):
    
    book = Book.query.get_or_404(id)
    book_data = {"id": book.id, "title": book.title, "author": book.author}
    
    # Generate ETag for single book
    etag = generate_etag(book_data)
    last_modified = book.updated_at or datetime.utcnow()
    
    # Check if client has cached version
    if check_cache_headers(last_modified, etag):
        response = make_response('', 304)  # Not Modified
        response.headers['ETag'] = etag
        return response
    
    # Prepare response with cache headers
    response = make_response(jsonify(book_data))
    response.headers['ETag'] = etag
    response.headers['Last-Modified'] = last_modified.strftime('%a, %d %b %Y %H:%M:%S GMT')
    response.headers['Cache-Control'] = 'public, max-age=300'  # Cache for 5 minutes
    
    return response

# Loan management - RESTful resource
@app.route('/loans', methods=['POST'])
@require_auth
def create_loan():
    data = request.get_json()
    
    # Validate user exists
    user = User.query.get(data['user_id'])
    if not user:
        return jsonify({"error": "User not found"}), 404
    
    # Validate book exists
    book = Book.query.get(data['book_id'])
    if not book:
        return jsonify({"error": "Book not found"}), 404
    
    # Check if book is available
    if book.available <= 0:
        return jsonify({"error": "Book not available"}), 409
    
    # Check if user already borrowed this book exists       
    existing_borrow = Borrow.query.filter_by(
        user_id=data['user_id'], 
        book_id=data['book_id'], 
        status='borrowed'
    ).first()

    if existing_borrow:
        return jsonify({"error": "User already borrowed this book"}), 409
    
    # Create borrow record
    new_borrow = Borrow(
        user_id=data['user_id'],
        book_id=data['book_id'],
        borrow_date=data['borrow_date'],
        return_date=data['return_date']
    )
    
    db.session.add(new_borrow)
    book.available -= 1
    db.session.commit()
    return jsonify({
        "message": "Loan created successfully",
        "borrow": {
            "id": new_borrow.id,
            "user_id": new_borrow.user_id,
            "book_id": new_borrow.book_id,
            "borrow_date": new_borrow.borrow_date,
            "return_date": new_borrow.return_date,
            "status": new_borrow.status
        },
        "book": {
            "id": book.id,
            "title": book.title,
            "author": book.author,
            "available": book.available
        }
    }), 201

# Return book - RESTful approach with loan ID
@app.route('/loans/<int:loan_id>/return', methods=['PUT'])
@require_auth
def return_loan(loan_id):
    data = request.get_json()
    
    # Find the borrow record by loan ID
    borrow_record = Borrow.query.get(loan_id)
    
    if not borrow_record:
        return jsonify({"error": "Loan not found"}), 404
    
    if borrow_record.status != 'borrowed':
        return jsonify({"error": "Loan is not active"}), 400
    
    # Find the book from loan record
    book = Book.query.get(borrow_record.book_id)
    if not book:
        return jsonify({"error": "Book not found"}), 404
    
    # Update borrow record
    borrow_record.actual_return_date = data['actual_return_date']
    borrow_record.status = 'returned'
    
    # Update book availability
    book.available += 1
    
    db.session.commit()
    
    return jsonify({
        "message": "Loan returned successfully",
        "borrow": {
            "id": borrow_record.id,
            "user_id": borrow_record.user_id,
            "book_id": borrow_record.book_id,
            "borrow_date": borrow_record.borrow_date,
            "return_date": borrow_record.return_date,
            "actual_return_date": borrow_record.actual_return_date,
            "status": borrow_record.status
        },
        "book": {
            "id": book.id,
            "title": book.title,
            "author": book.author,
            "available": book.available
        }
    })

# GET all loans - RESTful resource
@app.route('/loans', methods=['GET'])
@require_auth
def get_loans():
    borrows = Borrow.query.all()
    return jsonify([{
        "id": b.id,
        "user_id": b.user_id,
        "book_id": b.book_id,
        "borrow_date": b.borrow_date,
        "return_date": b.return_date,
        "actual_return_date": b.actual_return_date,
        "status": b.status
    } for b in borrows])

# GET specific loan - RESTful resource
@app.route('/loans/<int:loan_id>', methods=['GET'])
@require_auth
def get_loan(loan_id):
    borrow = Borrow.query.get(loan_id)
    if not borrow:
        return jsonify({"error": "Loan not found"}), 404
    
    return jsonify({
        "id": borrow.id,
        "user_id": borrow.user_id,
        "book_id": borrow.book_id,
        "borrow_date": borrow.borrow_date,
        "return_date": borrow.return_date,
        "actual_return_date": borrow.actual_return_date,
        "status": borrow.status
    })

# Legacy endpoint for backward compatibility
@app.route('/borrows', methods=['GET'])
@require_auth
def get_borrows():
    return get_loans()

if __name__ == '__main__':
    with app.app_context():
        db.create_all()
    app.run(debug=True, port=5004)
