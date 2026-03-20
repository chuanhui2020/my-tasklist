import json
from datetime import datetime
from werkzeug.security import generate_password_hash, check_password_hash
from sqlalchemy import Integer, String, Text, Enum, DateTime, Date, Float, ForeignKey, func
from sqlalchemy.orm import relationship, Mapped, mapped_column
from database import Base


class User(Base):
    __tablename__ = 'users'

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    username: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(512), nullable=False)
    role: Mapped[str] = mapped_column(Enum('admin', 'user'), default='user', nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    tasks = relationship('Task', backref='owner', lazy=True)
    fortune_records = relationship('FortuneRecord', backref='user', lazy=True)
    secure_notes = relationship('SecureNote', backref='user', lazy=True)

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

    def to_dict(self):
        return {
            'id': self.id,
            'username': self.username,
            'role': self.role,
            'created_at': self.created_at.strftime('%Y-%m-%d %H:%M:%S')
        }


class Task(Base):
    __tablename__ = 'tasks'

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description = mapped_column(Text)
    status: Mapped[str] = mapped_column(Enum('pending', 'done'), default='pending')
    due_date = mapped_column(Date)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey('users.id'), nullable=False)

    def to_dict(self):
        return {
            'id': self.id,
            'title': self.title,
            'description': self.description,
            'status': self.status,
            'due_date': self.due_date.strftime('%Y-%m-%d') if self.due_date else None,
            'created_at': self.created_at.strftime('%Y-%m-%d %H:%M:%S'),
            'user_id': self.user_id
        }


class BmiProfile(Base):
    __tablename__ = 'bmi_profiles'

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey('users.id'), unique=True, nullable=False)
    gender: Mapped[str] = mapped_column(String(10), default='male', nullable=False)
    age: Mapped[int] = mapped_column(Integer, default=28, nullable=False)
    height: Mapped[int] = mapped_column(Integer, default=170, nullable=False)
    weight: Mapped[float] = mapped_column(Float, default=65.0, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self):
        return {
            'gender': self.gender,
            'age': self.age,
            'height': self.height,
            'weight': float(self.weight),
        }


class FortuneRecord(Base):
    __tablename__ = 'fortune_records'

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey('users.id'), nullable=False)
    fortune_number: Mapped[int] = mapped_column(Integer, nullable=False)
    fortune_type: Mapped[str] = mapped_column(String(20), nullable=False)
    type_text: Mapped[str] = mapped_column(String(20), nullable=False)
    poem = mapped_column(Text, nullable=False)
    interpretation = mapped_column(Text, nullable=False)
    advice = mapped_column(Text, nullable=False)
    work_fortune = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    def to_dict(self):
        try:
            advice_list = json.loads(self.advice)
        except (json.JSONDecodeError, TypeError):
            advice_list = []
        return {
            'id': self.id,
            'fortuneNumber': self.fortune_number,
            'type': self.fortune_type,
            'typeText': self.type_text,
            'poem': self.poem,
            'interpretation': self.interpretation,
            'advice': advice_list,
            'work_fortune': self.work_fortune or '',
            'created_at': self.created_at.strftime('%Y-%m-%d %H:%M:%S')
        }


class SecureNote(Base):
    __tablename__ = 'secure_notes'

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey('users.id'), nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    encrypted_content = mapped_column(Text, nullable=False)
    salt: Mapped[str] = mapped_column(String(64), nullable=False)
    password_hash: Mapped[str] = mapped_column(String(512), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())

    def to_dict(self):
        return {
            'id': self.id,
            'title': self.title,
            'created_at': self.created_at.strftime('%Y-%m-%d %H:%M:%S'),
            'updated_at': self.updated_at.strftime('%Y-%m-%d %H:%M:%S') if self.updated_at else None,
        }
