import 'dart:ui';
import 'package:flutter/material.dart';

/// Milestone 8.3: Glassmorphism UI for Flutter (Android & iOS)
/// Implements the "Obsidian" design system on mobile.
class GlassPanel extends StatelessWidget {
  final Widget child;
  final double opacity;
  final double blur;
  final double borderRadius;

  const GlassPanel({
    super.key,
    required this.child,
    this.opacity = 0.1,
    this.blur = 15.0,
    this.borderRadius = 24.0,
  });

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(borderRadius),
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: blur, sigmaY: blur),
        child: Container(
          decoration: BoxDecoration(
            color: Colors.white.withOpacity(opacity),
            borderRadius: BorderRadius.circular(borderRadius),
            border: Border.all(
              color: Colors.white.withOpacity(0.2),
              width: 1.5,
            ),
            gradient: LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [
                Colors.white.withOpacity(0.15),
                Colors.white.withOpacity(0.05),
              ],
            ),
          ),
          child: child,
        ),
      ),
    );
  }
}
