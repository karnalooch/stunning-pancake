"""On-demand GPX 1.1 export from PostGIS route_path (P2 F1)."""

from __future__ import annotations

import xml.etree.ElementTree as ET
from xml.dom import minidom

from django.contrib.gis.geos import LineString
from django.utils import timezone


def linestring_to_gpx(
    route_path: LineString,
    *,
    track_name: str = "4VELO Activity",
    activity_type: str = "other",
    simulated: bool = False,
) -> str:
    """Build GPX 1.1 XML from a WGS84 LineString (x=lon, y=lat)."""
    if route_path is None or route_path.num_coords < 2:
        raise ValueError("route_path must contain at least two coordinates")

    gpx_ns = "http://www.topografix.com/GPX/1/1"
    ET.register_namespace("", gpx_ns)

    root = ET.Element("gpx", attrib={"version": "1.1", "creator": "4VELO", "xmlns": gpx_ns})
    meta = ET.SubElement(root, "metadata")
    ET.SubElement(meta, "name").text = track_name
    ET.SubElement(meta, "time").text = timezone.now().strftime("%Y-%m-%dT%H:%M:%SZ")
    if simulated:
        ext = ET.SubElement(meta, "extensions")
        ET.SubElement(ext, "simulated").text = "true"

    trk = ET.SubElement(root, "trk")
    ET.SubElement(trk, "name").text = track_name
    ET.SubElement(trk, "type").text = activity_type

    seg = ET.SubElement(trk, "trkseg")
    for lon, lat, *_ in route_path.coords:
        pt = ET.SubElement(seg, "trkpt", attrib={"lat": f"{lat:.6f}", "lon": f"{lon:.6f}"})

    rough = ET.tostring(root, encoding="unicode")
    return minidom.parseString(rough).toprettyxml(indent="  ", encoding=None).strip()
