import sys
import os

# 禁用 Python 输出缓冲，确保 print 立即显示
os.environ['PYTHONUNBUFFERED'] = '1'

from flask import Flask
from flask_cors import CORS
from sqlalchemy import inspect, text
from config import Config
from models import db, User
from routes.task_routes import task_bp
from routes.auth_routes import auth_bp
from routes.fortune_routes import fortune_bp
from routes.bmi_routes import bmi_bp

app = Flask(__name__)
app.config.from_object(Config)

CORS(app)
db.init_app(app)

app.register_blueprint(auth_bp, url_prefix='/api')
app.register_blueprint(task_bp, url_prefix='/api')
app.register_blueprint(fortune_bp, url_prefix='/api/fortune')
app.register_blueprint(bmi_bp, url_prefix='/api/bmi')

with app.app_context():
    db.create_all()

    inspector = inspect(db.engine)
    user_columns = {col['name']: col for col in inspector.get_columns('users')}
    password_col = user_columns.get('password_hash')
    if password_col and getattr(password_col.get('type'), 'length', 512) < 512:
        db.session.execute(text('ALTER TABLE users MODIFY password_hash VARCHAR(512) NOT NULL'))
        db.session.commit()
        inspector = inspect(db.engine)

    admin = User.query.filter_by(username='admin').first()
    if not admin:
        admin = User(username='admin', role='admin')
        admin.set_password('123456')
        db.session.add(admin)
        db.session.commit()

    inspector = inspect(db.engine)
    task_columns = {col['name']: col for col in inspector.get_columns('tasks')}
    if 'user_id' not in task_columns:
        db.session.execute(text('ALTER TABLE tasks ADD COLUMN user_id INT NULL'))
        db.session.commit()
        inspector = inspect(db.engine)
        task_columns = {col['name']: col for col in inspector.get_columns('tasks')}

    if 'user_id' in task_columns:
        db.session.execute(
            text('UPDATE tasks SET user_id = :admin_id WHERE user_id IS NULL'),
            {'admin_id': admin.id}
        )
        db.session.commit()
        if task_columns['user_id'].get('nullable', False):
            db.session.execute(text('ALTER TABLE tasks MODIFY user_id INT NOT NULL'))
            db.session.commit()
        inspector = inspect(db.engine)
        indexes = inspector.get_indexes('tasks')
        if not any(idx['name'] == 'idx_tasks_user' for idx in indexes):
            try:
                db.session.execute(text('ALTER TABLE tasks ADD INDEX idx_tasks_user (user_id)'))
                db.session.commit()
            except Exception:
                db.session.rollback()

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
