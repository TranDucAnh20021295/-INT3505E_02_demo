from flask import Blueprint, request, jsonify
from extensions import db
from models import Book, User, Borrow

bp = Blueprint("api", __name__)

@bp.route("/books", methods=["POST"])
def add_book():
    try:
        data = request.json
        if not data or not data.get("title") or not data.get("author"):
            return jsonify({"error": "Title and author are required"}), 400
        
        book = Book(title=data["title"], author=data["author"])
        db.session.add(book)
        db.session.commit()
        return jsonify({"message": "Book added", "book_id": book.id}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500

@bp.route("/books", methods=["GET"])
def get_books():
    books = Book.query.all()
    return jsonify([{"id": b.id, "title": b.title, "author": b.author, "available": b.available} for b in books])

@bp.route("/users", methods=["POST"])
def add_user():
    try:
        data = request.json
        if not data or not data.get("name"):
            return jsonify({"error": "Name is required"}), 400
        
        user = User(name=data["name"])
        db.session.add(user)
        db.session.commit()
        return jsonify({"message": "User added", "user_id": user.id}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500

@bp.route("/users", methods=["GET"])
def get_users():
    users = User.query.all()
    return jsonify([{"id": u.id, "name": u.name} for u in users])

@bp.route("/borrow", methods=["POST"])
def borrow_book():
    try:
        data = request.json
        if not data or not data.get("user_id") or not data.get("book_id"):
            return jsonify({"error": "user_id and book_id are required"}), 400
        
        user = User.query.get(data["user_id"])
        book = Book.query.get(data["book_id"])
        
        if not user:
            return jsonify({"error": "User not found"}), 404
        if not book:
            return jsonify({"error": "Book not found"}), 404
        if not book.available:
            return jsonify({"error": "Book not available"}), 400
        
        borrow = Borrow(user=user, book=book)
        book.available = False
        db.session.add(borrow)
        db.session.commit()
        return jsonify({"message": f"{user.name} borrowed {book.title}", "borrow_id": borrow.id})
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500

@bp.route("/return/<int:borrow_id>", methods=["POST"])
def return_book(borrow_id):
    try:
        borrow = Borrow.query.get(borrow_id)
        if not borrow:
            return jsonify({"error": "Borrow record not found"}), 404
        if borrow.returned:
            return jsonify({"error": "Book already returned"}), 400
        
        borrow.returned = True
        borrow.book.available = True
        db.session.commit()
        return jsonify({"message": f"{borrow.user.name} returned {borrow.book.title}"})
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500

@bp.route("/borrows", methods=["GET"])
def get_borrows():
    try:
        borrows = Borrow.query.filter_by(returned=False).all()
        return jsonify([{
            "id": b.id,
            "user_name": b.user.name,
            "book_title": b.book.title,
            "book_author": b.book.author,
            "returned": b.returned
        } for b in borrows])
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@bp.route("/borrows/<int:user_id>", methods=["GET"])
def get_user_borrows(user_id):
    try:
        user = User.query.get(user_id)
        if not user:
            return jsonify({"error": "User not found"}), 404
        
        borrows = Borrow.query.filter_by(user_id=user_id).all()
        return jsonify([{
            "id": b.id,
            "book_title": b.book.title,
            "book_author": b.book.author,
            "returned": b.returned
        } for b in borrows])
    except Exception as e:
        return jsonify({"error": str(e)}), 500
