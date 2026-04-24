import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:maplibre_gl/maplibre_gl.dart';
import '../tracking/tracking_service.dart';

final _trackingServiceProvider = Provider((_) => TrackingService());

/// Live map screen with GPS tracking and real-time trail rendering.
///
/// Shows the athlete's current position and a glowing activity trail
/// as they move. Supports START / STOP session controls.
class MapScreen extends ConsumerStatefulWidget {
  const MapScreen({super.key});

  @override
  ConsumerState<MapScreen> createState() => _MapScreenState();
}

class _MapScreenState extends ConsumerState<MapScreen> {
  MaplibreMapController? _mapCtrl;
  final List<LatLng> _trail = [];
  Line? _trailLine;
  Symbol? _positionSymbol;
  String _selectedType = 'RUN';
  double _currentSpeedKmh = 0;
  Duration _elapsed = Duration.zero;
  DateTime? _sessionStart;
  late final TrackingService _tracking;

  @override
  void initState() {
    super.initState();
    _tracking = ref.read(_trackingServiceProvider);
    _tracking.init();
  }

  @override
  void dispose() {
    _tracking.dispose();
    super.dispose();
  }

  Future<void> _onMapCreated(MaplibreMapController ctrl) async {
    _mapCtrl = ctrl;
    _tracking.pointStream.listen(_onNewPoint);
  }

  void _onNewPoint(GpsPoint p) {
    final latlng = LatLng(p.lat, p.lon);
    setState(() {
      _currentSpeedKmh = p.speedMs * 3.6;
      _elapsed = _sessionStart != null
          ? DateTime.now().difference(_sessionStart!)
          : Duration.zero;
      _trail.add(latlng);
    });
    _updateMapOverlay(latlng);
  }

  Future<void> _updateMapOverlay(LatLng pos) async {
    if (_mapCtrl == null) return;
    _mapCtrl!.animateCamera(CameraUpdate.newLatLng(pos));

    // Update position dot
    if (_positionSymbol != null) {
      await _mapCtrl!.updateSymbol(_positionSymbol!, SymbolOptions(geometry: pos));
    } else {
      _positionSymbol = await _mapCtrl!.addSymbol(SymbolOptions(
        geometry: pos,
        iconImage: 'marker-15',
        iconColor: '#00D2FF',
        iconSize: 1.5,
      ));
    }

    // Update trail line
    if (_trail.length >= 2) {
      if (_trailLine != null) {
        await _mapCtrl!.updateLine(
          _trailLine!,
          LineOptions(geometry: _trail),
        );
      } else {
        _trailLine = await _mapCtrl!.addLine(LineOptions(
          geometry: _trail,
          lineColor: '#00D2FF',
          lineWidth: 3.5,
          lineOpacity: 0.85,
        ));
      }
    }
  }

  Future<void> _toggleSession() async {
    if (_tracking.isTracking) {
      await _tracking.stopSession();
      setState(() => _sessionStart = null);
    } else {
      await _tracking.startSession(_selectedType);
      setState(() {
        _trail.clear();
        _sessionStart = DateTime.now();
      });
    }
  }

  String _formatDuration(Duration d) {
    final h = d.inHours.toString().padLeft(2, '0');
    final m = (d.inMinutes % 60).toString().padLeft(2, '0');
    final s = (d.inSeconds % 60).toString().padLeft(2, '0');
    return '$h:$m:$s';
  }

  @override
  Widget build(BuildContext context) {
    final isTracking = _tracking.isTracking;
    return Scaffold(
      backgroundColor: const Color(0xFF0A0E1A),
      body: Stack(
        children: [
          MaplibreMap(
            styleString:
                'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
            initialCameraPosition: const CameraPosition(
              target: LatLng(52.1686, 22.2875), // Siedlce
              zoom: 14,
            ),
            onMapCreated: _onMapCreated,
            trackCameraPosition: false,
          ),

          // Stats overlay (top)
          Positioned(
            top: MediaQuery.of(context).padding.top + 12,
            left: 16,
            right: 16,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
              decoration: BoxDecoration(
                color: const Color(0xFF141B2D).withOpacity(0.92),
                borderRadius: BorderRadius.circular(18),
                border: Border.all(
                    color: const Color(0xFF1E2940).withOpacity(0.6)),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                children: [
                  _statBlock('CZAS', isTracking
                      ? _formatDuration(_elapsed)
                      : '--:--:--'),
                  _divider(),
                  _statBlock(
                      'PRĘDKOŚĆ', '${_currentSpeedKmh.toStringAsFixed(1)} km/h'),
                  _divider(),
                  _statBlock(
                      'PUNKTY', '${_trail.length}'),
                ],
              ),
            ),
          ),

          // Activity type selector + start/stop (bottom)
          Positioned(
            bottom: 40,
            left: 24,
            right: 24,
            child: Column(
              children: [
                if (!isTracking) ...[
                  Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: ['RUN', 'BIKE', 'WALK'].map((type) {
                      final selected = _selectedType == type;
                      return GestureDetector(
                        onTap: () => setState(() => _selectedType = type),
                        child: AnimatedContainer(
                          duration: const Duration(milliseconds: 200),
                          margin: const EdgeInsets.symmetric(horizontal: 6),
                          padding: const EdgeInsets.symmetric(
                              horizontal: 20, vertical: 10),
                          decoration: BoxDecoration(
                            color: selected
                                ? const Color(0xFF00D2FF).withOpacity(0.15)
                                : const Color(0xFF141B2D),
                            borderRadius: BorderRadius.circular(12),
                            border: Border.all(
                              color: selected
                                  ? const Color(0xFF00D2FF)
                                  : const Color(0xFF1E2940),
                            ),
                          ),
                          child: Text(
                            type,
                            style: TextStyle(
                              color: selected
                                  ? const Color(0xFF00D2FF)
                                  : const Color(0xFF8896A5),
                              fontWeight: FontWeight.w700,
                              fontSize: 13,
                            ),
                          ),
                        ),
                      );
                    }).toList(),
                  ),
                  const SizedBox(height: 16),
                ],
                SizedBox(
                  width: double.infinity,
                  height: 56,
                  child: ElevatedButton(
                    key: Key(isTracking
                        ? 'stop_session_button'
                        : 'start_session_button'),
                    onPressed: _toggleSession,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: isTracking
                          ? const Color(0xFFFF4D4D)
                          : const Color(0xFF00D2FF),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(16),
                      ),
                    ),
                    child: Text(
                      isTracking ? 'ZATRZYMAJ SESJĘ' : 'ROZPOCZNIJ TRENING',
                      style: const TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.w800,
                        color: Colors.white,
                        letterSpacing: 0.5,
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _statBlock(String label, String value) => Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(label,
              style: const TextStyle(
                  color: Color(0xFF8896A5),
                  fontSize: 10,
                  fontWeight: FontWeight.w600,
                  letterSpacing: 0.8)),
          const SizedBox(height: 4),
          Text(value,
              style: const TextStyle(
                  color: Colors.white,
                  fontSize: 16,
                  fontWeight: FontWeight.w800)),
        ],
      );

  Widget _divider() => Container(
      width: 1, height: 32, color: const Color(0xFF1E2940).withOpacity(0.8));
}
