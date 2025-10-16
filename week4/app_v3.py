from flask import Flask, request, jsonify
from flask_sqlalchemy import SQLAlchemy
from datetime import datetime
from flask import send_from_directory
from flask import Flask, send_from_directory

app = Flask(__name__)

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
    password = db.Column(db.String(100))

class Borrow(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'))
    book_id = db.Column(db.Integer, db.ForeignKey('book.id'))
    borrow_date = db.Column(db.String(20))
    return_date = db.Column(db.String(20))
    actual_return_date = db.Column(db.String(20))
    status = db.Column(db.String(20), default='borrowed')

# Create book
@app.route('/books', methods=['POST'])
def create_book():
    data = request.get_json()
    new_book = Book(title=data['title'], author=data['author'])
    db.session.add(new_book)
    db.session.commit()
    return jsonify({"message": "Book created"}), 201

# Read book
@app.route('/books', methods=['GET'])
def get_books():
    books = Book.query.all()
    return jsonify([{"id": b.id, "title": b.title, "author": b.author} for b in books])

# Update book
@app.route('/books/<int:id>', methods=['PUT'])
def update_book(id):
    data = request.get_json()
    book = Book.query.get_or_404(id)
    book.title = data.get('title', book.title)
    book.author = data.get('author', book.author)
    db.session.commit()
    return jsonify({"message": "Book updated"})

# Delete book
@app.route('/books/<int:id>', methods=['DELETE'])
def delete_book(id):
    book = Book.query.get_or_404(id)
    db.session.delete(book)
    db.session.commit()
    return jsonify({"message": "Book deleted"})

# Create user
@app.route('/users', methods=['POST'])
def create_user():
    data = request.get_json()
    new_user = User(name=data['name'], email=data['email'], password=data['password'])
    db.session.add(new_user)
    db.session.commit()
    return jsonify({"message": "User created"}), 201

@app.route('/login', methods=['POST'])
def login():
    data = request.get_json()
    
    # Validate user credentials
    user = User.query.filter_by(email=data['email'], password=data['password']).first()
    if not user:
        return jsonify({"error": "Invalid credentials"}), 401
    
    # Stateless: Trả về user info, client tự quản lý
    return jsonify({
        "message": "Login successful",
        "user": {
            "id": user.id,
            "name": user.name,
            "email": user.email
        }
    })

# Read user
@app.route('/users', methods=['GET'])
def get_users():
    users = User.query.all()
    return jsonify([{"id": u.id, "name": u.name, "email": u.email} for u in users])

# Loan management - RESTful resource
@app.route('/loans', methods=['POST'])
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
def get_borrows():
    return get_loans()
if __name__ == '__main__':
    with app.app_context():
        db.create_all()
    app.run(debug=True, port=5002)
