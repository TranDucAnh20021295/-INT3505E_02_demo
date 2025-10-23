from flask import Flask, request, jsonify, make_response
from flask_sqlalchemy import SQLAlchemy
from flask import send_from_directory
from flask_cors import CORS
from sqlalchemy import or_
import hashlib
from datetime import datetime, timedelta
import jwt
import requests
import time

app = Flask(__name__)
CORS(app)
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///library_v6.db'
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
    user_id = db.Column(db.Integer, db.ForeignKey(User.id))
    book_id = db.Column(db.Integer, db.ForeignKey(Book.id))
    borrow_date = db.Column(db.String(20))
    return_date = db.Column(db.String(20))
    actual_return_date = db.Column(db.String(20))
    status = db.Column(db.String(20), default='borrowed')

    def __repr__(self):
        return f'<Borrow {self.id}>'

# Token cache for external API calls
token_cache = {}

# Search and Pagination Helper functions
def paginate_query(query, offset=0, limit=10):
    # Ensure limit is at least 1
    limit = max(1, limit)
    offset = max(0, offset)
    
    total = query.count()
    items = query.offset(offset).limit(limit).all()
    
    # Calculate pagination info
    pages = (total + limit - 1) // limit
    current_page = (offset // limit) + 1
    
    class PaginationResult:
        def __init__(self, items, total, offset, limit, current_page, pages):
            self.items = items
            self.total = total
            self.offset = offset
            self.limit = limit
            self.page = current_page
            self.pages = pages
            self.has_next = offset + limit < total
            self.has_prev = offset > 0
            self.next_num = current_page + 1 if self.has_next else None
            self.prev_num = current_page - 1 if self.has_prev else None
    
    return PaginationResult(items, total, offset, limit, current_page, pages)

def build_search_filter(model, search_term, search_fields):
    if not search_term:
        return None
    
    search_conditions = []
    for field in search_fields:
        search_conditions.append(getattr(model, field).ilike(f'%{search_term}%'))
    
    return or_(*search_conditions)

def build_response_with_pagination(paginated_result, data_serializer):
    return {
        'data': [data_serializer(item) for item in paginated_result.items],
        'pagination': {
            'offset': paginated_result.offset,
            'limit': paginated_result.limit,
            'total': paginated_result.total,
            'pages': paginated_result.pages,
            'has_next': paginated_result.has_next,
            'has_prev': paginated_result.has_prev,
            'next_num': paginated_result.next_num,
            'prev_num': paginated_result.prev_num
        }
    }

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
    
    try:
        db.session.add(new_user)
        db.session.commit()
        return jsonify({'message': 'User registered successfully'}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'Failed to register user'}), 500

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
    # Get query parameters
    offset = request.args.get('offset', 0, type=int)
    limit = request.args.get('limit', 10, type=int)
    search = request.args.get('search', '', type=str)
    sort_by = request.args.get('sort_by', 'id', type=str)
    sort_order = request.args.get('sort_order', 'asc', type=str)
    
    # Validate pagination parameters
    offset = max(0, offset)
    limit = min(max(1, limit), 100)  # Limit to 100 items
    
    # Build query
    query = User.query
    
    # Apply search filter
    if search:
        search_filter = build_search_filter(User, search, ['name', 'email'])
        if search_filter:
            query = query.filter(search_filter)
    
    # Apply sorting
    if hasattr(User, sort_by):
        sort_column = getattr(User, sort_by)
        if sort_order.lower() == 'desc':
            query = query.order_by(sort_column.desc())
        else:
            query = query.order_by(sort_column.asc())
    else:
        query = query.order_by(User.id.asc())
    
    # Paginate results
    paginated_users = paginate_query(query, offset, limit)
    
    # Serialize data
    def serialize_user(user):
        return {
            'id': user.id, 
            'name': user.name, 
            'email': user.email
        }
    
    # Build response with pagination
    response_data = build_response_with_pagination(paginated_users, serialize_user)
    
    # Add offset/limit info
    response_data['pagination']['offset'] = paginated_users.offset
    response_data['pagination']['limit'] = paginated_users.limit
    
    return jsonify(response_data)

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
    try:
        db.session.add(new_book)
        db.session.commit()
        response = make_response(jsonify({"message": "Book created"}), 201)
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'Failed to create book'}), 500
    
    # Set cache invalidation headers
    response.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate'
    response.headers['Pragma'] = 'no-cache'
    response.headers['Expires'] = '0'
    
    return response

