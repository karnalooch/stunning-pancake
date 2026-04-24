"""
Plugin System v2 — SPORT Platform (pluggy-based)
=================================================
Constitution §23 + §8: Plugin-Based Extensibility Architecture

Replaces the custom PluginRegistry with the industry-standard `pluggy`
library (same engine used by pytest). Provides:

- Hook specifications (HookSpec) for all SPORT core events
- Isolated plugin registration via pluggy.PluginManager
- Full backwards-compatible API: registry.fire(), registry.hook()
- Tracing mode when DEBUG=True

Hook inventory:
    activity.verified    — called after a valid activity is saved
    activity.suspicious  — called when is_suspicious=True
    event.completed      — called when an event transitions to COMPLETED
    club.created         — called when a new club is provisioned

Rules (Constitution §23):
    - Plugins MUST NOT modify core models directly.
    - All cross-domain interaction via these hooks only.
    - Each plugin declares a PluginManifest for metadata/introspection.
"""
from __future__ import annotations

import logging
import os
from dataclasses import dataclass, field
from typing import Any, Callable

import pluggy

logger = logging.getLogger(__name__)
DEBUG = os.getenv("DEBUG", "0") == "1"

# ---------------------------------------------------------------------------
# Hook specification — defines the contract for each hook
# ---------------------------------------------------------------------------

PROJECT_NAME = "sport"
hookspec = pluggy.HookspecMarker(PROJECT_NAME)
hookimpl = pluggy.HookimplMarker(PROJECT_NAME)


class SportHookSpec:
    """
    Formal hook specifications for the SPORT Plugin System.

    Each method here defines a hook that plugins can implement.
    The docstring is the contract: what arguments are passed, what
    return values are expected.
    """

    @hookspec
    def validate_activity(self, activity: Any, processing_result: Any) -> bool:
        """
        Allows sport-specific plugins to perform additional validation.
        If any plugin returns False, the activity is rejected.
        """

    @hookspec
    def activity_verified(self, activity: Any) -> Any:
        """
        Called after an activity is successfully verified.

        Args:
            activity: The Django Activity model instance.

        Returns:
            Any dict or None. Results are collected by the engine.
        """

    @hookspec
    def activity_suspicious(self, activity: Any, anomaly_ratio: float) -> Any:
        """
        Called when an activity fails kinematic validation (anomaly_ratio > threshold).

        Args:
            activity: The Django Activity model instance.
            anomaly_ratio: Fraction of GPS segments that exceeded V-max.
        """

    @hookspec
    def event_completed(self, event: Any) -> Any:
        """
        Called when an Event transitions from ACTIVE to COMPLETED.

        Args:
            event: The Django Event model instance.
        """

    @hookspec
    def club_created(self, club: Any) -> Any:
        """
        Called when a new Club is created and provisioned.

        Args:
            club: The Django Club model instance.
        """


# ---------------------------------------------------------------------------
# Plugin Manifest (metadata)
# ---------------------------------------------------------------------------

@dataclass
class PluginManifest:
    """
    Describes a plugin's identity and capabilities.

    Attributes:
        name: Unique slug (e.g. 'voucher_hotspots').
        version: Semver string.
        author: Maintainer name.
        description: Short description.
        hooks: List of hook names implemented.
        pilot_mode: If True, only activates for pilot tenants.
    """
    name: str
    version: str
    author: str
    description: str
    hooks: list[str] = field(default_factory=list)
    pilot_mode: bool = False


# ---------------------------------------------------------------------------
# SPORT Plugin Manager (wraps pluggy.PluginManager)
# ---------------------------------------------------------------------------

