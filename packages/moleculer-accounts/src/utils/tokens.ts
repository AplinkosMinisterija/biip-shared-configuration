import jwt, { VerifyErrors } from 'jsonwebtoken';

export function verifyToken<T>(token: string, secret: string) {
  return new Promise<T>((resolve, reject) => {
    jwt.verify(token, secret, (err: VerifyErrors | null, decoded?: any) => {
      if (err) {
        reject(err);
      } else {
        resolve(decoded);
      }
    });
  });
}

export function generateToken(
  payload: { [key: string]: any } | string,
  secret: string,
  expiresIn: number = 60 * 60 * 24, // default expires is 24 hours
) {
  return jwt.sign(payload, secret, { expiresIn });
}
