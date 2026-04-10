import { SignJWT, jwtVerify } from 'jose'

const ALG = 'HS256'
const TOKEN_MAX_AGE = '24h'

function getSecretKey(secret: string): Uint8Array {
  return new TextEncoder().encode(secret)
}

export async function generateToken(payload: { user_id: number; role: string }, secret: string): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: ALG })
    .setIssuedAt()
    .setExpirationTime(TOKEN_MAX_AGE)
    .sign(getSecretKey(secret))
}

export async function verifyToken(token: string, secret: string): Promise<{ user_id: number; role: string } | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey(secret))
    return payload as unknown as { user_id: number; role: string }
  } catch {
    return null
  }
}
