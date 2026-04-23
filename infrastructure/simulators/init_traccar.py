import requests

API_URL = "http://localhost:8082/api"

def register_admin():
    print("Attempting to register admin user...")
    payload = {
        "name": "Admin",
        "email": "admin@sport.local",
        "password": "admin",
        "administrator": True
    }
    try:
        # First user registered in Traccar is usually admin by default if not restricted
        resp = requests.post(f"{API_URL}/users", json=payload)
        if resp.status_code == 200:
            print("Successfully registered admin: admin@sport.local / admin")
        else:
            print(f"Failed: {resp.status_code} - {resp.text}")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    register_admin()
