#!/usr/bin/env python3
"""
Traffic Generator for Library Management System
Generates realistic HTTP traffic against the Nginx Reverse Proxy (https://localhost)
to visualize dynamic Request Rates and response times in Grafana & Prometheus.
"""

import urllib.request
import urllib.error
import ssl
import time
import random
import sys

# Ignore SSL verification for self-signed certificate
ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

BASE_URL = "https://localhost"

ENDPOINTS = [
    ("/api/stats", 35),           # 35% traffic
    ("/api/books", 25),           # 25% traffic
    ("/api/readers", 20),         # 20% traffic
    ("/api/borrow-records", 15),  # 15% traffic
    ("/api/non-existent-page", 5) # 5% traffic (generate 404 Not Found)
]

population = []
for ep, weight in ENDPOINTS:
    population.extend([ep] * weight)

def send_request(endpoint):
    url = f"{BASE_URL}{endpoint}"
    try:
        req = urllib.request.Request(
            url,
            headers={"User-Agent": "Mozilla/5.0 (TrafficSimulator/1.0)"}
        )
        with urllib.request.urlopen(req, context=ctx, timeout=3) as response:
            return response.status
    except urllib.error.HTTPError as e:
        return e.code
    except Exception as e:
        return f"ERR: {e}"

def run_simulation(duration_seconds=60, min_delay=0.05, max_delay=0.3):
    print(f"[*] Bắt đầu sinh lưu lượng HTTP thực tế tới {BASE_URL} trong {duration_seconds} giây...")
    print("[*] Quan sát đồ thị Grafana tại: http://localhost:3001/d/library-sys-01\n")
    
    start_time = time.time()
    count = 0
    status_counts = {}

    while time.time() - start_time < duration_seconds:
        endpoint = random.choice(population)
        status = send_request(endpoint)
        count += 1
        status_counts[status] = status_counts.get(status, 0) + 1
        
        # In tiến độ
        elapsed = int(time.time() - start_time)
        print(f"\r[+{elapsed}s] Đã gửi: {count} requests | URL: {endpoint:<25} | Status: {status}", end="", flush=True)
        
        # Nghỉ ngẫu nhiên để tạo nhịp điệu sóng tự nhiên
        time.sleep(random.uniform(min_delay, max_delay))

    print(f"\n\n[✓] Hoàn thành sinh lưu lượng!")
    print(f"Tổng số requests đã gửi: {count}")
    print(f"Thống kê HTTP Status: {status_counts}")

if __name__ == "__main__":
    duration = int(sys.argv[1]) if len(sys.argv) > 1 else 60
    run_simulation(duration_seconds=duration)