class SportPluginManager:
    """
    Thin wrapper around pluggy.PluginManager that adds:
    - PluginManifest registry for introspection
    - Backwards-compatible .fire() and .hook() API
    - DEBUG tracing
    """

    def __init__(self) -> None:
        self._pm = pluggy.PluginManager(PROJECT_NAME)
        self._pm.add_hookspecs(SportHookSpec)
        self._manifests: dict[str, PluginManifest] = {}

        if DEBUG:
            self._pm.enable_tracing()
            logger.debug("pluggy: tracing enabled")

    # ------------------------------------------------------------------
    # Registration
    # ------------------------------------------------------------------

    def register(self, manifest: PluginManifest, plugin_obj: object | None = None) -> None:
        """
        Registers a plugin manifest + optionally the plugin object.

        Args:
            manifest: Plugin identity/metadata.
            plugin_obj: The class/module with @hookimpl methods. If None,
                        the plugin is metadata-only (no hook handlers).

        Raises:
            ValueError: If plugin name already registered.
        """
        if manifest.name in self._manifests:
            raise ValueError(f"Plugin '{manifest.name}' is already registered.")
        self._manifests[manifest.name] = manifest
        if plugin_obj is not None:
            self._pm.register(plugin_obj, name=manifest.name)
        logger.info("plugin.registered name=%s version=%s", manifest.name, manifest.version)

    def unregister(self, name: str) -> None:
        """Removes plugin by name."""
        if name not in self._manifests:
            logger.warning("plugin.unregister_failed name=%s", name)
            return
        self._manifests.pop(name)
        plugin = self._pm.get_plugin(name)
        if plugin:
            self._pm.unregister(plugin)
        logger.info("plugin.unregistered name=%s", name)

    # ------------------------------------------------------------------
    # fire() — backwards-compatible hook dispatcher
    # ------------------------------------------------------------------

    def fire(self, hook_name: str, **kwargs: Any) -> list[Any]:
        """
        Fires all pluggy implementations registered for a hook.

        Translates dot-notation hook names ('activity.verified') to
        pluggy method names ('activity_verified').

        Args:
            hook_name: Dot-notation hook name.
            **kwargs: Context data forwarded to all implementations.

        Returns:
            List of return values from each implementation.
        """
        method_name = hook_name.replace(".", "_")
        hook = getattr(self._pm.hook, method_name, None)
        if hook is None:
            logger.debug("plugin.fire: no hook '%s'", hook_name)
            return []
        try:
            return hook(**kwargs)
        except Exception as exc:
            logger.error("plugin.fire_error hook=%s err=%s", hook_name, exc, exc_info=True)
            return []

    # ------------------------------------------------------------------
    # hook() decorator — backwards-compatible shim
    # ------------------------------------------------------------------

    def hook(self, hook_name: str) -> Callable:
        """
        Decorator shim for backwards compatibility with the old registry API.

        For new plugins, use @hookimpl directly and pass the object to register().
        """
        def decorator(fn: Callable) -> Callable:
            # Tag the function so pluggy recognises it
            fn = hookimpl(fn)
            fn._hook_name = hook_name  # type: ignore[attr-defined]
            # Create an ad-hoc plugin object wrapping the function
            method_name = hook_name.replace(".", "_")
            AdHocPlugin = type(
                f"AdHocPlugin_{fn.__name__}",
                (),
                {method_name: staticmethod(fn)},
            )
            plugin = AdHocPlugin()
            self._pm.register(plugin, name=f"adhoc_{hook_name}_{fn.__name__}")
            logger.debug("hook.registered hook=%s fn=%s", hook_name, fn.__qualname__)
            return fn
        return decorator

    # ------------------------------------------------------------------
    # Introspection
    # ------------------------------------------------------------------

    def list_plugins(self) -> list[dict]:
        """Returns summary of all registered plugins."""
        return [
            {
                "name": m.name,
                "version": m.version,
                "author": m.author,
                "description": m.description,
                "hooks": m.hooks,
                "pilot_mode": m.pilot_mode,
            }
            for m in self._manifests.values()
        ]

    def get_hooks(self) -> dict[str, int]:
        """Returns hook names with handler counts."""
        counts: dict[str, int] = {}
        for hook_name in ["activity_verified", "activity_suspicious", "event_completed", "club_created"]:
            hook = getattr(self._pm.hook, hook_name, None)
            if hook:
                counts[hook_name.replace("_", ".")] = len(hook.get_hookimpls())
        return counts


