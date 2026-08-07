"""
小红书远行商人笔记采集脚本

功能：访问指定小红书账号主页，获取最新远行商人笔记的标题和正文。

使用：python scripts/xhs_merchant_scraper.py [--headless]
"""

import json
import os
import sys
import time
import re
import shutil
from datetime import datetime
from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeout

TARGET_PROFILE_URL = "https://www.xiaohongshu.com/user/profile/663817f30000000003030cf1?xsec_token=ABqUYhwVoY5ludFXRxvNHsoMSwuBd2c67fgn1SVfFQ_Vg=&xsec_source=pc_note&tab=note"
BROWSER_DATA_DIR = os.path.join(os.path.dirname(__file__), ".xhs_browser_data")
OUTPUT_FILE = os.path.join(os.path.dirname(__file__), "xhs_latest_note.json")

HEADLESS = "--headless" in sys.argv


def is_more_recent(time_a, time_b):
    """比较两个时间文本，判断 time_a 是否比 time_b 更近"""
    if not time_a:
        return False
    if not time_b:
        return True

    def extract_date_score(t):
        """从文本中提取日期并返回分数（越大越近）"""
        t = t.strip()
        # MM.DD 格式（如 "08.07"、"07.31"）
        m = re.search(r'(\d{1,2})\.(\d{1,2})', t)
        if m:
            month, day = int(m.group(1)), int(m.group(2))
            return month * 31 + day
        # MM-DD 格式
        m = re.search(r'(\d{1,2})-(\d{1,2})', t)
        if m:
            month, day = int(m.group(1)), int(m.group(2))
            return month * 31 + day
        # 相对时间
        if "刚刚" in t: return 100000
        m = re.search(r'(\d+)\s*分钟前', t)
        if m: return 99999 - int(m.group(1))
        m = re.search(r'(\d+)\s*小时前', t)
        if m: return 99000 - int(m.group(1))
        if "昨天" in t: return 98000
        m = re.search(r'(\d+)\s*天前', t)
        if m: return 97000 - int(m.group(1))
        return 0

    sa = extract_date_score(time_a)
    sb = extract_date_score(time_b)
    return sa > sb


