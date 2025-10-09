from flask import Flask, request, jsonify
from flask_sqlalchemy import SQLAlchemy

app = Flask(__name__)
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///library_v1.db'
db = SQLAlchemy(app)

class Book(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(100))
    author = db.Column(db.String(100))

db.create_all()

@app.route('/book', methods=['POST'])
def book_actions():
    data = request.get_json()
    action = data.get('action')

    if action == 'create':
        new_book = Book(title=data['title'], author=data['author'])
        db.session.add(new_book)
        db.session.commit()
        return jsonify({"message": "Book created"}), 201

    elif action == 'get_all':
        books = Book.query.all()
        return jsonify([{"id": b.id, "title": b.title, "author": b.author} for b in books])

    else:
        return jsonify({"error": "Invalid action"}), 400

if __name__ == '__main__':
    app.run(debug=True)
