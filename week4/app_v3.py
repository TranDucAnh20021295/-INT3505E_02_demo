from flask import Flask, request, jsonify
from flask_sqlalchemy import SQLAlchemy
from datetime import datetime

app = Flask(__name__)
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///library_v3.db'
db = SQLAlchemy(app)

class Book(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(100))
    author = db.Column(db.String(100))
    available = db.Column(db.Integer, default=1)

class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100))
    email = db.Column(db.String(100), unique=True)

class Borrow(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'))
    book_id = db.Column(db.Integer, db.ForeignKey('book.id'))
    borrow_date = db.Column(db.String(20))
    return_date = db.Column(db.String(20))
    actual_return_date = db.Column(db.String(20))
    status = db.Column(db.String(20), default='borrowed')

db.create_all()

# ===== BOOK MANAGEMENT =====

@app.route('/books', methods=['POST'])
def create_book():
    data = request.get_json()
    new_book = Book(title=data['title'], author=data['author'])
    db.session.add(new_book)
    db.session.commit()
    return jsonify({"message": "Book created"}), 201

@app.route('/books', methods=['GET'])
def get_books():
    books = Book.query.all()
    return jsonify([{"id": b.id, "title": b.title, "author": b.author, "available": b.available} for b in books])

@app.route('/books/<int:id>', methods=['PUT'])
def update_book(id):
    data = request.get_json()
    book = Book.query.get_or_404(id)
    book.title = data.get('title', book.title)
    book.author = data.get('author', book.author)
    db.session.commit()
    return jsonify({"message": "Book updated"})

@app.route('/books/<int:id>', methods=['DELETE'])
def delete_book(id):
    book = Book.query.get_or_404(id)
    db.session.delete(book)
    db.session.commit()
    return jsonify({"message": "Book deleted"})

# ===== USER MANAGEMENT =====

@app.route('/users', methods=['POST'])
def create_user():
    data = request.get_json()
    new_user = User(name=data['name'], email=data['email'])
    db.session.add(new_user)
    db.session.commit()
    return jsonify({"message": "User created"}), 201

@app.route('/users', methods=['GET'])
def get_users():
    users = User.query.all()
    return jsonify([{"id": u.id, "name": u.name, "email": u.email} for u in users])

# ===== BORROW/RETURN (Stateless) =====

@app.route('/borrow', methods=['POST'])
def borrow_book():
    """
    Mượn sách - Stateless operation
    Mỗi request chứa đủ thông tin: user_id, book_id, borrow_date, return_date
    """
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
    
    # Check if user already borrowed this book
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
    
    # Update book availability
    book.available -= 1
    
    db.session.commit()
    
    return jsonify({
        "message": "Book borrowed successfully",
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

@app.route('/return', methods=['POST'])
def return_book():
    """
    Trả sách - Stateless operation
    Mỗi request chứa đủ thông tin: user_id, book_id, actual_return_date
    """
    data = request.get_json()
    
    # Find the borrow record
    borrow_record = Borrow.query.filter_by(
        user_id=data['user_id'],
        book_id=data['book_id'],
        status='borrowed'
    ).first()
    
    if not borrow_record:
        return jsonify({"error": "No active borrow record found"}), 404
    
    # Find the book
    book = Book.query.get(data['book_id'])
    if not book:
        return jsonify({"error": "Book not found"}), 404
    
    # Update borrow record
    borrow_record.actual_return_date = data['actual_return_date']
    borrow_record.status = 'returned'
    
    # Update book availability
    book.available += 1
    
    db.session.commit()
    
    return jsonify({
        "message": "Book returned successfully",
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

@app.route('/borrows', methods=['GET'])
def get_borrows():
    """Lấy danh sách mượn/trả sách"""
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

@app.route('/', methods=['GET'])
def home():
    """API Documentation"""
    return jsonify({
        'message': 'Library Management System - Version 3',
        'description': 'Stateless + Borrow/Return - Mỗi request chứa đủ thông tin',
        'endpoints': {
            'Books': {
                'POST /books': 'Create book (title, author)',
                'GET /books': 'Get all books',
                'PUT /books/<id>': 'Update book',
                'DELETE /books/<id>': 'Delete book'
            },
            'Users': {
                'POST /users': 'Create user (name, email)',
                'GET /users': 'Get all users'
            },
            'Borrow/Return': {
                'POST /borrow': 'Borrow book (user_id, book_id, borrow_date, return_date)',
                'POST /return': 'Return book (user_id, book_id, actual_return_date)',
                'GET /borrows': 'Get all borrow records'
            }
        },
        'examples': {
            'borrow_book': {
                'method': 'POST',
                'url': '/borrow',
                'body': {
                    'user_id': 1,
                    'book_id': 1,
                    'borrow_date': '2024-01-01',
                    'return_date': '2024-01-15'
                }
            },
            'return_book': {
                'method': 'POST',
                'url': '/return',
                'body': {
                    'user_id': 1,
                    'book_id': 1,
                    'actual_return_date': '2024-01-14'
                }
            }
        }
    })


if __name__ == '__main__':
    app.run(debug=True)
