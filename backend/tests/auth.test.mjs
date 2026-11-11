import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPair,SignJWT} from 'jose';
import {verifyGoogleToken} from '../worker/auth.js';
test('Google token verification enforces signature, audience, issuer, expiry, nonce, and verified email',async()=>{
 const {privateKey,publicKey}=await generateKeyPair('RS256');
 async function token(overrides={}) {
  return new SignJWT({sub:'123',email:'person@example.com',email_verified:true,nonce:'challenge',iss:'https://accounts.google.com',aud:'client',iat:Math.floor(Date.now()/1000),exp:Math.floor(Date.now()/1000)+300,...overrides}).setProtectedHeader({alg:'RS256'}).sign(privateKey);
 }
 assert.equal((await verifyGoogleToken(await token(),'client','challenge',publicKey)).id,'google:123');
 for(const overrides of [{aud:'other'},{iss:'https://attacker.example'},{exp:1},{nonce:'wrong'},{email_verified:false}]) await assert.rejects(()=>token(overrides).then(value=>verifyGoogleToken(value,'client','challenge',publicKey)));
 const other=await generateKeyPair('RS256');await assert.rejects(()=>token().then(value=>verifyGoogleToken(value,'client','challenge',other.publicKey)));
});
