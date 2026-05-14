# Use Python 3.11 slim image
FROM python:3.11-slim

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE 1
ENV PYTHONUNBUFFERED 1
ENV PYTHONUTF8 1
ENV LANG C.UTF-8
ENV LC_ALL C.UTF-8

# Set work directory
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq-dev \
    gcc \
    python3-dev \
    pkg-config \
    netcat-traditional \
    binutils \
    libproj-dev \
    gdal-bin \
    libgdal-dev \
    libgeos-dev \
    && rm -rf /var/lib/apt/lists/*

# Auto-detect GDAL/GEOS library paths for Django GIS
RUN GDAL_PATH=$(find /usr -name 'libgdal.so*' -type f 2>/dev/null | head -1) && \
    GEOS_PATH=$(find /usr -name 'libgeos_c.so*' -type f 2>/dev/null | head -1) && \
    echo "GDAL_LIBRARY_PATH=${GDAL_PATH}" >> /etc/environment && \
    echo "GEOS_LIBRARY_PATH=${GEOS_PATH}" >> /etc/environment

ENV GDAL_LIBRARY_PATH=/usr/lib/x86_64-linux-gnu/libgdal.so
ENV GEOS_LIBRARY_PATH=/usr/lib/x86_64-linux-gnu/libgeos_c.so

# Install dependencies
COPY requirements.txt /app/
RUN pip install --no-cache-dir -r requirements.txt

# Copy project
COPY . /app/

# Create non-root user with numeric UID 1001
RUN useradd -m -u 1001 sportuser && chown -R sportuser:sportuser /app
USER 1001

EXPOSE 8000
CMD python manage.py migrate --no-input && python manage.py create_admin && python manage.py fix_admin_password && python manage.py seed_data && python manage.py collectstatic --no-input && gunicorn --bind 0.0.0.0:${PORT:-8000} --workers 3 core.wsgi:application
