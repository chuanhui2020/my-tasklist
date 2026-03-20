from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from werkzeug.security import generate_password_hash, check_password_hash

from database import get_db
from auth_utils import get_current_user
from models import User, SecureNote
from schemas import SecureNoteCreate, SecureNoteUnlock, SecureNoteUpdate
from crypto_utils import generate_salt, encrypt_content, decrypt_content

secure_note_router = APIRouter(prefix='/api/secure-notes')


@secure_note_router.get('')
def list_notes(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    notes = db.query(SecureNote).filter_by(user_id=user.id).order_by(SecureNote.created_at.desc()).all()
    return [n.to_dict() for n in notes]


@secure_note_router.post('')
def create_note(body: SecureNoteCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    if not body.title.strip():
        return JSONResponse({'error': '标题不能为空'}, status_code=400)
    if not body.content.strip():
        return JSONResponse({'error': '内容不能为空'}, status_code=400)
    if not body.password or len(body.password) < 4:
        return JSONResponse({'error': '密码至少4位'}, status_code=400)

    salt = generate_salt()
    encrypted = encrypt_content(body.content, body.password, salt)
    pwd_hash = generate_password_hash(body.password)

    note = SecureNote(
        user_id=user.id,
        title=body.title.strip(),
        encrypted_content=encrypted,
        salt=salt,
        password_hash=pwd_hash,
    )
    db.add(note)
    db.commit()
    db.refresh(note)
    return JSONResponse(note.to_dict(), status_code=201)


@secure_note_router.post('/{note_id}/unlock')
def unlock_note(note_id: int, body: SecureNoteUnlock, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    note = db.query(SecureNote).filter_by(id=note_id, user_id=user.id).first()
    if not note:
        return JSONResponse({'error': '笔记不存在'}, status_code=404)
    if not check_password_hash(note.password_hash, body.password):
        return JSONResponse({'error': '密码错误'}, status_code=403)

    content = decrypt_content(note.encrypted_content, body.password, note.salt)
    result = note.to_dict()
    result['content'] = content
    return result


@secure_note_router.put('/{note_id}')
def update_note(note_id: int, body: SecureNoteUpdate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    note = db.query(SecureNote).filter_by(id=note_id, user_id=user.id).first()
    if not note:
        return JSONResponse({'error': '笔记不存在'}, status_code=404)
    if not check_password_hash(note.password_hash, body.password):
        return JSONResponse({'error': '密码错误'}, status_code=403)
    if not body.title.strip():
        return JSONResponse({'error': '标题不能为空'}, status_code=400)
    if not body.content.strip():
        return JSONResponse({'error': '内容不能为空'}, status_code=400)

    # Determine which password to use for re-encryption
    effective_password = body.new_password if body.new_password and len(body.new_password) >= 4 else body.password

    salt = generate_salt()
    note.title = body.title.strip()
    note.encrypted_content = encrypt_content(body.content, effective_password, salt)
    note.salt = salt
    if body.new_password and len(body.new_password) >= 4:
        note.password_hash = generate_password_hash(body.new_password)

    db.commit()
    db.refresh(note)
    return note.to_dict()


@secure_note_router.delete('/{note_id}')
def delete_note(note_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    note = db.query(SecureNote).filter_by(id=note_id, user_id=user.id).first()
    if not note:
        return JSONResponse({'error': '笔记不存在'}, status_code=404)
    db.delete(note)
    db.commit()
    return {'message': '已删除'}
