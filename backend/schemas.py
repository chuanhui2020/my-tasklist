from pydantic import BaseModel
from typing import Optional


class LoginRequest(BaseModel):
    username: str = ''
    password: str = ''


class TaskCreate(BaseModel):
    title: str = ''
    description: str = ''
    due_date: Optional[str] = None


class TaskUpdate(BaseModel):
    title: str = ''
    description: str = ''
    due_date: Optional[str] = None


class TaskStatusUpdate(BaseModel):
    status: str = ''


class UserCreate(BaseModel):
    username: str = ''
    password: str = ''
    role: str = 'user'


class ChangePassword(BaseModel):
    old_password: str = ''
    new_password: str = ''


class BmiRequest(BaseModel):
    age: int = 0
    height: float = 0
    weight: float = 0
    bmi: float = 0


class FortuneRequest(BaseModel):
    fortuneNumber: int = 1
