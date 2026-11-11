import {createRemoteJWKSet,jwtVerify} from 'jose';
const googleKeys = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'));
export async function verifyGoogleToken(credential,clientId,nonce,keys=googleKeys) {
  const {payload}=await jwtVerify(credential,keys,{issuer:['https://accounts.google.com','accounts.google.com'],audience:clientId,algorithms:['RS256'],requiredClaims:['exp','iat','sub','email','nonce']});
  if (payload.nonce !== nonce || payload.email_verified !== true || typeof payload.email !== 'string' || !payload.sub) throw new Error('Invalid Google identity');
  return {id:'google:'+payload.sub,email:payload.email.toLowerCase(),name:typeof payload.name==='string'?payload.name.slice(0,120):payload.email};
}
export async function digest(value) {
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))].map(byte=>byte.toString(16).padStart(2,'0')).join('');
}