# Read book with search and pagination
@app.route('/books', methods=['GET'])
@require_auth
def get_books():
    # Get query parameters
    offset = request.args.get('offset', 0, type=int)
    limit = request.args.get('limit', 10, type=int)
    search = request.args.get('search', '', type=str)
    sort_by = request.args.get('sort_by', 'id', type=str)
    sort_order = request.args.get('sort_order', 'asc', type=str)
    
    # Validate pagination parameters
    offset = max(0, offset)
    limit = min(max(1, limit), 100)  # Limit to 100 items
    
    # Build query
    query = Book.query
    
    # Apply search filter
    if search:
        search_filter = build_search_filter(Book, search, ['title', 'author'])
        if search_filter:
            query = query.filter(search_filter)
    
    # Apply sorting
    if hasattr(Book, sort_by):
        sort_column = getattr(Book, sort_by)
        if sort_order.lower() == 'desc':
            query = query.order_by(sort_column.desc())
        else:
            query = query.order_by(sort_column.asc())
    else:
        query = query.order_by(Book.id.asc())
    
    # Paginate results
    paginated_books = paginate_query(query, offset, limit)
    
    # Serialize data
    def serialize_book(book):
        return {
            "id": book.id, 
            "title": book.title, 
            "author": book.author,
            "available": book.available,
            "updated_at": book.updated_at.isoformat() if book.updated_at else None
        }
    
    # Build response with pagination
    response_data = build_response_with_pagination(paginated_books, serialize_book)
    
    # Add offset/limit info
    response_data['pagination']['offset'] = paginated_books.offset
    response_data['pagination']['limit'] = paginated_books.limit
    
    # Get the most recent update time for caching
    last_modified = datetime.utcnow()
    if paginated_books.items:
        last_modified = max([book.updated_at for book in paginated_books.items if book.updated_at])
    
    # Generate ETag for caching
    etag = generate_etag(response_data)
    
    # Check if client has cached version
    if check_cache_headers(last_modified, etag):
        response = make_response('', 304)  # Not Modified
        response.headers['ETag'] = etag
        return response
    
    # Prepare response with cache headers
    response = make_response(jsonify(response_data))
    
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
    try:
        book.title = data.get('title', book.title)
        book.author = data.get('author', book.author)
        book.updated_at = datetime.utcnow()  # Update timestamp
        db.session.commit()
        response = make_response(jsonify({"message": "Book updated"}))
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'Failed to update book'}), 500
    
    # Set cache invalidation headers
    response.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate'
    response.headers['Pragma'] = 'no-cache'
    response.headers['Expires'] = '0'
    
    return response

# Delete book
@app.route('/books/<int:id>', methods=['DELETE'])
@require_auth
def delete_book(id):
    try:
        book = Book.query.get_or_404(id)
        db.session.delete(book)
        db.session.commit()
        response = make_response(jsonify({"message": "Book deleted"}))
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'Failed to delete book'}), 500
    
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
    user = User.query.get_or_404(data['user_id'])
    
    # Validate book exists
    book = Book.query.get_or_404(data['book_id'])
    
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
    
    try:
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
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'Failed to create loan'}), 500

# Return book - RESTful approach with loan ID
@app.route('/loans/<int:loan_id>/return', methods=['PUT'])
@require_auth
def return_loan(loan_id):
    data = request.get_json()
    
    # Find the borrow record by loan ID
    borrow_record = Borrow.query.get_or_404(loan_id)
    
    if borrow_record.status != 'borrowed':
        return jsonify({"error": "Loan is not active"}), 400
    
    # Find the book from loan record
    book = Book.query.get_or_404(borrow_record.book_id)
    
    try:
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
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'Failed to return loan'}), 500

