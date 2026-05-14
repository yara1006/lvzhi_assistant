#!/bin/bash
cd /home/ubuntu/Legal_Assistant
source /home/ubuntu/Legal_Assistant/.venv/bin/activate
exec /home/ubuntu/Legal_Assistant/.venv/bin/python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
