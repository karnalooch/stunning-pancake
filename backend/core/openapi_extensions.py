"""
drf-spectacular extensions.

The stock GeoFeatureModelSerializerExtension assumes `id` is always present in
request-body schemas. For create operations `id` is read-only and omitted, which
raises KeyError and breaks /api/schema/ (Swagger UI playground).
"""

from drf_spectacular.contrib.rest_framework_gis import GeoFeatureModelSerializerExtension


class SafeGeoFeatureModelSerializerExtension(GeoFeatureModelSerializerExtension):
    priority = 1

    def map_geo_feature_model_serializer(self, serializer, base_schema):
        geo_properties = {
            "type": {"type": "string", "enum": ["Feature"]},
        }
        properties = base_schema.setdefault("properties", {})

        if serializer.Meta.id_field:
            id_schema = properties.pop(serializer.Meta.id_field, None)
            if id_schema is not None:
                geo_properties["id"] = id_schema

        from drf_spectacular.contrib.rest_framework_gis import (
            build_bbox_schema,
            build_object_type,
            get_doc,
            map_geo_field,
        )
        from rest_framework_gis.serializers import GeoFeatureModelSerializer

        geo_properties["geometry"] = map_geo_field(serializer, serializer.Meta.geo_field)
        properties.pop(serializer.Meta.geo_field, None)

        if serializer.Meta.auto_bbox or serializer.Meta.bbox_geo_field:
            geo_properties["bbox"] = build_bbox_schema()
            properties.pop(serializer.Meta.bbox_geo_field, None)

        description = base_schema.pop("description", None)
        if description == get_doc(GeoFeatureModelSerializer):
            description = None

        base_schema.pop("required", None)
        geo_properties["properties"] = base_schema

        return build_object_type(
            properties=geo_properties,
            description=description,
        )
