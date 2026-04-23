import 'dart:async';
import 'package:geolocator/geolocator.dart';
import '../../core/database.dart';

class TrackingService {
  final DatabaseService _dbService = DatabaseService();
  StreamSubscription<Position>? _positionStream;
  String? _currentActivityId;

  Future<void> startTracking(String activityId) async {
    _currentActivityId = activityId;
    
    // Request permissions
    LocationPermission permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
    }

    _positionStream = Geolocator.getPositionStream(
      locationSettings: const LocationSettings(
        accuracy: LocationAccuracy.high,
        distanceFilter: 5, // Update every 5 meters
      ),
    ).listen((Position position) {
      _savePointToLocalDb(position);
    });
  }

  Future<void> stopTracking() async {
    await _positionStream?.cancel();
    _currentActivityId = null;
  }

  Future<void> _savePointToLocalDb(Position position) async {
    if (_currentActivityId == null) return;
    
    final db = await _dbService.database;
    await db.insert('gps_points', {
      'activity_id': _currentActivityId,
      'latitude': position.latitude,
      'longitude': position.longitude,
      'altitude': position.altitude,
      'timestamp': DateTime.now().millisecondsSinceEpoch,
    });
  }
}