# ---------------------------------------------------------------------------
# Global singleton
# ---------------------------------------------------------------------------

registry = SportPluginManager()


# ---------------------------------------------------------------------------
# Built-in: Voucher Hotspot Plugin (Constitution §17)
# ---------------------------------------------------------------------------

VOUCHER_MANIFEST = PluginManifest(
    name="voucher_hotspots",
    version="2.0.0",
    author="akarn",
    description="Awards vouchers when athletes complete activities near sponsor POIs.",
    hooks=["activity.verified"],
)


class VoucherHotspotPlugin:
    """
    pluggy-native implementation of the Voucher Hotspot plugin.

    Checks if a verified activity passed within 100m of any sponsor POI
    and assigns unclaimed vouchers to the athlete.
    """

    @hookimpl
    def activity_verified(self, activity: Any) -> dict:
        if activity is None:
            return {"vouchers_awarded": 0}

        try:
            from activities.models import POI, Voucher
            from django.contrib.gis.measure import Distance as D

            if not activity.route_path:
                return {"vouchers_awarded": 0}

            awarded = 0
            nearby_pois = POI.objects.filter(
                location__distance_lte=(activity.route_path, D(m=100))
            )

            for poi in nearby_pois:
                voucher = (
                    Voucher.objects
                    .filter(poi=poi, is_redeemed=False)
                    .select_for_update(skip_locked=True)
                    .first()
                )
                if voucher:
                    voucher.is_redeemed = True
                    voucher.redeemed_by = activity.user
                    voucher.save(update_fields=["is_redeemed", "redeemed_by"])
                    awarded += 1
                    logger.info(
                        "voucher.awarded code=%s user=%s poi=%s",
                        voucher.code, activity.user_id, poi.name,
                    )

            return {"vouchers_awarded": awarded}

        except Exception as exc:
            logger.error("voucher_hotspot.error err=%s", exc, exc_info=True)
            return {"vouchers_awarded": 0}


registry.register(VOUCHER_MANIFEST, VoucherHotspotPlugin())


# ---------------------------------------------------------------------------
# Sport Disciplines: Run Validator Plugin
# ---------------------------------------------------------------------------

RUN_VALIDATOR_MANIFEST = PluginManifest(
    name="run_validator",
    version="1.0.0",
    author="sport-core",
    description="Custom validation logic for running activities.",
    hooks=["validate_activity"],
)

class RunValidatorPlugin:
    @hookimpl
    def validate_activity(self, activity: Any, processing_result: Any) -> bool:
        if activity.type != "RUN":
            return True
        
        # Example: Reject runs with impossibly high elevation gain per km
        # (Very simple biomechanical heuristic)
        if hasattr(processing_result, 'total_elevation_gain'):
            dist_km = processing_result.total_distance_m / 1000.0
            if dist_km > 0.1:
                gain_per_km = processing_result.total_elevation_gain / dist_km
                if gain_per_km > 400: # >40% average grade is impossible for running long distances
                    logger.warning("run_validator.rejected: gain_per_km=%.1f", gain_per_km)
                    return False
        return True

registry.register(RUN_VALIDATOR_MANIFEST, RunValidatorPlugin())


# ---------------------------------------------------------------------------
# Sport Disciplines: Bike Validator Plugin
# ---------------------------------------------------------------------------

BIKE_VALIDATOR_MANIFEST = PluginManifest(
    name="bike_validator",
    version="1.0.0",
    author="sport-core",
    description="Custom validation logic for biking activities.",
    hooks=["validate_activity"],
)

class BikeValidatorPlugin:
    @hookimpl
    def validate_activity(self, activity: Any, processing_result: Any) -> bool:
        if activity.type != "BIKE":
            return True
        
        # Example: Biking usually follows road networks more strictly
        # We could check the map-matching confidence here.
        return True

registry.register(BIKE_VALIDATOR_MANIFEST, BikeValidatorPlugin())