def scrape_latest_note():
    with sync_playwright() as p:
        context = p.chromium.launch_persistent_context(
            user_data_dir=BROWSER_DATA_DIR,
            headless=HEADLESS,
            viewport={"width": 1280, "height": 800},
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        )
        page = context.new_page()

        try:
            # 1. 访问主页
            print(f"[*] 访问: {TARGET_PROFILE_URL}")
            page.goto(TARGET_PROFILE_URL, wait_until="networkidle", timeout=30000)
            time.sleep(3)

            # 2. 登录检查
            if is_login_page(page):
                if HEADLESS:
                    print("[!] 需要登录但运行在 headless 模式，cookies 可能已过期")
                    print("[!] 请本地运行 `python scripts/xhs_merchant_scraper.py` 重新登录后更新 Secret")
                    return None
                print("[!] 需要登录，请在浏览器中扫码...")
                for i in range(300):
                    time.sleep(1)
                    if not is_login_page(page):
                        print("[✓] 登录成功")
                        time.sleep(2)
                        break
                else:
                    print("[!] 登录超时")
                    return None
                page.goto(TARGET_PROFILE_URL, wait_until="networkidle", timeout=30000)
                time.sleep(3)

            # 3. 等待笔记卡片
            print("[*] 等待笔记卡片...")
            try:
                page.wait_for_selector('section.note-item, div[class*="note-item"], a[class*="cover"]', timeout=15000)
            except PlaywrightTimeout:
                print("[!] 未找到笔记卡片")
                return None
            time.sleep(2)

            # 4. 查找最新笔记（按时间，跳过置顶）
            print("[*] 查找最新发布的笔记...")
            note_cards = page.query_selector_all('section.note-item, div[class*="note-item"]')
            if not note_cards:
                note_cards = page.query_selector_all('a[class*="cover"]')
            if not note_cards:
                print("[!] 未找到笔记卡片")
                return None

            latest_idx = 0
            latest_time = ""
            for i, card in enumerate(note_cards):
                # 提取时间文本
                time_text = page.evaluate('''(el) => {
                    // 方法1: class 包含 time/date/ago 的元素
                    const selectors = ['[class*="time"]', '[class*="date"]', '[class*="ago"]', '[class*="elapsed"]', 'time'];
                    for (const sel of selectors) {
                        const timeEl = el.querySelector(sel);
                        if (timeEl) {
                            const text = timeEl.innerText.trim();
                            if (text) return text;
                        }
                    }
                    // 方法2: 查找所有 span，找包含时间格式的
                    const spans = el.querySelectorAll('span');
                    const timePattern = /\\d+[\\-\\/]|刚刚|分钟前|小时前|昨天|天前|\\d{1,2}:\\d{2}/;
                    for (const span of spans) {
                        const text = span.innerText.trim();
                        if (timePattern.test(text)) {
                            return text;
                        }
                    }
                    // 方法3: 查找所有文本节点
                    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
                    while (walker.nextNode()) {
                        const text = walker.currentNode.textContent.trim();
                        if (timePattern.test(text)) return text;
                    }
                    return ""
                }''', card)
                
                # 提取标题用于调试
                title_text = page.evaluate('''(el) => {
                    const titleEl = el.querySelector('[class*="title"], [class*="desc"], span');
                    return titleEl ? titleEl.innerText.trim().substring(0, 30) : "(no title)";
                }''', card)
                
                # 打印前5个卡片的调试信息
                if i < 5:
                    print(f"  [{i}] time='{time_text}' title='{title_text}'")
                
                if is_more_recent(time_text, latest_time):
                    latest_time = time_text
                    latest_idx = i

            print(f"[*] 最新笔记: 索引{latest_idx}, 时间={latest_time}")

            # 5. 提取笔记标题
            note_title = page.evaluate('''(el) => {
                const titleEl = el.querySelector('[class*="title"], span:first-child');
                return titleEl ? titleEl.innerText.trim() : "";
            }''', note_cards[latest_idx])

            # 6. 点击笔记卡片打开详情
            print(f"[*] 笔记标题: {note_title}")
            print("[*] 正在打开笔记详情...")
            note_cards[latest_idx].click()
            time.sleep(5)

            # 7. 切换到详情页面（可能在新标签页打开）
            pages = context.pages
            if len(pages) > 1:
                detail_page = pages[-1]
                detail_page.wait_for_load_state("networkidle", timeout=15000)
                time.sleep(2)
                note_url = detail_page.url
                working_page = detail_page
            else:
                page.wait_for_load_state("networkidle", timeout=15000)
                time.sleep(2)
                note_url = page.url
                working_page = page

            # 8. 提取笔记正文
            note_content = ""
            try:
                # 尝试多种选择器提取正文内容
                content_selectors = [
                    '#detail-desc',                           # 旧版详情描述
                    '[class*="note-text"]',                   # 笔记文本
                    '[class*="desc"]',                        # 描述区
                    '[class*="content"]',                     # 内容区
                    'article',                                # 文章标签
                    '[class*="note-content"]',                # 笔记内容
                    '[class*="rich-text"]',                   # 富文本
                ]
                
                for sel in content_selectors:
                    try:
                        el = working_page.query_selector(sel)
                        if el:
                            text = el.inner_text().strip()
                            if len(text) > 20:  # 有效内容至少20字符
                                note_content = text
                                print(f"[*] 通过选择器 '{sel}' 提取到正文 ({len(text)} 字符)")
                                break
                    except:
                        continue
                
                # 如果选择器都没找到，尝试从整个页面提取相关内容
                if not note_content:
                    # 获取页面所有文本，过滤出笔记正文部分
                    all_text = working_page.evaluate('''() => {
                        // 查找包含笔记正文的容器
                        const containers = document.querySelectorAll(
                            '[class*="note"], [class*="content"], [class*="desc"], article, [class*="text"]'
                        );
                        let best = "";
                        for (const c of containers) {
                            const text = c.innerText || "";
                            if (text.length > best.length && text.length < 10000) {
                                best = text;
                            }
                        }
                        return best;
                    }''')
                    if all_text and len(all_text) > 20:
                        # 清理文本：去掉导航栏、评论等噪音
                        lines = all_text.split('\n')
                        clean_lines = []
                        skip_patterns = [
                            r'^(关注|粉丝|赞和收藏|笔记|收藏|评论|转发|分享|回复|点赞)',
                            r'^(首页|发现|发布|消息|我|搜索)',
                            r'^(登录|注册)',
                            r'^\d+\s*(关注|粉丝|赞)',
                            r'^(举报|复制链接|不感兴趣|拉黑)',
                            r'^(返回|关闭)',
                        ]
                        for line in lines:
                            line = line.strip()
                            if not line:
                                continue
                            if any(re.match(p, line) for p in skip_patterns):
                                continue
                            clean_lines.append(line)
                        note_content = '\n'.join(clean_lines)
                        print(f"[*] 通过页面扫描提取到正文 ({len(note_content)} 字符)")

            except Exception as e:
                print(f"[!] 提取正文失败: {e}")

            # 9. 清理标题中的特殊字符
            note_title = re.sub(r'[\x00-\x1f]', '', note_title).strip()

            result = {
                "title": note_title,
                "content": note_content if note_content else "[未能自动提取正文]",
                "url": note_url,
                "scraped_at": datetime.now().isoformat(),
            }

            print(f"\n{'='*50}")
            print(f"标题: {note_title}")
            print(f"正文长度: {len(note_content)} 字符")
            print(f"URL: {note_url}")
            print(f"{'='*50}")
            if note_content:
                # 打印正文前500字符预览
                preview = note_content[:500]
                if len(note_content) > 500:
                    preview += "..."
                print(f"正文预览:\n{preview}")

            with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
                json.dump(result, f, ensure_ascii=False, indent=2)
            print(f"\n[*] 已保存: {OUTPUT_FILE}")

            # 同步复制到 public/ 供前端读取
            public_dir = os.path.join(os.path.dirname(__file__), "..", "public")
            public_output = os.path.join(public_dir, "xhs_latest_note.json")
            try:
                shutil.copy2(OUTPUT_FILE, public_output)
                print(f"[*] 已同步到: {public_output}")
            except Exception as copy_err:
                print(f"[!] 同步到 public/ 失败: {copy_err}")

            return result

        except Exception as e:
            print(f"[!] 失败: {e}")
            import traceback
            traceback.print_exc()
            return None
        finally:
            context.close()


def is_login_page(page):
    try:
        t = page.title()
        c = page.content()
        is_login = "登录" in t or "手机号登录" in c or "扫码登录" in c
        if is_login:
            print(f"[DEBUG] Login page detected - title='{t}', has_login_content={'登录' in c}")
        return is_login
    except Exception as e:
        print(f"[DEBUG] Login check failed: {e}")
        return False


if __name__ == "__main__":
    print("=" * 50)
    print("小红书远行商人笔记采集")
    print("=" * 50)
    scrape_latest_note()
