import requests
import time
import json

BASE_URL = "http://localhost:8000/api"


def run_test():
    print("[*] Authenticating as global_owner...")
    login_url = f"{BASE_URL}/auth/token/"
    login_data = {"username": "global_owner", "password": "admin123"}
    response = requests.post(login_url, json=login_data)
    if response.status_code != 200:
        print(f"[-] Authentication failed: {response.status_code} - {response.text}")
        return

    tokens = response.json()
    access_token = tokens["access"]
    print("[+] Authenticated successfully.")

    headers = {"Authorization": f"Bearer {access_token}", "Content-Type": "application/json"}

    # First, let's stop any running simulation if there is one
    print("[*] Stopping existing simulation if any...")
    requests.delete(f"{BASE_URL}/activities/admin/live-simulate/", headers=headers)

    # Trigger live simulation
    print("[*] Starting Live Simulation...")
    sim_data = {"tick_seconds": 2, "active_ratio": 0.5, "cheat_ratio": 0.2, "pool_pct": 1.0}
    response = requests.post(
        f"{BASE_URL}/activities/admin/live-simulate/", headers=headers, json=sim_data
    )
    if response.status_code != 200:
        print(f"[-] Failed to start simulation: {response.status_code} - {response.text}")
        return

    print(f"[+] Started response: {json.dumps(response.json(), indent=2, ensure_ascii=False)}")

    # Loop a few times to see updates
    for i in range(10):
        print(f"\n--- Checking simulation status {i + 1}/10 ---")
        response = requests.get(f"{BASE_URL}/activities/admin/live-simulate/", headers=headers)
        if response.status_code == 200:
            status = response.json()
            print(f"Running: {status.get('running')}")
            print(f"Elapsed: {status.get('elapsed_seconds')}s")
            print(f"Currently Riding: {status.get('currently_riding')}")
            print(f"Total Completed: {status.get('total_completed')}")
            print(f"Cheaters Caught: {status.get('cheaters_caught')}")
            print("Logs:")
            for log_entry in status.get("log", [])[-5:]:  # Print last 5 log lines
                print(f"  {log_entry}")
        else:
            print(f"[-] Failed to get status: {response.status_code} - {response.text}")
        time.sleep(3)

    # Stop simulation at the end
    print("\n[*] Stopping live simulation...")
    response = requests.delete(f"{BASE_URL}/activities/admin/live-simulate/", headers=headers)
    if response.status_code == 200:
        print(f"[+] Stopped successfully: {response.json()}")
    else:
        print(f"[-] Failed to stop: {response.status_code} - {response.text}")


if __name__ == "__main__":
    # Wait a bit for port forwards to warm up
    time.sleep(1)
    run_test()
