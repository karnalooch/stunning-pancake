import 'dart:convert';
import 'package:dio/dio.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// Service responsible for all authentication operations.
///
/// Manages JWT token lifecycle: obtain, refresh, verify, and logout.
/// Tokens are persisted securely using [FlutterSecureStorage].
class AuthService {
  static const String _baseUrl =
      String.fromEnvironment('API_URL', defaultValue: 'http://10.0.2.2:8000');

  static const _storage = FlutterSecureStorage();
  static const _accessTokenKey = 'access_token';
  static const _refreshTokenKey = 'refresh_token';

  final Dio _dio = Dio(BaseOptions(baseUrl: _baseUrl));

  /// Authenticates with email/password and stores JWT tokens.
  ///
  /// Returns the decoded access token payload on success.
  /// Throws [DioException] on network or auth failure.
  Future<Map<String, dynamic>> login(String email, String password) async {
    final response = await _dio.post('/api/auth/token/', data: {
      'username': email,
      'password': password,
    });
    final access = response.data['access'] as String;
    final refresh = response.data['refresh'] as String;
    await _storeTokens(access, refresh);
    return _decodeJwt(access);
  }

  /// Registers a new athlete account.
  Future<void> register({
    required String username,
    required String email,
    required String password,
  }) async {
    await _dio.post('/api/users/register/', data: {
      'username': username,
      'email': email,
      'password': password,
    });
  }

  /// Refreshes access token using the stored refresh token.
  ///
  /// Returns new access token or null if refresh token is expired.
  Future<String?> refreshToken() async {
    final refresh = await _storage.read(key: _refreshTokenKey);
    if (refresh == null) return null;
    try {
      final response = await _dio.post(
        '/api/auth/token/refresh/',
        data: {'refresh': refresh},
      );
      final newAccess = response.data['access'] as String;
      final newRefresh = response.data['refresh'] as String?;
      await _storage.write(key: _accessTokenKey, value: newAccess);
      if (newRefresh != null) {
        await _storage.write(key: _refreshTokenKey, value: newRefresh);
      }
      return newAccess;
    } on DioException {
      await logout();
      return null;
    }
  }

  /// Returns the stored access token, or null if not logged in.
  Future<String?> getAccessToken() => _storage.read(key: _accessTokenKey);

  /// Returns true if the user is currently authenticated.
  Future<bool> isAuthenticated() async {
    final token = await _storage.read(key: _accessTokenKey);
    return token != null;
  }

  /// Clears all stored tokens (logout).
  Future<void> logout() async {
    await _storage.deleteAll();
  }

  Future<void> _storeTokens(String access, String refresh) async {
    await _storage.write(key: _accessTokenKey, value: access);
    await _storage.write(key: _refreshTokenKey, value: refresh);
  }

  /// Decodes the JWT payload without verification (for UI purposes only).
  Map<String, dynamic> _decodeJwt(String token) {
    final parts = token.split('.');
    if (parts.length != 3) return {};
    final payload = parts[1];
    final normalized = base64.normalize(payload);
    final decoded = utf8.decode(base64.decode(normalized));
    return jsonDecode(decoded) as Map<String, dynamic>;
  }
}
