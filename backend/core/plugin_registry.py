"""
Plugin Registry — SPORT Platform
=================================
Constitution §23 + §8: Plugin-Based Extensibility Architecture

Rules:
- Plugins MUST NOT modify core models directly.
- All interaction via Django Signals, middleware hooks, or this Registry.
- Metadata stored in JSONB (PluginConfig model).
- Each plugin declares a manifest and registers hooks.
"""
import logging
from typing import Callable, Any
from dataclasses import dataclass, field

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Plugin Manifest
# ---------------------------------------------------------------------------

@dataclass
class PluginManifest:
    """
    Describes a plugin's identity and capabilities.

    Attributes:
        name: Unique slug identifier (e.g. 'voucher_hotspots').
        version: Semver string (e.g. '1.0.0').
        author: Maintainer name/team.
        description: Short description of what the plugin does.
        hooks: List of hook names this plugin registers into.
        pilot_mode: If True, plugin only activates for pilot tenants.
    """
    name: str
    version: str
    author: str
    description: str
    hooks: list[str] = field(default_factory=list)
    pilot_mode: bool = False


# ---------------------------------------------------------------------------
# Registry
# ---------------------------------------------------------------------------

class PluginRegistry:
    """
    Central registry for all SPORT plugins.

    Implements an event-hook system analogous to pluggy.
    Each hook is a named event (e.g. 'activity.verified', 'event.completed').
    Plugins register callables against these hooks, which are invoked
    by the core engine via :meth:`fire`.

    Usage::

        # In a plugin module:
        from core.plugin_registry import registry, PluginManifest

        MANIFEST = PluginManifest(
            name='voucher_hotspots',
            version='1.0.0',
            author='akarn',
            description='Awards vouchers when athletes pass sponsor POIs.',
            hooks=['activity.verified'],
        )

        @registry.hook('activity.verified')
        def on_activity_verified(activity, **kwargs):
            ...  # check proximity to POIs, award vouchers

        registry.register(MANIFEST)
    """

    def __init__(self) -> None:
        self._manifests: dict[str, PluginManifest] = {}
        self._hooks: dict[str, list[Callable]] = {}

    # ------------------------------------------------------------------
    # Registration
    # ------------------------------------------------------------------

    def register(self, manifest: PluginManifest) -> None:
        """
        Registers a plugin manifest with the registry.

        Args:
            manifest: The plugin's PluginManifest.

        Raises:
            ValueError: If a plugin with the same name is already registered.
        """
        if manifest.name in self._manifests:
            raise ValueError(f"Plugin '{manifest.name}' is already registered.")
        self._manifests[manifest.name] = manifest
        logger.info("plugin.registered name=%s version=%s", manifest.name, manifest.version)

    def unregister(self, name: str) -> None:
        """
        Removes a plugin and all its hook handlers.

        Args:
            name: Plugin slug to remove.
        """
        if name not in self._manifests:
            logger.warning("plugin.unregister_failed name=%s (not found)", name)
            return
        manifest = self._manifests.pop(name)
        # Remove all handlers tagged with this plugin
        for hook_name in manifest.hooks:
            self._hooks[hook_name] = [
                fn for fn in self._hooks.get(hook_name, [])
                if getattr(fn, '_plugin_name', None) != name
            ]
        logger.info("plugin.unregistered name=%s", name)

    # ------------------------------------------------------------------
    # Hook decorator
    # ------------------------------------------------------------------

    def hook(self, hook_name: str) -> Callable:
        """
        Decorator that registers a function as a handler for a named hook.

        Args:
            hook_name: The hook event name (e.g. 'activity.verified').

        Returns:
            Decorator function.
        """
        def decorator(fn: Callable) -> Callable:
            fn._hook_name = hook_name  # type: ignore[attr-defined]
            self._hooks.setdefault(hook_name, []).append(fn)
            logger.debug("hook.registered hook=%s fn=%s", hook_name, fn.__qualname__)
            return fn
        return decorator

    # ------------------------------------------------------------------
    # Firing hooks
    # ------------------------------------------------------------------

    def fire(self, hook_name: str, **kwargs: Any) -> list[Any]:
        """
        Fires all handlers registered for a hook.

        Called by core engine (signals, views). Must not raise — all
        exceptions are caught and logged to prevent one bad plugin from
        breaking the core.

        Args:
            hook_name: The event name.
            **kwargs: Context data passed to each handler.

        Returns:
            List of return values from each handler (None on exception).
        """
        results: list[Any] = []
        for handler in self._hooks.get(hook_name, []):
            plugin_name = getattr(handler, '_plugin_name', 'unknown')
            try:
                result = handler(**kwargs)
                results.append(result)
            except Exception as exc:
                logger.error(
                    "plugin.hook_error hook=%s plugin=%s err=%s",
                    hook_name, plugin_name, exc,
                    exc_info=True,
                )
                results.append(None)
        return results

    # ------------------------------------------------------------------
    # Introspection
    # ------------------------------------------------------------------

    def list_plugins(self) -> list[dict]:
        """Returns a summary of all registered plugins."""
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
        return {k: len(v) for k, v in self._hooks.items()}


# ---------------------------------------------------------------------------
# Global singleton (imported by core engine and plugins)
# ---------------------------------------------------------------------------

registry = PluginRegistry()


# ---------------------------------------------------------------------------
# Built-in: Voucher Hotspot Plugin (Constitution §17)
# ---------------------------------------------------------------------------

VOUCHER_MANIFEST = PluginManifest(
    name='voucher_hotspots',
    version='1.0.0',
    author='akarn',
    description='Awards vouchers when athletes complete activities near sponsor POIs.',
    hooks=['activity.verified'],
    pilot_mode=False,
)


@registry.hook('activity.verified')
def voucher_hotspot_handler(activity=None, **kwargs) -> dict:
    """
    Checks whether the verified activity passes within range of any sponsor POI
    and, if so, assigns an unclaimed voucher to the athlete.

    This handler is completely decoupled from the core — it only reads Activity
    and POI via Django ORM and writes to Voucher.redeemed_by.

    Args:
        activity: The saved Activity model instance.

    Returns:
        Dict with 'vouchers_awarded' count.
    """
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
                voucher.save(update_fields=['is_redeemed', 'redeemed_by'])
                awarded += 1
                logger.info(
                    "voucher.awarded code=%s user=%s poi=%s",
                    voucher.code, activity.user_id, poi.name,
                )

        return {"vouchers_awarded": awarded}

    except Exception as exc:
        logger.error("voucher_hotspot_handler.error err=%s", exc, exc_info=True)
        return {"vouchers_awarded": 0}


voucher_hotspot_handler._plugin_name = 'voucher_hotspots'  # type: ignore[attr-defined]
registry.register(VOUCHER_MANIFEST)
