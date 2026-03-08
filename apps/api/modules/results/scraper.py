# apps/api/modules/results/scraper.py
"""
Selenium scraper for the Results Module of the
UAF Smart E-Library & University Information Assistant.

Purpose:
- Open the UAF LMS result page in headless Chrome.
- Submit a registration number using the live LMS form.
- Return the resulting HTML to the parser layer.
- Retry transient browser failures and always close the driver cleanly.
"""

import asyncio
import time
from typing import Optional, Tuple

from selenium import webdriver
from selenium.common.exceptions import TimeoutException, WebDriverException
from selenium.webdriver.chrome.options import Options as ChromeOptions
from selenium.webdriver.chrome.service import Service as ChromeService
from selenium.webdriver.common.by import By
from selenium.webdriver.remote.webdriver import WebDriver
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import WebDriverWait
from webdriver_manager.chrome import ChromeDriverManager

from core.config import settings
from core.logging import get_logger

logger = get_logger(__name__)


class UAFResultScraper:
    """
    Headless browser scraper for UAF LMS results.
    """

    _driver_path: Optional[str] = None

    def __init__(self) -> None:
        self._max_retries = 3
        self._retry_delay_seconds = 2
        self._result_ready_length = 1000

    async def fetch_html(self, reg_number: str) -> str:
        """
        Fetch result HTML for a registration number.

        Args:
            reg_number (str): Student registration number.

        Returns:
            str: Result page HTML.

        Raises:
            RuntimeError: If scraping fails after all retries.
        """

        return await asyncio.to_thread(self._fetch_html_sync, reg_number)

    def _fetch_html_sync(self, reg_number: str) -> str:
        last_exception: Optional[Exception] = None

        for attempt in range(1, self._max_retries + 1):
            driver: Optional[WebDriver] = None

            try:
                driver = self._create_driver()
                driver.set_page_load_timeout(settings.selenium_timeout_seconds)
                driver.set_script_timeout(settings.selenium_timeout_seconds)

                logger.info(
                    "RESULTS: loading LMS page",
                    extra={
                        "reg_number": reg_number,
                        "attempt": attempt,
                        "lms_result_url": settings.lms_result_url,
                    },
                )

                driver.get(settings.lms_result_url)

                reg_locator = self._parse_selector(settings.reg_input_selector)
                submit_locator = self._parse_selector(settings.submit_selector)

                reg_input = WebDriverWait(
                    driver,
                    settings.selenium_timeout_seconds,
                ).until(EC.presence_of_element_located(reg_locator))

                reg_input.clear()
                reg_input.send_keys(reg_number)

                submit_button = WebDriverWait(
                    driver,
                    settings.selenium_timeout_seconds,
                ).until(EC.element_to_be_clickable(submit_locator))

                submit_button.click()

                WebDriverWait(
                    driver,
                    settings.selenium_timeout_seconds,
                ).until(self._result_page_loaded)

                html = driver.page_source

                if "Result Not Found" in html or "You are not authorize" in html:
                    raise ValueError("Failed to fetch result HTML")

                if len(html.strip()) < 500:
                    raise ValueError("Failed to fetch result HTML")

                logger.info(
                    "RESULTS: scrape completed",
                    extra={
                        "reg_number": reg_number,
                        "attempt": attempt,
                        "html_length": len(html),
                        "final_url": driver.current_url,
                    },
                )

                return html
            except (TimeoutException, WebDriverException, ValueError) as exc:
                last_exception = exc
                logger.warning(
                    "RESULTS: scrape attempt failed",
                    extra={
                        "reg_number": reg_number,
                        "attempt": attempt,
                        "max_retries": self._max_retries,
                        "error": str(exc),
                    },
                )
            finally:
                if driver is not None:
                    try:
                        driver.quit()
                    except Exception as exc:
                        logger.warning(
                            "RESULTS: driver quit failed",
                            extra={
                                "reg_number": reg_number,
                                "attempt": attempt,
                                "error": str(exc),
                            },
                        )

            if attempt < self._max_retries:
                time.sleep(self._retry_delay_seconds)

        raise RuntimeError("Failed to fetch result HTML") from last_exception

    def _create_driver(self) -> WebDriver:
        options = ChromeOptions()
        options.add_argument("--headless=new")
        options.add_argument("--disable-gpu")
        options.add_argument("--disable-dev-shm-usage")
        options.add_argument("--disable-extensions")
        options.add_argument("--ignore-certificate-errors")
        options.add_argument("--no-sandbox")
        options.add_argument("--window-size=1920,1080")
        options.set_capability("acceptInsecureCerts", True)

        if UAFResultScraper._driver_path is None:
            UAFResultScraper._driver_path = ChromeDriverManager().install()

        service = ChromeService(executable_path=UAFResultScraper._driver_path)
        return webdriver.Chrome(service=service, options=options)

    def _result_page_loaded(self, driver: WebDriver) -> bool:
        if "/course/uaf_student_result.php" in driver.current_url:
            return True

        if len(driver.page_source or "") >= self._result_ready_length:
            return True

        result_markers = driver.find_elements(By.CSS_SELECTOR, "h3[align='center']")

        if result_markers:
            return True

        return False

    def _parse_selector(self, selector_spec: str) -> Tuple[str, str]:
        if selector_spec.startswith("id="):
            return (By.ID, selector_spec[3:])

        if selector_spec.startswith("xpath="):
            return (By.XPATH, selector_spec[6:])

        if selector_spec.startswith("css="):
            return (By.CSS_SELECTOR, selector_spec[4:])

        if selector_spec.startswith("name="):
            return (By.NAME, selector_spec[5:])

        raise ValueError(f"Unsupported selector spec: {selector_spec}")
