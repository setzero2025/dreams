from playwright.sync_api import sync_playwright
import time

with sync_playwright() as p:
    browser = p.chromium.launch(headless=False)
    page = browser.new_page()
    page.goto('http://localhost:8081')
    time.sleep(3)
    page.screenshot(path='screenshot_home.png', full_page=True)
    print('首页截图已保存')
    browser.close()
