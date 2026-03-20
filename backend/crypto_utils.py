import os
import base64
import hashlib
from cryptography.fernet import Fernet


def generate_salt() -> str:
    return os.urandom(32).hex()


def derive_fernet_key(password: str, salt_hex: str) -> bytes:
    key = hashlib.pbkdf2_hmac(
        'sha256',
        password.encode('utf-8'),
        bytes.fromhex(salt_hex),
        480_000,
    )
    return base64.urlsafe_b64encode(key)


def encrypt_content(content: str, password: str, salt_hex: str) -> str:
    key = derive_fernet_key(password, salt_hex)
    f = Fernet(key)
    return f.encrypt(content.encode('utf-8')).decode('utf-8')


def decrypt_content(encrypted: str, password: str, salt_hex: str) -> str:
    key = derive_fernet_key(password, salt_hex)
    f = Fernet(key)
    return f.decrypt(encrypted.encode('utf-8')).decode('utf-8')
