#!/bin/bash

# Create data directory if it doesn't exist
mkdir -p /opt/render/project/src/data

# Set proper permissions
chmod 755 /opt/render/project/src/data

# Start the application
npm start
