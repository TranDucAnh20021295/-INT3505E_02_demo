from flask import Flask, request, jsonify, make_response
from flask_sqlalchemy import SQLAlchemy
import hashlib
from datetime import datetime

app = Flask(__name__)
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///library_v4.db'
db = SQLAlchemy(app)

class Book(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(100))
    author = db.Column(db.String(100))
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def __repr__(self):
        return f'<Book {self.title}>'

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

# Create book
@app.route('/books', methods=['POST'])
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

if __name__ == '__main__':
    with app.app_context():
        db.create_all()
    app.run(debug=True, port=5003)