# GET all loans with search and pagination - RESTful resource
@app.route('/loans', methods=['GET'])
@require_auth
def get_loans():
    # Get query parameters
    offset = request.args.get('offset', 0, type=int)
    limit = request.args.get('limit', 10, type=int)
    search = request.args.get('search', '', type=str)
    status = request.args.get('status', '', type=str)
    user_id = request.args.get('user_id', None, type=int)
    book_id = request.args.get('book_id', None, type=int)
    sort_by = request.args.get('sort_by', 'id', type=str)
    sort_order = request.args.get('sort_order', 'desc', type=str)
    
    # Validate pagination parameters
    offset = max(0, offset)
    limit = min(max(1, limit), 100)  # Limit to 100 items
    
    # Build query with joins
    query = db.session.query(Borrow).join(User).join(Book)
    
    # Apply search filter
    if search:
        search_filter = build_search_filter(Borrow, search, ['borrow_date', 'return_date', 'status'])
        if search_filter:
            query = query.filter(search_filter)
    
    # Apply status filter
    if status:
        query = query.filter(Borrow.status == status)
    
    # Apply user_id filter
    if user_id:
        query = query.filter(Borrow.user_id == user_id)
    
    # Apply book_id filter
    if book_id:
        query = query.filter(Borrow.book_id == book_id)
    
    # Apply sorting
    if hasattr(Borrow, sort_by):
        sort_column = getattr(Borrow, sort_by)
        if sort_order.lower() == 'desc':
            query = query.order_by(sort_column.desc())
        else:
            query = query.order_by(sort_column.asc())
    else:
        query = query.order_by(Borrow.id.desc())
    
    # Paginate results
    paginated_loans = paginate_query(query, offset, limit)
    
    # Serialize data with related information
    def serialize_loan(loan):
        return {
            "id": loan.id,
            "user_id": loan.user_id,
            "book_id": loan.book_id,
            "borrow_date": loan.borrow_date,
            "return_date": loan.return_date,
            "actual_return_date": loan.actual_return_date,
            "status": loan.status
        }
    
    # Build response with pagination
    response_data = build_response_with_pagination(paginated_loans, serialize_loan)
    
    # Add offset/limit info
    response_data['pagination']['offset'] = paginated_loans.offset
    response_data['pagination']['limit'] = paginated_loans.limit
    
    return jsonify(response_data)

# GET specific loan - RESTful resource
@app.route('/loans/<int:loan_id>', methods=['GET'])
@require_auth
def get_loan(loan_id):
    borrow = Borrow.query.get_or_404(loan_id)
    
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

# Advanced search endpoint
@app.route('/search', methods=['GET'])
@require_auth
def advanced_search():
    search_term = request.args.get('q', '', type=str)
    entity_type = request.args.get('type', 'all', type=str)  # all, books, users, loans
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 10, type=int)
    
    # Validate parameters
    page = max(1, page)
    per_page = min(max(1, per_page), 50)  # Limit to 50 for search results
    
    results = {
        'query': search_term,
        'entity_type': entity_type,
        'results': []
    }
    
    if not search_term:
        return jsonify(results)
    
    # Search books
    if entity_type in ['all', 'books']:
        book_query = Book.query
        book_filter = build_search_filter(Book, search_term, ['title', 'author'])
        if book_filter:
            book_query = book_query.filter(book_filter)
        
        book_results = book_query.limit(per_page).all()
        for book in book_results:
            results['results'].append({
                'type': 'book',
                'id': book.id,
                'title': book.title,
                'author': book.author,
                'available': book.available
            })
    
    # Search users
    if entity_type in ['all', 'users']:
        user_query = User.query
        user_filter = build_search_filter(User, search_term, ['name', 'email'])
        if user_filter:
            user_query = user_query.filter(user_filter)
        
        user_results = user_query.limit(per_page).all()
        for user in user_results:
            results['results'].append({
                'type': 'user',
                'id': user.id,
                'name': user.name,
                'email': user.email
            })
    
    # Search loans
    if entity_type in ['all', 'loans']:
        loan_query = Borrow.query
        loan_filter = build_search_filter(Borrow, search_term, ['borrow_date', 'return_date', 'status'])
        if loan_filter:
            loan_query = loan_query.filter(loan_filter)
        
        loan_results = loan_query.limit(per_page).all()
        for loan in loan_results:
            results['results'].append({
                'type': 'loan',
                'id': loan.id,
                'user_id': loan.user_id,
                'book_id': loan.book_id,
                'status': loan.status,
                'borrow_date': loan.borrow_date
            })
    
    return jsonify(results)

# Statistics endpoint
@app.route('/stats', methods=['GET'])
@require_auth
def get_statistics():
    stats = {
        'books': {
            'total': Book.query.count(),
            'available': Book.query.filter(Book.available > 0).count(),
            'borrowed': Book.query.filter(Book.available == 0).count()
        },
        'users': {
            'total': User.query.count()
        },
        'loans': {
            'total': Borrow.query.count(),
            'active': Borrow.query.filter(Borrow.status == 'borrowed').count(),
            'returned': Borrow.query.filter(Borrow.status == 'returned').count()
        }
    }
    
    return jsonify(stats)

if __name__ == '__main__':
    with app.app_context():
        db.create_all()
    app.run(debug=True, port=5005)
