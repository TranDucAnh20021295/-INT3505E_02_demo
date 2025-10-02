from app import create_app
from models import User, Book, Borrow

app = create_app()

with app.app_context():
    print("=== USERS ===")
    users = User.query.all()
    for user in users:
        print(f"ID: {user.id}, Name: {user.name}")
    
    print("\n=== BOOKS ===")
    books = Book.query.all()
    for book in books:
        print(f"ID: {book.id}, Title: {book.title}, Author: {book.author}, Available: {book.available}")
    
    print("\n=== BORROWS ===")
    borrows = Borrow.query.all()
    for borrow in borrows:
        print(f"ID: {borrow.id}, User: {borrow.user.name}, Book: {borrow.book.title}, Returned: {borrow.returned}")

