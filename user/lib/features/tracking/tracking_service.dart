import 'dart:async';
import 'package:geolocator/geolocator.dart';
import 'package:sqflite/sqflite.dart';
import 'package:path/path.dart';
import 'package:dio/dio.dart';
import '../auth/auth_service.dart';

/// GPS point recorded locally during an active session.
class GpsPoint {
  final double lat;
  final double lon;
  final double speedMs;
  final double accuracy;
  final int timestamp; // Unix epoch seconds

  const GpsPoint({
    required this.lat,
    required this.lon,
    required this.speedMs,
    required this.accuracy,
    required this.timestamp,
  });

  Map<String, dynamic> toMap() => {
        'lat': lat,
        'lon': lon,
        'speed_ms': speedMs,
        'accuracy': accuracy,
        'timestamp': timestamp,
      };
}

/// Offline-first GPS tracking service.
///
/// Records GPS points to local SQLite (single source of truth).
/// Uploads in batches once session ends; retries with exponential backoff.
class TrackingService {
  static const String _baseUrl =
      String.fromEnvironment('API_URL', defaultValue: 'http://10.0.2.2:8000');
  static const int _batchSize = 30;
  static const int _maxRetries = 5;

  Database? _db;
  StreamSubscription<Position>? _positionSub;
  final _pointsController = StreamController<GpsPoint>.broadcast();

  /// Live stream of GPS points for real-time map rendering.
  Stream<GpsPoint> get pointStream => _pointsController.stream;

  int? _activeSessionId;
  bool _isTracking = false;
  bool get isTracking => _isTracking;

  /// Initialises local SQLite DB. Must be called before [startSession].
  Future<void> init() async {
    final dbPath = await getDatabasesPath();
    _db = await openDatabase(
      join(dbPath, 'sport_tracking.db'),
      version: 2,
      onCreate: (db, _) async {
        await db.execute('''
          CREATE TABLE sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            activity_type TEXT NOT NULL,
            started_at INTEGER NOT NULL,
            ended_at INTEGER,
            synced INTEGER DEFAULT 0
          )
        ''');
        await db.execute('''
          CREATE TABLE gps_points (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id INTEGER NOT NULL,
            lat REAL NOT NULL,
            lon REAL NOT NULL,
            speed_ms REAL DEFAULT 0,
            accuracy REAL DEFAULT 0,
            timestamp INTEGER NOT NULL,
            FOREIGN KEY (session_id) REFERENCES sessions(id)
          )
        ''');
      },
    );
  }

  /// Starts a new GPS session for [activityType] (RUN, BIKE, WALK).
  Future<void> startSession(String activityType) async {
    if (_isTracking) return;
    await _requestPermissions();

    final sessionId = await _db!.insert('sessions', {
      'activity_type': activityType,
      'started_at': DateTime.now().millisecondsSinceEpoch ~/ 1000,
    });
    _activeSessionId = sessionId;
    _isTracking = true;

    _positionSub = Geolocator.getPositionStream(
      locationSettings: const LocationSettings(
        accuracy: LocationAccuracy.high,
        distanceFilter: 5,
      ),
    ).listen(_onPosition);
  }

  /// Ends the session and starts background upload.
  Future<void> stopSession() async {
    if (!_isTracking || _activeSessionId == null) return;
    await _positionSub?.cancel();
    _isTracking = false;

    await _db!.update(
      'sessions',
      {'ended_at': DateTime.now().millisecondsSinceEpoch ~/ 1000},
      where: 'id = ?',
      whereArgs: [_activeSessionId],
    );

    final sessionId = _activeSessionId!;
    _activeSessionId = null;
    // Fire-and-forget async sync with retry
    _syncSession(sessionId);
  }

  void _onPosition(Position pos) {
    final point = GpsPoint(
      lat: pos.latitude,
      lon: pos.longitude,
      speedMs: pos.speed,
      accuracy: pos.accuracy,
      timestamp: pos.timestamp.millisecondsSinceEpoch ~/ 1000,
    );
    _pointsController.add(point);
    _db?.insert('gps_points', {
      ...point.toMap(),
      'session_id': _activeSessionId,
    });
  }

  Future<List<GpsPoint>> getSessionPoints(int sessionId) async {
    final rows = await _db!.query(
      'gps_points',
      where: 'session_id = ?',
      whereArgs: [sessionId],
      orderBy: 'timestamp ASC',
    );
    return rows
        .map((r) => GpsPoint(
              lat: r['lat'] as double,
              lon: r['lon'] as double,
              speedMs: r['speed_ms'] as double? ?? 0,
              accuracy: r['accuracy'] as double? ?? 0,
              timestamp: r['timestamp'] as int,
            ))
        .toList();
  }

  /// Syncs session data to backend. Retries with exponential backoff.
  Future<void> _syncSession(int sessionId, {int attempt = 0}) async {
    final auth = AuthService();
    final token = await auth.getAccessToken();
    if (token == null) return;

    final sessions = await _db!.query(
      'sessions',
      where: 'id = ?',
      whereArgs: [sessionId],
    );
    if (sessions.isEmpty) return;
    final session = sessions.first;

    final points = await getSessionPoints(sessionId);
    if (points.isEmpty) return;

    final dio = Dio(BaseOptions(baseUrl: _baseUrl, headers: {
      'Authorization': 'Bearer $token',
    }));

    for (var i = 0; i < points.length; i += _batchSize) {
      final batch = points.skip(i).take(_batchSize).toList();
      try {
        await dio.post('/api/activities/upload/', data: {
          'activity_type': session['activity_type'],
          'started_at': session['started_at'],
          'ended_at': session['ended_at'],
          'points': batch.map((p) => p.toMap()).toList(),
        });
      } catch (_) {
        if (attempt < _maxRetries) {
          await Future.delayed(Duration(seconds: 1 << attempt)); // 1,2,4,8,16s
          return _syncSession(sessionId, attempt: attempt + 1);
        }
        return; // Retry on next launch
      }
    }

    await _db!.update(
      'sessions',
      {'synced': 1},
      where: 'id = ?',
      whereArgs: [sessionId],
    );
  }

  Future<void> _requestPermissions() async {
    var perm = await Geolocator.checkPermission();
    if (perm == LocationPermission.denied) {
      perm = await Geolocator.requestPermission();
    }
    if (perm == LocationPermission.deniedForever) {
      throw Exception('Location permission permanently denied');
    }
  }

  void dispose() {
    _positionSub?.cancel();
    _pointsController.close();
    _db?.close();
  }
}
