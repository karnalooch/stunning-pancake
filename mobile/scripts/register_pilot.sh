# Registration Script (v2.0)
# Purpose: Reliable registration on slow emulator
# Author: Antigravity

# 1. Clear previous attempts
adb -s emulator-5554 shell input keyevent 3
adb -s emulator-5554 shell am force-stop com.sport.athlete
adb -s emulator-5554 shell am start -n com.sport.athlete/com.sport.athlete.MainActivity

# 2. Wait for bundling
sleep 15

# 3. Click "New athlete? Register here"
# Coordinates from previous view_register: [540, 2240] (approx)
# Actually, I'll use the dump to find it exactly.
# For now, I'll use a safer approach: Tab until focus.
# Login screen has: Email, Password, Authorize, Register button.
# 3 Tabs should reach Register.

adb -s emulator-5554 shell input keyevent 61 # Tab 1
sleep 1
adb -s emulator-5554 shell input keyevent 61 # Tab 2
sleep 1
adb -s emulator-5554 shell input keyevent 61 # Tab 3
sleep 1
adb -s emulator-5554 shell input keyevent 66 # Enter (Click Register link)

sleep 5

# 4. Fill fields
# Fields: Pilot Name, Email, Password, Confirm
adb -s emulator-5554 shell input text "pilot_$(date +%s)"
sleep 2
adb -s emulator-5554 shell input keyevent 61 # Tab to Email
sleep 1
adb -s emulator-5554 shell input text "pilot_$(date +%s)@sport.ai"
sleep 2
adb -s emulator-5554 shell input keyevent 61 # Tab to Password
sleep 1
adb -s emulator-5554 shell input text "RaceDay2026!"
sleep 2
adb -s emulator-5554 shell input keyevent 61 # Tab to Confirm
sleep 1
adb -s emulator-5554 shell input text "RaceDay2026!"
sleep 2

# 5. Submit
adb -s emulator-5554 shell input keyevent 66 # Enter
sleep 10

# 6. Verify
adb -s emulator-5554 shell uiautomator dump /sdcard/registration_result.xml
adb -s emulator-5554 pull /sdcard/registration_result.xml .
