import httpx
from bs4 import BeautifulSoup
import logging
import re

logger = logging.getLogger(__name__)

class TradingViewScraper:
    """
    Scraper for TradingView strategy scripts to find new alpha ideas.
    """
    URL = "https://www.tradingview.com/scripts/?script_type=strategies"
    HEADERS = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Referer": "https://www.tradingview.com/",
    }

    async def fetch_trending_strategies(self, limit: int = 5) -> list[dict]:
        """
        Fetch the top trending strategy scripts from TradingView.
        """
        try:
            async with httpx.AsyncClient(headers=self.HEADERS, timeout=10.0, follow_redirects=True) as client:
                resp = await client.get(self.URL)
                if resp.status_code != 200:
                    logger.warning(f"Failed to fetch TradingView scripts: {resp.status_code}")
                    return []
                
                soup = BeautifulSoup(resp.text, "lxml")
                
                findings = []
                titles = soup.select('a[class*="title-"]')
                descriptions = soup.select('a[class*="paragraph-"]')
                
                for i in range(min(len(titles), limit)):
                    title_text = titles[i].get_text(strip=True)
                    href = (titles[i].get("href") or "").strip()
                    
                    if not href:
                        continue
                     
                    logger.info(f"DEBUG: Scraper found href: '{href}'")
                    
                    # More aggressive cleaning
                    # If it already has tradingview.com, just make sure it has a protocol
                    if "tradingview.com" in href:
                        if href.startswith("//"):
                            link = "https:" + href
                        elif href.startswith("http"):
                            # Already has protocol, just fix missing colon if any
                            link = href.replace("http//", "http://").replace("https//", "https://")
                        else:
                            # Has domain but no protocol
                            link = "https://" + (href if not href.startswith("www") else href)
                    else:
                        # Relative path
                        path = href if href.startswith("/") else "/" + href
                        link = f"https://www.tradingview.com{path}"
                    
                    # Final guard against doubling (e.g. domain + domain)
                    if "tradingview.com" in link:
                        parts = link.split("https://")
                        if len(parts) > 2: # e.g. ["", "www.tradingview.com", "www.tradingview.com/path"]
                            link = "https://" + parts[-1]
                        parts_v2 = link.split("https//")
                        if len(parts_v2) > 2:
                            link = "https://" + parts_v2[-1]

                    desc_text = descriptions[i].get_text(strip=True) if i < len(descriptions) else ""
                    
                    findings.append({
                        "title": title_text,
                        "link": link,
                        "description": desc_text
                    })
                
                return findings
        except Exception as exc:
            logger.error(f"Scraper error: {exc}")
            return []
