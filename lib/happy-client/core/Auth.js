/**
 * 认证管理模块
 */
const crypto = require('crypto');
const axios = require('axios');
const CryptoUtils = require('../utils/CryptoUtils');
const KeyUtils = require('../utils/KeyUtils');

class Auth {
  constructor(options = {}) {
    this.options = options;
    this.apiKey = options.apiKey || null;
  }
  
  /**
   * 标准化 Secret Key
   */
  normalizeSecretKey(key) {
    return KeyUtils.normalizeSecretKey(key);
  }
  
  /**
   * 生成挑战签名
   */
  async authChallenge(secret) {
    console.log('[Auth.authChallenge] Initializing sodium...');
    await CryptoUtils.initSodium();
    console.log('[Auth.authChallenge] Sodium initialized');
    const sodium = CryptoUtils.getSodium();
    
    console.log('[Auth.authChallenge] Generating keypair...');
    const keypair = sodium.crypto_sign_seed_keypair(secret);
    const challenge = crypto.randomBytes(32);
    const signature = sodium.crypto_sign_detached(challenge, keypair.privateKey);
    console.log('[Auth.authChallenge] Challenge signed');
    
    return { challenge, signature, publicKey: keypair.publicKey };
  }
  
  /**
   * 从 Secret Key 获取 Token
   */
  async getToken(secret, serverUrl) {
    try {
      console.log('[Auth.getToken] Starting, serverUrl:', serverUrl);
      const authUrl = `${serverUrl}/v1/auth`;
      
      console.log('[Auth.getToken] Generating auth challenge...');
      const { challenge, signature, publicKey } = await this.authChallenge(secret);
      console.log('[Auth.getToken] Challenge generated');
      
      // 构建请求头（包含 API Key）
      const headers = {};
      if (this.apiKey) {
        headers['X-API-Key'] = this.apiKey;
      }
      
      console.log('[Auth.getToken] Sending request to:', authUrl);
      const response = await axios.post(authUrl, {
        challenge: CryptoUtils.encodeBase64(challenge, 'base64'),
        signature: CryptoUtils.encodeBase64(signature, 'base64'),
        publicKey: CryptoUtils.encodeBase64(publicKey, 'base64')
      }, { headers, timeout: 30000 });
      
      console.log('[Auth.getToken] Response received, token:', !!response.data.token);
      return response.data.token;
    } catch (error) {
      console.error('[Auth.getToken] Error:', error.message);
      if (error.response) {
        throw new Error(`Server error: ${error.response.status} - ${error.response.data?.message || error.response.statusText}`);
      } else if (error.request) {
        throw new Error('Unable to connect to server, please check network connection');
      } else {
        throw new Error(`Request failed: ${error.message}`);
      }
    }
  }
}

module.exports = Auth;
